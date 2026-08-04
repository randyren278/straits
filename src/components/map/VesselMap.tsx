'use client';

/**
 * Main map component using MapLibre GL JS.
 * Renders ALL vessel positions as individual GeoJSON dots — no visual clustering.
 * When zoomed in close to a group of co-located vessels, the sidebar panel
 * auto-populates with the nearby vessels for easy browsing.
 *
 * Uses a keyless CARTO dark-matter basemap — no access token required, which
 * keeps the Bloomberg-terminal aesthetic without a paid map provider.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-06, MAP-07, INTL-01, ANOM-01
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useVesselStore } from '@/stores/vessel';
import { vesselsToGeoJSON } from '@/lib/map/geojson';
import { filterTankers } from '@/lib/map/filter';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import type { ClusterVessel, MapCenter } from '@/stores/vessel';

/**
 * Keyless dark basemap style (CARTO dark-matter, GL-compatible).
 * No API token required — served free by CARTO's basemaps CDN.
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Minimum zoom level before proximity detection kicks in.
 * Below this zoom the map is too zoomed out for grouping to be useful.
 */
const PROXIMITY_MIN_ZOOM = 8;

/**
 * Pixel radius for proximity grouping — when multiple vessels fall within
 * this many pixels of each other at the current zoom, they're considered
 * co-located and the sidebar panel shows the group.
 */
const PROXIMITY_PIXEL_RADIUS = 25;

/** Minimum number of vessels in a pixel cluster to trigger the sidebar */
const PROXIMITY_MIN_COUNT = 2;

export function VesselMap({ initialCenter }: { initialCenter?: MapCenter } = {}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const vesselsRef = useRef<VesselWithSanctions[]>([]);
  const [vessels, setVessels] = useState<VesselWithSanctions[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { tankersOnly, setSelectedVessel, setLastUpdate, selectedVessel, showTrack, mapCenter, setMapCenter, anomalyFilter, targetVesselImo, setTargetVesselImo } =
    useVesselStore();

  // ─── Proximity detection ────────────────────────────────────────
  // After zooming/panning, find groups of vessels that overlap on screen.
  // When a dense group is found near map center, auto-populate the sidebar.
  const detectProximityGroup = useCallback(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.isStyleLoaded()) return;
    if (map.current.getZoom() < PROXIMITY_MIN_ZOOM) {
      // Too zoomed out — clear any existing cluster panel
      useVesselStore.getState().setClusterVessels(null);
      return;
    }

    // Query all rendered vessel features in the viewport
    const canvas = map.current.getCanvas();
    let features: maplibregl.MapGeoJSONFeature[];
    try {
      features = map.current.queryRenderedFeatures(
        [[0, 0], [canvas.width, canvas.height]],
        { layers: ['vessel-circles'] }
      );
    } catch {
      // Map style or layer not ready yet — skip this cycle
      return;
    }

    if (features.length < PROXIMITY_MIN_COUNT) {
      useVesselStore.getState().setClusterVessels(null);
      return;
    }

    // Project each vessel to screen pixels and find dense groups
    const projected = features.map((f) => {
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const pixel = map.current!.project(coords);
      return { feature: f, px: pixel.x, py: pixel.y };
    });

    // Simple grid-based grouping: bucket by pixel grid cells
    const cellSize = PROXIMITY_PIXEL_RADIUS * 2;
    const buckets = new Map<string, typeof projected>();

    for (const item of projected) {
      const cellX = Math.floor(item.px / cellSize);
      const cellY = Math.floor(item.py / cellSize);
      const key = `${cellX},${cellY}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }

    // Find the densest bucket with 2+ vessels
    let densest: typeof projected | null = null;
    for (const group of buckets.values()) {
      if (group.length >= PROXIMITY_MIN_COUNT) {
        if (!densest || group.length > densest.length) {
          densest = group;
        }
      }
    }

    if (!densest) {
      useVesselStore.getState().setClusterVessels(null);
      return;
    }

    // Convert to ClusterVessel format for the sidebar
    const clusterVessels: ClusterVessel[] = densest.map(({ feature }) => {
      const p = feature.properties || {};
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      return {
        imo: p.imo || null,
        mmsi: p.mmsi || '',
        name: p.name || null,
        flag: p.flag || null,
        shipType: p.shipType ?? null,
        speed: p.speed ?? null,
        course: p.course ?? null,
        heading: p.heading ?? null,
        latitude: coords[1],
        longitude: coords[0],
        isSanctioned: p.isSanctioned || false,
        anomalyType: p.anomalyType || null,
        anomalyConfidence: p.anomalyConfidence || null,
        sanctionRiskCategory: p.sanctionRiskCategory || null,
        destination: p.destination || null,
        lowConfidence: p.lowConfidence || false,
      };
    });

    // Deduplicate by IMO/MMSI (queryRenderedFeatures can return dupes across tiles)
    const seen = new Set<string>();
    const deduped = clusterVessels.filter((v) => {
      const key = v.imo || v.mmsi;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (deduped.length >= PROXIMITY_MIN_COUNT) {
      useVesselStore.getState().setClusterVessels(deduped);
    } else {
      useVesselStore.getState().setClusterVessels(null);
    }
  }, [mapLoaded]);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    let mapInstance: maplibregl.Map;
    try {
      mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        // Server-picked densest chokepoint when available; otherwise the
        // Strait of Hormuz region, matching today's default.
        center: initialCenter ? [initialCenter.lon, initialCenter.lat] : [54, 25],
        zoom: initialCenter ? initialCenter.zoom : 5,
        attributionControl: { compact: true },
      });
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'Map failed to load');
      return;
    }

    // Handle map-level errors (tile failures, style load errors, etc.) on the
    // instance itself rather than a global window listener. MapLibre routes all
    // async load/telemetry failures through this event, so there is no post-dispose
    // errorCb race that a global handler would need to intercept.
    mapInstance.on('error', (e) => {
      console.warn('[MapLibre]', e.error?.message || 'Unknown map error');
    });

    map.current = mapInstance;

    // Named handler refs so the cleanup can detach each listener explicitly
    // (prevents handler accumulation across React Strict Mode re-mounts).
    const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

      const vessel: VesselWithSanctions = {
        imo: props?.imo || null,
        mmsi: props?.mmsi || '',
        name: props?.name || null,
        flag: props?.flag || null,
        shipType: props?.shipType ?? null,
        destination: props?.destination || null,
        lastSeen: new Date(),
        isSanctioned: props?.isSanctioned || false,
        sanctioningAuthority: props?.sanctioningAuthority || null,
        sanctionReason: null,
        sanctionRiskCategory: props?.sanctionRiskCategory || null,
        anomalyType: props?.anomalyType || null,
        anomalyConfidence: props?.anomalyConfidence || null,
        position: {
          time: new Date(),
          mmsi: props?.mmsi || '',
          imo: props?.imo || null,
          latitude: coords[1],
          longitude: coords[0],
          speed: props?.speed ?? null,
          course: props?.course ?? null,
          heading: props?.heading ?? null,
          navStatus: props?.navStatus ?? null,
          lowConfidence: props?.lowConfidence || false,
        },
      };
      setSelectedVessel(vessel);
    };
    const handleMouseEnter = () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    };
    const handleMoveEnd = () => detectProximityGroup();

    map.current.on('load', () => {
      if (!map.current) return;

      // ─── Vessel source — NO clustering ─────────────────────────
      // Every vessel renders as its own dot at all zoom levels.
      // Guard against duplicate ids if the style ever reloads.
      if (!map.current.getSource('vessels')) {
        map.current.addSource('vessels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      // ─── Vessel circles — always visible ───────────────────────
      if (!map.current.getLayer('vessel-circles')) {
      map.current.addLayer({
        id: 'vessel-circles',
        type: 'circle',
        source: 'vessels',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 10, 8],
          'circle-color': [
            'case',
            // Priority 1: Going dark confirmed (bright red)
            ['all',
              ['==', ['get', 'anomalyType'], 'going_dark'],
              ['==', ['get', 'anomalyConfidence'], 'confirmed']
            ],
            '#ef4444',
            // Priority 2: Going dark suspected (yellow)
            ['all',
              ['==', ['get', 'anomalyType'], 'going_dark'],
              ['==', ['get', 'anomalyConfidence'], 'suspected']
            ],
            '#eab308',
            // Priority 3: Loitering (orange)
            ['==', ['get', 'anomalyType'], 'loitering'],
            '#f97316',
            // Priority 4: Speed anomaly (blue)
            ['==', ['get', 'anomalyType'], 'speed'],
            '#3b82f6',
            // Priority 5: Deviation (purple)
            ['==', ['get', 'anomalyType'], 'deviation'],
            '#a855f7',
            // Priority 6: Sanctioned vessels (bright red)
            ['all',
              ['==', ['get', 'isSanctioned'], true],
              ['==', ['get', 'sanctionRiskCategory'], 'sanction']
            ],
            '#ef4444',
            // Priority 7: Shadow fleet vessels (purple)
            ['all',
              ['==', ['get', 'isSanctioned'], true],
              ['==', ['get', 'sanctionRiskCategory'], 'mare.shadow;poi']
            ],
            '#a855f7',
            // Priority 8: Detained vessels (dim red/rose)
            ['all',
              ['==', ['get', 'isSanctioned'], true],
              ['any',
                ['==', ['get', 'sanctionRiskCategory'], 'mare.detained'],
                ['==', ['get', 'sanctionRiskCategory'], 'mare.detained;reg.warn']
              ]
            ],
            '#fb7185',
            // Priority 9: Other sanctioned/listed vessels (red fallback)
            ['==', ['get', 'isSanctioned'], true],
            '#ef4444',
            // Priority 10: Tankers (amber)
            // coalesce handles null shipType — prevents GL expression error
            [
              'all',
              ['>=', ['coalesce', ['get', 'shipType'], -1], 80],
              ['<=', ['coalesce', ['get', 'shipType'], -1], 89],
            ],
            '#f59e0b',
            // Default: Other vessels (gray)
            '#6b7280',
          ],
          // Low-confidence positions get a thicker amber ring to flag uncertainty
          'circle-stroke-width': ['case', ['==', ['get', 'lowConfidence'], true], 3, 1],
          'circle-stroke-color': ['case', ['==', ['get', 'lowConfidence'], true], '#f59e0b', '#ffffff'],
          'circle-stroke-opacity': ['case', ['==', ['get', 'lowConfidence'], true], 0.9, 1],
        },
      });
      }

      // ─── Chokepoint bounding box overlays ──────────────────────
      const chokepointFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = Object.values(CHOKEPOINTS).map((cp) => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [cp.bounds.minLon, cp.bounds.minLat],
            [cp.bounds.maxLon, cp.bounds.minLat],
            [cp.bounds.maxLon, cp.bounds.maxLat],
            [cp.bounds.minLon, cp.bounds.maxLat],
            [cp.bounds.minLon, cp.bounds.minLat],
          ]],
        },
        properties: { name: cp.name },
      }));

      if (!map.current.getSource('chokepoints')) {
        map.current.addSource('chokepoints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: chokepointFeatures },
        });
      }

      if (!map.current.getLayer('chokepoint-fill')) {
        map.current.addLayer({
          id: 'chokepoint-fill',
          type: 'fill',
          source: 'chokepoints',
          paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.04 },
        }, 'vessel-circles');
      }

      if (!map.current.getLayer('chokepoint-outline')) {
        map.current.addLayer({
          id: 'chokepoint-outline',
          type: 'line',
          source: 'chokepoints',
          paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [4, 3] },
        }, 'vessel-circles');
      }

      if (!map.current.getLayer('chokepoint-labels')) {
        map.current.addLayer({
          id: 'chokepoint-labels',
          type: 'symbol',
          source: 'chokepoints',
          layout: {
            'text-field': ['get', 'name'],
            // CARTO dark-matter glyphs expose the "Open Sans" family.
            'text-font': ['Open Sans Bold'],
            'text-size': 11,
            'text-anchor': 'top-left',
            'text-offset': [0.3, 0.3],
          },
          paint: { 'text-color': '#f59e0b', 'text-opacity': 0.6 },
        });
      }

      // ─── Interaction handlers (named refs, detached in cleanup) ─
      map.current.on('click', 'vessel-circles', handleClick);
      map.current.on('mouseenter', 'vessel-circles', handleMouseEnter);
      map.current.on('mouseleave', 'vessel-circles', handleMouseLeave);

      // ─── Proximity detection on zoom/pan ──────────────────────
      // After the map settles, detect dense vessel groups and auto-
      // populate the sidebar panel.
      map.current.on('moveend', handleMoveEnd);

      setMapLoaded(true);

      // Eagerly push any vessels that arrived before the map loaded.
      // The data-update effect will also fire when mapLoaded flips,
      // but this guarantees the source gets data immediately.
      const currentVessels = vesselsRef.current;
      if (currentVessels.length > 0) {
        const source = mapInstance.getSource('vessels') as maplibregl.GeoJSONSource;
        if (source) {
          const { tankersOnly: t, anomalyFilter: af } = useVesselStore.getState();
          let filtered = filterTankers(currentVessels, t);
          if (af) filtered = filtered.filter((v) => v.anomalyType !== null && v.anomalyType !== undefined);
          source.setData(vesselsToGeoJSON(filtered));
        }
      }
    });

    // Cleanup
    return () => {
      // Detach layer/map listeners explicitly before removing the instance so
      // handlers don't accumulate across Strict Mode re-mounts.
      try {
        mapInstance.off('click', 'vessel-circles', handleClick);
        mapInstance.off('mouseenter', 'vessel-circles', handleMouseEnter);
        mapInstance.off('mouseleave', 'vessel-circles', handleMouseLeave);
        mapInstance.off('moveend', handleMoveEnd);
      } catch {
        // Instance may already be partially torn down; ignore.
      }
      try {
        map.current?.remove();
      } catch {
        // GL teardown can throw if async callbacks fire after disposal.
      }
      map.current = null;
    };
  }, [setSelectedVessel, detectProximityGroup, initialCenter]);

  // Fetch vessels periodically
  useEffect(() => {
    async function fetchVessels() {
      try {
        const res = await fetch(`/api/vessels?tankersOnly=${tankersOnly}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch vessels: ${res.status}`);
        }
        const data = await res.json();
        setVessels(data.vessels || []);
        setLastUpdate(new Date(data.timestamp));
      } catch (err) {
        console.error('Failed to fetch vessels:', err);
      }
    }

    fetchVessels();
    const interval = setInterval(fetchVessels, 30000);
    return () => clearInterval(interval);
  }, [tankersOnly, setLastUpdate]);

  // Update map data when vessels change (or anomaly filter changes)
  useEffect(() => {
    // Keep ref in sync so the map-load callback can access latest data
    vesselsRef.current = vessels;

    if (!map.current || !mapLoaded) return;

    let filtered = filterTankers(vessels, tankersOnly);

    if (anomalyFilter) {
      filtered = filtered.filter((v) => v.anomalyType !== null && v.anomalyType !== undefined);
    }

    const geojson = vesselsToGeoJSON(filtered);

    const source = map.current.getSource('vessels') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(geojson);
    }

    // Re-run proximity detection after data update
    detectProximityGroup();
  }, [vessels, tankersOnly, anomalyFilter, mapLoaded, detectProximityGroup]);

  // Handle track layer for selected vessel
  const updateTrackLayer = useCallback(async () => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer('vessel-track')) {
      map.current.removeLayer('vessel-track');
    }
    if (map.current.getSource('vessel-track')) {
      map.current.removeSource('vessel-track');
    }

    if (!selectedVessel || !showTrack) return;

    try {
      const res = await fetch(`/api/positions/${selectedVessel.mmsi}?hours=24`);
      const data = await res.json();
      const positions = data.positions || [];

      if (positions.length < 2) return;

      const sorted = [...positions].sort(
        (a: { time: string }, b: { time: string }) =>
          new Date(a.time).getTime() - new Date(b.time).getTime()
      );

      const trackLine: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: sorted.map((p: { longitude: number; latitude: number }) => [
            p.longitude,
            p.latitude,
          ]),
        },
        properties: { mmsi: selectedVessel.mmsi },
      };

      map.current.addSource('vessel-track', {
        type: 'geojson',
        data: trackLine,
      });

      map.current.addLayer({
        id: 'vessel-track',
        type: 'line',
        source: 'vessel-track',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-opacity': 0.8,
        },
      });
    } catch (err) {
      console.error('Failed to load track:', err);
    }
  }, [selectedVessel, showTrack, mapLoaded]);

  useEffect(() => {
    updateTrackLayer();
  }, [updateTrackLayer]);

  // Handle map navigation from search or chokepoint selection
  useEffect(() => {
    if (!map.current || !mapLoaded || !mapCenter) return;

    map.current.flyTo({
      center: [mapCenter.lon, mapCenter.lat],
      zoom: mapCenter.zoom,
      duration: 1500,
    });

    setMapCenter(null);
  }, [mapCenter, mapLoaded, setMapCenter]);

  // Hydrate pending target vessel from cross-route navigation (fleet → dashboard)
  useEffect(() => {
    if (!targetVesselImo || vessels.length === 0) return;

    const match = vessels.find((v) => v.imo === targetVesselImo);
    if (match) {
      setSelectedVessel(match);
      setTargetVesselImo(null);
    } else {
      console.warn(
        `[VesselMap] Target vessel IMO ${targetVesselImo} not found in ${vessels.length} loaded vessels`
      );
    }
  }, [targetVesselImo, vessels, setSelectedVessel, setTargetVesselImo]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-gray-500 font-mono text-sm">
        <div className="text-center">
          <div className="text-amber-500 uppercase tracking-widest mb-2">MAP ERROR</div>
          <div>{mapError}</div>
          <div className="mt-2 text-xs text-gray-600">WebGL required for map rendering</div>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full" />;
}

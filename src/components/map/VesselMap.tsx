'use client';

/**
 * Main map component using Mapbox GL JS.
 * Renders ALL vessel positions as individual GeoJSON dots — no visual clustering.
 * When zoomed in close to a group of co-located vessels, the sidebar panel
 * auto-populates with the nearby vessels for easy browsing.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-06, MAP-07, INTL-01, ANOM-01
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useVesselStore } from '@/stores/vessel';
import { vesselsToGeoJSON } from '@/lib/map/geojson';
import { filterTankers } from '@/lib/map/filter';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import type { ClusterVessel } from '@/stores/vessel';

// Set Mapbox token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

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

export function VesselMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
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
    let features: mapboxgl.GeoJSONFeature[];
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

    let mapInstance: mapboxgl.Map;
    try {
      mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [54, 25], // Strait of Hormuz region
        zoom: 5,
      });
      map.current = mapInstance;
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'Map failed to load');
      return;
    }

    map.current = mapInstance;

    map.current.on('load', () => {
      if (!map.current) return;

      // ─── Vessel source — NO clustering ─────────────────────────
      // Every vessel renders as its own dot at all zoom levels.
      map.current.addSource('vessels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // ─── Vessel circles — always visible ───────────────────────
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
            [
              'all',
              ['>=', ['get', 'shipType'], 80],
              ['<=', ['get', 'shipType'], 89],
            ],
            '#f59e0b',
            // Default: Other vessels (gray)
            '#6b7280',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

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

      map.current.addSource('chokepoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: chokepointFeatures },
      });

      map.current.addLayer({
        id: 'chokepoint-fill',
        type: 'fill',
        source: 'chokepoints',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.04 },
      }, 'vessel-circles');

      map.current.addLayer({
        id: 'chokepoint-outline',
        type: 'line',
        source: 'chokepoints',
        paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [4, 3] },
      }, 'vessel-circles');

      map.current.addLayer({
        id: 'chokepoint-labels',
        type: 'symbol',
        source: 'chokepoints',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-anchor': 'top-left',
          'text-offset': [0.3, 0.3],
        },
        paint: { 'text-color': '#f59e0b', 'text-opacity': 0.6 },
      });

      // ─── Individual vessel click handler ──────────────────────
      map.current.on('click', 'vessel-circles', (e) => {
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
            navStatus: null,
            lowConfidence: props?.lowConfidence || false,
          },
        };
        setSelectedVessel(vessel);
      });

      // Cursor change on hover
      map.current.on('mouseenter', 'vessel-circles', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'vessel-circles', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // ─── Proximity detection on zoom/pan ──────────────────────
      // After the map settles, detect dense vessel groups and auto-
      // populate the sidebar panel.
      map.current.on('moveend', () => detectProximityGroup());

      setMapLoaded(true);

      // Eagerly push any vessels that arrived before the map loaded.
      // The data-update effect will also fire when mapLoaded flips,
      // but this guarantees the source gets data immediately.
      const currentVessels = vesselsRef.current;
      if (currentVessels.length > 0) {
        const source = mapInstance.getSource('vessels') as mapboxgl.GeoJSONSource;
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
      map.current?.remove();
      map.current = null;
    };
  }, [setSelectedVessel, detectProximityGroup]);

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

    const source = map.current.getSource('vessels') as mapboxgl.GeoJSONSource;
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
      console.log(`[VesselMap] Hydrated target vessel: ${targetVesselImo}`);
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

'use client';

/**
 * Main map component using Mapbox GL JS.
 * Renders vessel positions as GeoJSON points on a dark-themed map.
 * Uses Mapbox GL clustering to handle co-located vessels at ports,
 * anchorages, and chokepoints. Clusters expand on click and spiderfy
 * at maximum zoom to reveal individual vessels.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-06, MAP-07, INTL-01, ANOM-01
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useVesselStore } from '@/stores/vessel';
import { vesselsToGeoJSON } from '@/lib/map/geojson';
import { filterTankers } from '@/lib/map/filter';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import { spiderfyCluster, clearSpiderLegs, SPIDER_LAYER_IDS } from '@/lib/map/spiderfy';
import type { VesselWithPosition } from '@/types/vessel';
import type { VesselWithSanctions } from '@/lib/db/sanctions';

// Set Mapbox token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/** Zoom level at which clusters stop merging and individual points show */
const CLUSTER_MAX_ZOOM = 16;
/** Pixel radius for clustering — tuned for maritime density */
const CLUSTER_RADIUS = 50;

export function VesselMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [vessels, setVessels] = useState<VesselWithSanctions[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { tankersOnly, setSelectedVessel, setLastUpdate, selectedVessel, showTrack, mapCenter, setMapCenter, anomalyFilter, targetVesselImo, setTargetVesselImo } =
    useVesselStore();

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

      // ─── Vessel source with clustering enabled ───────────────────
      // Mapbox GL clusters co-located points server-side in vector tiles,
      // dramatically improving rendering performance and visual clarity.
      // Cluster properties aggregate key attributes so we can color/label
      // clusters by their composition (tankers, anomalies, sanctions).
      map.current.addSource('vessels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
        clusterProperties: {
          // Count tankers (shipType 80-89) via mapbox expression accumulator
          tankerCount: [
            ['+', ['accumulated'], ['get', 'tankerCount']],
            ['case', ['all', ['>=', ['get', 'shipType'], 80], ['<=', ['get', 'shipType'], 89]], 1, 0],
          ],
          // Count vessels with any anomaly
          anomalyCount: [
            ['+', ['accumulated'], ['get', 'anomalyCount']],
            ['case', ['==', ['get', 'hasAnomaly'], true], 1, 0],
          ],
          // Count sanctioned vessels
          sanctionedCount: [
            ['+', ['accumulated'], ['get', 'sanctionedCount']],
            ['case', ['==', ['get', 'isSanctioned'], true], 1, 0],
          ],
        },
      });

      // ─── Cluster circle layer ──────────────────────────────────
      // Graduated sizes by point_count, colored by cluster composition:
      // Red if any anomaly/sanction, amber if mostly tankers, gray for mixed.
      map.current.addLayer({
        id: 'cluster-circles',
        type: 'circle',
        source: 'vessels',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'point_count'],
            2, 16,
            10, 22,
            50, 30,
            200, 40,
          ],
          'circle-color': [
            'case',
            // Red ring if cluster contains anomalies or sanctioned vessels
            ['>', ['get', 'anomalyCount'], 0],
            '#dc2626',
            ['>', ['get', 'sanctionedCount'], 0],
            '#ef4444',
            // Amber if majority are tankers
            ['>=', ['/', ['get', 'tankerCount'], ['get', 'point_count']], 0.5],
            '#d97706',
            // Default: neutral dark
            '#374151',
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['>', ['get', 'anomalyCount'], 0],
            '#fca5a5',
            ['>', ['get', 'sanctionedCount'], 0],
            '#fca5a5',
            '#f59e0b',
          ],
          'circle-stroke-opacity': 0.6,
        },
      });

      // ─── Cluster count label ───────────────────────────────────
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'vessels',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // ─── Unclustered individual vessel circles ─────────────────
      // Same color logic as before, only renders for non-clustered features.
      map.current.addLayer({
        id: 'vessel-circles',
        type: 'circle',
        source: 'vessels',
        filter: ['!', ['has', 'point_count']],
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
      }, 'cluster-circles');

      map.current.addLayer({
        id: 'chokepoint-outline',
        type: 'line',
        source: 'chokepoints',
        paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [4, 3] },
      }, 'cluster-circles');

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

      // ─── Cluster click: expand or spiderfy ────────────────────
      // At lower zoom, clicking a cluster zooms in to expand it.
      // At max cluster zoom or when all points share the same location,
      // the cluster "spiderfies" — fanning out individual points in a
      // circle so every vessel is clickable.
      map.current.on('click', 'cluster-circles', (e) => {
        if (!map.current || !e.features?.length) return;
        const feature = e.features[0];
        const clusterId = feature.properties?.cluster_id;
        const clusterCoords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        const source = map.current.getSource('vessels') as mapboxgl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !map.current) return;

          // If we'd zoom past max or are already at/near max, spiderfy instead
          if (zoom != null && zoom > CLUSTER_MAX_ZOOM) {
            source.getClusterLeaves(clusterId, 100, 0, (err2, leaves) => {
              if (err2 || !map.current || !leaves) return;
              clearSpiderLegs(map.current);
              spiderfyCluster(map.current, clusterCoords, leaves);
            });
          } else {
            // Zoom in to break the cluster apart
            map.current.easeTo({
              center: clusterCoords,
              zoom: zoom ?? (map.current.getZoom() + 2),
              duration: 500,
            });
          }
        });
      });

      // Clear spiderfy legs when clicking elsewhere on the map
      map.current.on('click', (e) => {
        if (!map.current) return;
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['cluster-circles', 'vessel-circles', ...SPIDER_LAYER_IDS],
        });
        if (!features.length) {
          clearSpiderLegs(map.current);
        }
      });

      // ─── Cluster hover: show composition tooltip ──────────────
      map.current.on('mouseenter', 'cluster-circles', (e) => {
        if (!map.current || !e.features?.length) return;
        map.current.getCanvas().style.cursor = 'pointer';

        const props = e.features[0].properties;
        if (!props) return;

        const total = props.point_count || 0;
        const tankers = props.tankerCount || 0;
        const anomalies = props.anomalyCount || 0;
        const sanctioned = props.sanctionedCount || 0;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

        // Build Bloomberg-style tooltip content
        const lines: string[] = [
          `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#d1d5db;line-height:1.5">`,
          `<div style="color:#f59e0b;font-weight:700;margin-bottom:2px">${total} VESSELS</div>`,
        ];
        if (tankers > 0) lines.push(`<div>⬤ <span style="color:#f59e0b">${tankers}</span> tankers</div>`);
        if (anomalies > 0) lines.push(`<div>⬤ <span style="color:#ef4444">${anomalies}</span> anomalies</div>`);
        if (sanctioned > 0) lines.push(`<div>⬤ <span style="color:#ef4444">${sanctioned}</span> sanctioned</div>`);
        const other = total - tankers;
        if (other > 0 && tankers > 0) lines.push(`<div>⬤ <span style="color:#6b7280">${other}</span> other</div>`);
        lines.push(`<div style="color:#6b7280;margin-top:4px;font-size:10px">Click to expand</div>`);
        lines.push('</div>');

        popup.current?.remove();
        popup.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'vessel-cluster-popup',
          offset: 15,
        })
          .setLngLat(coords)
          .setHTML(lines.join(''))
          .addTo(map.current);
      });

      map.current.on('mouseleave', 'cluster-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
        popup.current?.remove();
        popup.current = null;
      });

      // ─── Individual vessel click handler ──────────────────────
      map.current.on('click', 'vessel-circles', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

        // Reconstruct VesselWithSanctions from feature properties (including anomaly)
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
          sanctionReason: null, // Not stored in GeoJSON properties
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

      // ─── Spider leg vessel click handler ──────────────────────
      // Spider circles are rendered as a separate layer — wire up selection.
      map.current.on('click', 'spider-circles', (e) => {
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

      // Cursor change on hover for vessel circles + spider circles
      map.current.on('mouseenter', 'vessel-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'vessel-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
      map.current.on('mouseenter', 'spider-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'spider-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });

      setMapLoaded(true);
    });

    // Clear spider legs on zoom change (clusters reform)
    map.current.on('zoomstart', () => {
      if (map.current) clearSpiderLegs(map.current);
    });

    // Cleanup
    return () => {
      popup.current?.remove();
      popup.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [setSelectedVessel]);

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
    const interval = setInterval(fetchVessels, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [tankersOnly, setLastUpdate]);

  // Update map data when vessels change (or anomaly filter changes)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear spider legs since data is refreshing (cluster IDs may change)
    clearSpiderLegs(map.current);

    let filtered = filterTankers(vessels, tankersOnly);

    // Apply anomaly filter if enabled
    if (anomalyFilter) {
      filtered = filtered.filter((v) => v.anomalyType !== null && v.anomalyType !== undefined);
    }

    const geojson = vesselsToGeoJSON(filtered);

    const source = map.current.getSource('vessels') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojson);
    }
  }, [vessels, tankersOnly, anomalyFilter, mapLoaded]);

  // Handle track layer for selected vessel
  const updateTrackLayer = useCallback(async () => {
    if (!map.current || !mapLoaded) return;

    // Remove existing track layer if present
    if (map.current.getLayer('vessel-track')) {
      map.current.removeLayer('vessel-track');
    }
    if (map.current.getSource('vessel-track')) {
      map.current.removeSource('vessel-track');
    }

    // If no vessel selected or track not enabled, we're done
    if (!selectedVessel || !showTrack) return;

    try {
      const res = await fetch(`/api/positions/${selectedVessel.mmsi}?hours=24`);
      const data = await res.json();
      const positions = data.positions || [];

      if (positions.length < 2) return;

      // Sort and build LineString
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
        properties: {
          mmsi: selectedVessel.mmsi,
        },
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

    // Clear the navigation request after flying
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

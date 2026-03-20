'use client';

/**
 * Main map component using Mapbox GL JS.
 * Renders vessel positions as GeoJSON points on a dark-themed map.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-06, MAP-07, INTL-01, ANOM-01
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useVesselStore } from '@/stores/vessel';
import { vesselsToGeoJSON } from '@/lib/map/geojson';
import { filterTankers } from '@/lib/map/filter';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import type { VesselWithPosition } from '@/types/vessel';
import type { VesselWithSanctions } from '@/lib/db/sanctions';

// Set Mapbox token from environment
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export function VesselMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [vessels, setVessels] = useState<VesselWithSanctions[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { tankersOnly, setSelectedVessel, setLastUpdate, selectedVessel, showTrack, mapCenter, setMapCenter, anomalyFilter } =
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

      // Add vessel source (empty initially)
      map.current.addSource('vessels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Vessel circle layer - anomaly colors take priority, then sanctions, then tankers
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
            // Priority 6: Sanctioned vessels (red)
            ['==', ['get', 'isSanctioned'], true],
            '#ef4444',
            // Priority 7: Tankers (amber)
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

      // Chokepoint bounding box overlays
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

      // Click handler for vessel selection
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

      // Cursor change on hover
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

      setMapLoaded(true);
    });

    // Cleanup
    return () => {
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

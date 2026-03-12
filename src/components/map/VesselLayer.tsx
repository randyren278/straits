'use client';

/**
 * Vessel layer component for rendering vessel markers.
 * Uses Mapbox GeoJSON source with circle layer.
 * Requirements: MAP-01
 */
import { useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import { vesselsToGeoJSON } from '@/lib/map/geojson';
import type { VesselWithPosition } from '@/types/vessel';

interface VesselLayerProps {
  map: mapboxgl.Map | null;
  vessels: VesselWithPosition[];
}

/**
 * Updates the vessel layer on the map with new data.
 * This is a utility component that can be used for more complex
 * layer management separate from VesselMap.
 */
export function VesselLayer({ map, vessels }: VesselLayerProps) {
  useEffect(() => {
    if (!map?.isStyleLoaded()) return;

    const geojson = vesselsToGeoJSON(vessels);
    const source = map.getSource('vessels') as mapboxgl.GeoJSONSource;

    if (source) {
      source.setData(geojson);
    }
  }, [map, vessels]);

  return null;
}

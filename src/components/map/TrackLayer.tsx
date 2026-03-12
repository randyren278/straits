'use client';

/**
 * Track layer component for rendering vessel track history.
 * Displays a LineString from position history.
 * Requirements: MAP-04
 */
import { useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import { useVesselStore } from '@/stores/vessel';
import { buildTrackLine } from '@/lib/map/tracks';
import type { VesselPosition } from '@/types/vessel';

interface TrackLayerProps {
  map: mapboxgl.Map | null;
}

/**
 * Renders the track history for the selected vessel.
 * Fetches position history and renders as a LineString.
 */
export function TrackLayer({ map }: TrackLayerProps) {
  const { selectedVessel, showTrack } = useVesselStore();

  useEffect(() => {
    if (!map?.isStyleLoaded()) return;

    // Remove existing track if present
    if (map.getLayer('vessel-track')) {
      map.removeLayer('vessel-track');
    }
    if (map.getSource('vessel-track')) {
      map.removeSource('vessel-track');
    }

    // Exit if no vessel selected or track not shown
    if (!selectedVessel || !showTrack) return;

    async function loadTrack() {
      try {
        const res = await fetch(`/api/positions/${selectedVessel!.mmsi}?hours=24`);
        const data = await res.json();
        const trackLine = buildTrackLine(data.positions as VesselPosition[]);

        if (!trackLine || !map) return;

        map.addSource('vessel-track', {
          type: 'geojson',
          data: trackLine,
        });

        map.addLayer({
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
    }

    loadTrack();
  }, [map, selectedVessel, showTrack]);

  return null;
}

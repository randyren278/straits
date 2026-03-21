/**
 * Spiderfy: fan out co-located vessel points into a readable circular arrangement.
 *
 * When vessels are at the same port, anchorage, or chokepoint and share
 * identical coordinates, clustering can't resolve them with more zoom.
 * Spiderfying renders them in a radial pattern around the cluster center,
 * connected by thin "leg" lines back to the true position.
 *
 * Bloomberg-terminal aesthetic: amber legs, white stroke circles, dark fill.
 */
import type mapboxgl from 'mapbox-gl';

const SPIDER_SOURCE = 'spider-source';
const SPIDER_LEGS_SOURCE = 'spider-legs-source';

/** Layer IDs used by spiderfy — exported so VesselMap can include them in queryRenderedFeatures */
export const SPIDER_LAYER_IDS = ['spider-circles', 'spider-legs', 'spider-labels'] as const;

/**
 * Compute spider point positions arranged in a circle around a center.
 * For <= 10 vessels: single ring.
 * For > 10: concentric rings to avoid overlap.
 *
 * @param center - [lng, lat] of the cluster
 * @param count - number of vessel points to arrange
 * @param zoom - current map zoom (affects radius in degrees)
 * @returns Array of [lng, lat] positions for each vessel
 */
function computeSpiderPositions(
  center: [number, number],
  count: number,
  zoom: number
): [number, number][] {
  // Base radius in degrees — shrinks at higher zoom for tighter layout
  // At zoom 10 ≈ 0.005°, at zoom 16 ≈ 0.0002°
  const baseRadius = 0.15 / Math.pow(2, zoom - 3);

  const positions: [number, number][] = [];
  const maxPerRing = 10;
  let remaining = count;
  let ringIndex = 0;

  while (remaining > 0) {
    const ringCount = Math.min(remaining, maxPerRing + ringIndex * 5);
    const radius = baseRadius * (1 + ringIndex * 0.7);
    const angleStep = (2 * Math.PI) / ringCount;
    // Offset each ring by half a step so points don't overlap radially
    const angleOffset = ringIndex * (angleStep / 2);

    for (let i = 0; i < ringCount && positions.length < count; i++) {
      const angle = angleOffset + i * angleStep - Math.PI / 2; // Start from top
      const lng = center[0] + radius * Math.cos(angle);
      const lat = center[1] + radius * Math.sin(angle);
      positions.push([lng, lat]);
    }

    remaining -= ringCount;
    ringIndex++;
  }

  return positions;
}

/**
 * Render spider legs + vessel circles for a set of cluster leaves.
 * Creates temporary GeoJSON sources and layers that overlay the cluster.
 *
 * @param map - Mapbox GL map instance
 * @param center - [lng, lat] of the cluster center
 * @param leaves - GeoJSON features from getClusterLeaves
 */
export function spiderfyCluster(
  map: mapboxgl.Map,
  center: [number, number],
  leaves: GeoJSON.Feature<GeoJSON.Geometry>[]
): void {
  const zoom = map.getZoom();
  const positions = computeSpiderPositions(center, leaves.length, zoom);

  // Build spider point features with original vessel properties
  const spiderPoints: GeoJSON.Feature<GeoJSON.Point>[] = leaves.map((leaf, i) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: positions[i],
    },
    properties: {
      ...leaf.properties,
      _spiderIndex: i,
    },
  }));

  // Build leg line features connecting center to each spider point
  const legLines: GeoJSON.Feature<GeoJSON.LineString>[] = positions.map((pos, i) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [center, pos],
    },
    properties: { _spiderIndex: i },
  }));

  // Add sources
  map.addSource(SPIDER_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: spiderPoints },
  });

  map.addSource(SPIDER_LEGS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: legLines },
  });

  // Leg lines — thin amber dashes
  map.addLayer({
    id: 'spider-legs',
    type: 'line',
    source: SPIDER_LEGS_SOURCE,
    paint: {
      'line-color': '#f59e0b',
      'line-width': 1,
      'line-opacity': 0.4,
      'line-dasharray': [2, 2],
    },
  });

  // Spider vessel circles — same color logic as unclustered circles
  map.addLayer({
    id: 'spider-circles',
    type: 'circle',
    source: SPIDER_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': [
        'case',
        // Anomaly colors
        ['all',
          ['==', ['get', 'anomalyType'], 'going_dark'],
          ['==', ['get', 'anomalyConfidence'], 'confirmed']
        ],
        '#ef4444',
        ['all',
          ['==', ['get', 'anomalyType'], 'going_dark'],
          ['==', ['get', 'anomalyConfidence'], 'suspected']
        ],
        '#eab308',
        ['==', ['get', 'anomalyType'], 'loitering'],
        '#f97316',
        ['==', ['get', 'anomalyType'], 'speed'],
        '#3b82f6',
        ['==', ['get', 'anomalyType'], 'deviation'],
        '#a855f7',
        // Sanctions
        ['==', ['get', 'isSanctioned'], true],
        '#ef4444',
        // Tankers
        ['all', ['>=', ['get', 'shipType'], 80], ['<=', ['get', 'shipType'], 89]],
        '#f59e0b',
        // Default
        '#6b7280',
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  });

  // Vessel name labels next to spider circles
  map.addLayer({
    id: 'spider-labels',
    type: 'symbol',
    source: SPIDER_SOURCE,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ['get', 'mmsi']],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': 10,
      'text-anchor': 'left',
      'text-offset': [1, 0],
      'text-max-width': 12,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#d1d5db',
      'text-halo-color': '#000000',
      'text-halo-width': 1,
    },
  });
}

/**
 * Remove all spider legs and points from the map.
 * Safe to call even if no spider is currently displayed.
 */
export function clearSpiderLegs(map: mapboxgl.Map): void {
  for (const layerId of SPIDER_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }
  if (map.getSource(SPIDER_SOURCE)) {
    map.removeSource(SPIDER_SOURCE);
  }
  if (map.getSource(SPIDER_LEGS_SOURCE)) {
    map.removeSource(SPIDER_LEGS_SOURCE);
  }
}

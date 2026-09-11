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
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import { useVesselStore } from '@/stores/vessel';
import { vesselsToGeoJSON } from '@/lib/map/geojson';
import { filterTankers } from '@/lib/map/filter';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import { AIS_COVERAGE } from '@/lib/geo/coverage-constants';
import {
  ACTIVITY_COLOR_EXPRESSION,
  IDENTITY_STROKE_COLOR_EXPRESSION,
  IDENTITY_STROKE_WIDTH_EXPRESSION,
  freshnessOpacityExpression,
} from '@/lib/map/marker-style';
import { BASEMAP_CLUTTER_PATTERN } from '@/lib/map/basemap';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import type { ClusterVessel, MapCenter } from '@/stores/vessel';

/**
 * Keyless dark basemap style (CARTO dark-matter, GL-compatible).
 * No API token required — served free by CARTO's basemaps CDN.
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// MapLibre v6 is ESM-only. Next/Turbopack cannot emit the worker beside its
// shared module, so predev/prebuild copy both files to this stable public URL.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

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

type VesselLoadState = 'loading' | 'ready' | 'empty' | 'error';

const VESSEL_LOAD_COPY: Record<VesselLoadState, { title: string; detail: string }> = {
  loading: { title: 'AIS / ACQUIRING POSITIONS', detail: 'AWAITING FIRST FIX' },
  ready: { title: 'POSITIONS ACQUIRED', detail: 'RENDER CONFIRMED' },
  empty: { title: 'NO LIVE VESSEL POSITIONS', detail: 'AIS RESPONSE RETURNED NO POSITIONS' },
  error: { title: 'VESSEL FEED UNAVAILABLE · RETRYING', detail: 'MAP ONLINE · NEXT REQUEST IN 30S' },
};

export function VesselMap({ initialCenter }: { initialCenter?: MapCenter } = {}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const acceptedResponseSequenceRef = useRef(0);
  const firstRequestAttemptedRef = useRef(false);
  const mapInstanceSequenceRef = useRef(0);
  const [vessels, setVessels] = useState<VesselWithSanctions[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [vesselLoadState, setVesselLoadState] = useState<VesselLoadState>('loading');

  const {
    tankersOnly, setSelectedVessel, setLastUpdate, setLastObservation, setTrackStatus,
    selectedVessel, showTrack, mapCenter, setMapCenter, anomalyFilter, targetVesselImo, setTargetVesselImo,
  } = useVesselStore();

  /**
   * Submit a response to MapLibre and only settle the initial loading state
   * after the source has been submitted and the map has rendered that update.
   * This covers both orderings: the map can load first, or the data can arrive
   * first and wait for the map's `load` callback.
   */
  const submitVesselGeoJson = useCallback((nextVessels: VesselWithSanctions[], responseSequence: number) => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoadedRef.current) return;

    const source = mapInstance.getSource('vessels') as GeoJSONSource | undefined;
    if (!source) return;

    let filtered = filterTankers(nextVessels, tankersOnly);
    if (anomalyFilter) {
      filtered = filtered.filter((v) => v.anomalyType !== null && v.anomalyType !== undefined);
    }

    // Register before setData: MapLibre emits idle after the source update has
    // been rendered, which is the point at which it is safe to remove the HUD.
    const mapSequence = mapInstanceSequenceRef.current;
    mapInstance.once('idle', () => {
      if (
        map.current !== mapInstance ||
        !mapLoadedRef.current ||
        mapSequence !== mapInstanceSequenceRef.current ||
        responseSequence !== acceptedResponseSequenceRef.current
      ) return;

      setVesselLoadState(nextVessels.length > 0 ? 'ready' : 'empty');
    });

    source.setData(vesselsToGeoJSON(filtered));
  }, [anomalyFilter, tankersOnly]);

  // ─── Proximity detection ────────────────────────────────────────
  // After zooming/panning, find groups of vessels that overlap on screen.
  // When a dense group is found near map center, auto-populate the sidebar.
  const detectProximityGroup = useCallback(() => {
    if (!map.current || !mapLoadedRef.current) return;
    if (!map.current.isStyleLoaded()) return;
    if (map.current.getZoom() < PROXIMITY_MIN_ZOOM) {
      // Too zoomed out — clear any existing cluster panel
      useVesselStore.getState().setClusterVessels(null);
      return;
    }

    // Query all rendered vessel features in the viewport
    const canvas = map.current.getCanvas();
    let features: MapGeoJSONFeature[];
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
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    let mapInstance: MapLibreMap;
    try {
      mapInstance = new MapLibreMap({
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
    const mapSequence = mapInstanceSequenceRef.current + 1;
    mapInstanceSequenceRef.current = mapSequence;

    // Named handler refs so the cleanup can detach each listener explicitly
    // (prevents handler accumulation across React Strict Mode re-mounts).
    const handleClick = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
      // The fix's own observation time, carried through the GeoJSON properties.
      // Falling back to "now" here is what made every selected contact read as
      // observed "less than a minute ago" regardless of its real age.
      const observedAt = props?.time ? new Date(props.time) : null;
      const observed = observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt : new Date();

      const vessel: VesselWithSanctions = {
        imo: props?.imo || null,
        mmsi: props?.mmsi || '',
        name: props?.name || null,
        flag: props?.flag || null,
        shipType: props?.shipType ?? null,
        destination: props?.destination || null,
        lastSeen: observed,
        isSanctioned: props?.isSanctioned || false,
        sanctioningAuthority: props?.sanctioningAuthority || null,
        sanctionReason: null,
        sanctionRiskCategory: props?.sanctionRiskCategory || null,
        anomalyType: props?.anomalyType || null,
        anomalyConfidence: props?.anomalyConfidence || null,
        position: {
          time: observed,
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
    const handleMoveEnd = () => {
      detectProximityGroup();
      // Keep the store's notion of the viewport current for shareable links.
      try {
        const c = mapInstance.getCenter();
        useVesselStore.getState().setViewport({ lat: c.lat, lon: c.lng, zoom: mapInstance.getZoom() });
      } catch {
        // Not fatal; the link simply omits the view.
      }
    };

    mapInstance.on('load', () => {
      if (map.current !== mapInstance) return;

      // ─── Vessel source — NO clustering ─────────────────────────
      // Every vessel renders as its own dot at all zoom levels.
      // Guard against duplicate ids if the style ever reloads.
      if (!mapInstance.getSource('vessels')) {
        mapInstance.addSource('vessels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      // ─── Vessel circles — always visible ───────────────────────
      if (!mapInstance.getLayer('vessel-circles')) {
        mapInstance.addLayer({
          id: 'vessel-circles',
          type: 'circle',
          source: 'vessels',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 10, 8],
            // Three independent channels (see src/lib/map/marker-style.ts):
            //   fill    = activity (what the vessel is doing right now)
            //   outline = identity (what lists it is on)
            //   opacity = freshness (how old the fix is)
            // Red used to mean both "sanctioned" and "going dark confirmed";
            // purple meant both "shadow fleet" and "route deviation".
            'circle-color': ACTIVITY_COLOR_EXPRESSION,
            'circle-stroke-color': IDENTITY_STROKE_COLOR_EXPRESSION,
            'circle-stroke-width': IDENTITY_STROKE_WIDTH_EXPRESSION,
            'circle-opacity': freshnessOpacityExpression(null),
            'circle-stroke-opacity': freshnessOpacityExpression(null),
          },
        });
      }

      // ─── Heading indicators ────────────────────────────────────
      // A small chevron ahead of the dot, only where AIS reports a real
      // heading (511 = unavailable) and the vessel is actually under way.
      // Stationary or heading-less contacts get no arrow rather than a
      // misleading one.
      try {
        if (!mapInstance.hasImage('vessel-heading')) {
          const size = 32;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(size / 2, 2);
            ctx.lineTo(size / 2 + 7, 16);
            ctx.lineTo(size / 2, 12);
            ctx.lineTo(size / 2 - 7, 16);
            ctx.closePath();
            ctx.fill();
            mapInstance.addImage('vessel-heading', ctx.getImageData(0, 0, size, size), { sdf: true });
          }
        }
        if (mapInstance.hasImage('vessel-heading') && !mapInstance.getLayer('vessel-headings')) {
          mapInstance.addLayer({
            id: 'vessel-headings',
            type: 'symbol',
            source: 'vessels',
            minzoom: 7,
            filter: ['all',
              ['has', 'heading'],
              ['<', ['coalesce', ['get', 'heading'], 511], 360],
              ['>', ['coalesce', ['get', 'speed'], 0], 0.5],
            ],
            layout: {
              'icon-image': 'vessel-heading',
              'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.35, 12, 0.6],
              'icon-rotate': ['get', 'heading'],
              'icon-rotation-alignment': 'map',
              'icon-offset': [0, -22],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: { 'icon-color': '#ffffff', 'icon-opacity': 0.75 },
          });
        }
      } catch {
        // Canvas or image support missing (tests, headless); dots still render.
      }

      // ─── Selection lock ────────────────────────────────────────
      // A restrained ring around the acquired contact; the filter is set on
      // selection change (see the selection effect below).
      if (!mapInstance.getLayer('vessel-selected-ring')) {
        mapInstance.addLayer({
          id: 'vessel-selected-ring',
          type: 'circle',
          source: 'vessels',
          filter: ['==', ['get', 'mmsi'], '__none__'],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 9, 10, 16],
            'circle-color': '#f59e0b',
            'circle-opacity': 0.08,
            'circle-stroke-color': '#f59e0b',
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 0.95,
          },
        });
      }

      // ─── Monitored coverage ────────────────────────────────────
      // The harvester's subscription boxes. Outside these, an empty sea means
      // "not watched", not "no traffic".
      const coverageFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = AIS_COVERAGE.map((b, i) => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [b.minLon, b.minLat], [b.maxLon, b.minLat], [b.maxLon, b.maxLat], [b.minLon, b.maxLat], [b.minLon, b.minLat],
          ]],
        },
        properties: { index: i },
      }));
      if (!mapInstance.getSource('coverage')) {
        mapInstance.addSource('coverage', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: coverageFeatures },
        });
      }
      if (!mapInstance.getLayer('coverage-outline')) {
        mapInstance.addLayer({
          id: 'coverage-outline',
          type: 'line',
          source: 'coverage',
          paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-opacity': 0.14, 'line-dasharray': [1, 3] },
        }, 'vessel-circles');
      }

      // ─── Basemap declutter ─────────────────────────────────────
      // This is a maritime picture: inland roads, buildings and POIs compete
      // with the contacts for attention at operational zooms. Water, coast,
      // country/major-city labels stay.
      try {
        for (const layer of mapInstance.getStyle()?.layers ?? []) {
          if (BASEMAP_CLUTTER_PATTERN.test(layer.id)) {
            mapInstance.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        }
      } catch {
        // Style introspection is best-effort; a basemap change must not break the map.
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

      if (!mapInstance.getSource('chokepoints')) {
        mapInstance.addSource('chokepoints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: chokepointFeatures },
        });
      }

      if (!mapInstance.getLayer('chokepoint-fill')) {
        mapInstance.addLayer({
          id: 'chokepoint-fill',
          type: 'fill',
          source: 'chokepoints',
          paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.04 },
        }, 'vessel-circles');
      }

      if (!mapInstance.getLayer('chokepoint-outline')) {
        mapInstance.addLayer({
          id: 'chokepoint-outline',
          type: 'line',
          source: 'chokepoints',
          paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [4, 3] },
        }, 'vessel-circles');
      }

      if (!mapInstance.getLayer('chokepoint-labels')) {
        mapInstance.addLayer({
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
      mapInstance.on('click', 'vessel-circles', handleClick);
      mapInstance.on('mouseenter', 'vessel-circles', handleMouseEnter);
      mapInstance.on('mouseleave', 'vessel-circles', handleMouseLeave);

      // ─── Proximity detection on zoom/pan ──────────────────────
      // After the map settles, detect dense vessel groups and auto-
      // populate the sidebar panel.
      mapInstance.on('moveend', handleMoveEnd);

      // A user can copy a contact link before ever panning. Seed the current
      // view as soon as the map is usable so that link still carries the map
      // position promised by the dossier action.
      try {
        const c = mapInstance.getCenter();
        useVesselStore.getState().setViewport({ lat: c.lat, lon: c.lng, zoom: mapInstance.getZoom() });
      } catch {
        // Map remains usable; copied links will omit the view until moveend.
      }

      mapLoadedRef.current = true;
      setMapLoaded(true);
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
      mapLoadedRef.current = false;
      mapInstanceSequenceRef.current = mapSequence + 1;
      map.current = null;
    };
  }, [setSelectedVessel, detectProximityGroup, initialCenter]);

  // Fetch vessels periodically
  useEffect(() => {
    let cancelled = false;

    async function fetchVessels() {
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;

      try {
        const res = await fetch(`/api/vessels?tankersOnly=${tankersOnly}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch vessels: ${res.status}`);
        }
        const data = await res.json();
        if (cancelled || controller.signal.aborted || requestSequence !== requestSequenceRef.current) return;

        const nextVessels = data.vessels || [];
        acceptedResponseSequenceRef.current += 1;
        const isFirstRequest = !firstRequestAttemptedRef.current;
        firstRequestAttemptedRef.current = true;
        setVessels(nextVessels);
        setLastUpdate(new Date(data.timestamp));
        setLastObservation(data.latestObservation ? new Date(data.latestObservation) : null);
        // Keep the HUD until submitVesselGeoJson has handed this response to
        // MapLibre and the following idle event confirms it was rendered.
        if (isFirstRequest) setVesselLoadState('loading');
      } catch (err) {
        if (cancelled || controller.signal.aborted || requestSequence !== requestSequenceRef.current) return;
        firstRequestAttemptedRef.current = true;
        setVesselLoadState((current) => current === 'loading' ? 'error' : current);
        console.error('Failed to fetch vessels:', err);
      }
    }

    void fetchVessels();
    const interval = setInterval(fetchVessels, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      requestControllerRef.current?.abort();
      requestSequenceRef.current += 1;
    };
  }, [tankersOnly, setLastUpdate, setLastObservation]);

  // Update map data when vessels change (or anomaly filter changes)
  useEffect(() => {
    if (!map.current || !mapLoaded || acceptedResponseSequenceRef.current === 0) return;

    submitVesselGeoJson(vessels, acceptedResponseSequenceRef.current);

    // Re-run proximity detection after data update
    detectProximityGroup();
  }, [vessels, mapLoaded, submitVesselGeoJson, detectProximityGroup]);

  // Handle track layer for selected vessel
  const TRACK_HOURS = 24;
  const updateTrackLayer = useCallback(async () => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer('vessel-track')) {
      map.current.removeLayer('vessel-track');
    }
    if (map.current.getSource('vessel-track')) {
      map.current.removeSource('vessel-track');
    }

    if (!selectedVessel || !showTrack) return;

    // Every outcome is reported to the store so the panel can distinguish
    // "loading", "no observations in the window", "request failed" and "drawn".
    setTrackStatus({ state: 'loading' });
    const mmsi = selectedVessel.mmsi;
    try {
      const res = await fetch(`/api/positions/${mmsi}?hours=${TRACK_HOURS}`);
      if (!res.ok) throw new Error(`Failed to load track: ${res.status}`);
      const data = await res.json();
      const positions = data.positions || [];

      // Selection changed while the request was in flight — drop it.
      if (useVesselStore.getState().selectedVessel?.mmsi !== mmsi || !map.current) return;

      if (positions.length < 2) {
        setTrackStatus({ state: 'empty', hours: TRACK_HOURS });
        return;
      }

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
        properties: { mmsi },
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
      }, 'vessel-circles');
      setTrackStatus({ state: 'ready', count: positions.length, hours: TRACK_HOURS });
    } catch (err) {
      console.error('Failed to load track:', err);
      if (useVesselStore.getState().selectedVessel?.mmsi === mmsi) {
        setTrackStatus({ state: 'error' });
      }
    }
  }, [selectedVessel, showTrack, mapLoaded, setTrackStatus]);

  useEffect(() => {
    updateTrackLayer();
  }, [updateTrackLayer]);

  // Selection lock: ring the acquired contact and let the rest of the field
  // recede. Opacity stays freshness-weighted for every marker.
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const selectedMmsi = selectedVessel?.mmsi ?? null;
    try {
      map.current.setFilter('vessel-selected-ring', ['==', ['get', 'mmsi'], selectedMmsi ?? '__none__']);
      map.current.setPaintProperty('vessel-circles', 'circle-opacity', freshnessOpacityExpression(selectedMmsi));
      map.current.setPaintProperty('vessel-circles', 'circle-stroke-opacity', freshnessOpacityExpression(selectedMmsi));
    } catch {
      // Layers not present yet (style still loading); the load handler sets defaults.
    }
  }, [selectedVessel, mapLoaded]);

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
          <div className="mt-2 text-xs text-gray-600">WebGL2 required for map rendering</div>
        </div>
      </div>
    );
  }

  const vesselLoadCopy = VESSEL_LOAD_COPY[vesselLoadState];
  const vesselsReady = vesselLoadState === 'ready';
  const hudAlert = vesselLoadState === 'error';

  return (
    <div
      data-testid="vessel-map"
      data-map-state={mapLoaded ? 'ready' : 'loading'}
      data-vessel-state={vesselLoadState}
      data-vessel-count={vessels.length}
      aria-busy={vesselLoadState === 'loading' ? true : undefined}
      className="relative w-full h-full"
    >
      <div
        ref={mapContainer}
        data-testid="vessel-map-surface"
        data-reveal-state={vesselsReady ? 'ready' : 'covered'}
        className="straits-map-surface w-full h-full"
      />

      <div
        data-testid="vessel-loading-overlay"
        data-reveal-state={vesselsReady ? 'ready' : 'covered'}
        aria-hidden={vesselsReady ? true : undefined}
        className="straits-map-loading-overlay pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4"
      >
        <div
          data-testid="vessel-loading-hud"
          className="straits-map-loading-hud w-full max-w-[19rem] border border-amber-500/40 border-l-2 border-l-amber-500 bg-black/92 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
        >
          <div
            role="status"
            aria-live="polite"
            className={`font-mono uppercase tracking-widest ${hudAlert ? 'text-red-400' : 'text-amber-500'}`}
          >
            <p className="text-[9px] text-amber-500/60">{mapLoaded ? 'MAP ONLINE' : 'MAP INITIALIZING'}</p>
            <p className="text-[10px]">{vesselLoadCopy.title}</p>
            <p className="mt-1 text-[9px] tracking-wider text-gray-500">{vesselLoadCopy.detail}</p>
          </div>

          <div
            aria-hidden="true"
            className="straits-acquisition-signal mt-2 flex gap-1"
          >
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={`${vesselLoadState === 'loading' ? 'straits-acquisition-bar' : 'straits-acquisition-bar-static'} h-0.5 w-5 bg-gray-700`}
              />
            ))}
          </div>
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {vesselsReady ? `${vessels.length} vessel position${vessels.length === 1 ? '' : 's'} loaded` : ''}
      </span>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import { PARALLEL_SEAS_ROUTES, calculateParallelSeasScenario } from '@/lib/scenarios/parallel-seas';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
setWorkerUrl(`/maplibre/v${process.env.NEXT_PUBLIC_MAPLIBRE_VERSION}/maplibre-gl-worker.mjs`);

type HighlightedRoute = 'both' | 'suez' | 'cape';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const dayFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function routeGeoJson(index: number) {
  const route = PARALLEL_SEAS_ROUTES[index];
  return {
    type: 'Feature' as const,
    properties: { route: route.id },
    geometry: {
      type: 'LineString' as const,
      coordinates: route.waypoints.map(({ coordinate }) => [coordinate[0], coordinate[1]]),
    },
  };
}

function projectRoute(coordinates: readonly (readonly [number, number])[]): string {
  return coordinates.map(([longitude, latitude]) => {
    const x = ((longitude + 23) / 102) * 1000;
    const y = ((55 - latitude) / 95) * 500;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function RouteSketch({ highlighted }: { highlighted: HighlightedRoute }) {
  const suez = projectRoute(PARALLEL_SEAS_ROUTES[0].waypoints.map(({ coordinate }) => coordinate));
  const cape = projectRoute(PARALLEL_SEAS_ROUTES[1].waypoints.map(({ coordinate }) => coordinate));
  return (
    <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="1000" height="500" fill="#071015" />
      {[100, 200, 300, 400].map((y) => <line key={`lat-${y}`} x1="0" x2="1000" y1={y} y2={y} stroke="#132129" strokeWidth="1" />)}
      {[200, 400, 600, 800].map((x) => <line key={`lon-${x}`} x1={x} x2={x} y1="0" y2="500" stroke="#132129" strokeWidth="1" />)}
      <polyline points={suez} fill="none" stroke="#e6a23c" strokeWidth={highlighted === 'cape' ? 2 : 3.6} strokeOpacity={highlighted === 'cape' ? 0.24 : 0.98} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={cape} fill="none" stroke="#58c4a3" strokeWidth={highlighted === 'suez' ? 2 : 3.6} strokeOpacity={highlighted === 'suez' ? 0.24 : 0.98} strokeLinecap="round" strokeLinejoin="round" />
      {[[72.85, 18.93, 'MUMBAI'], [32.55, 29.95, 'SUEZ'], [18.4, -34.4, 'CAPE'], [4.48, 51.92, 'ROTTERDAM']].map(([longitude, latitude, label]) => {
        const x = ((Number(longitude) + 23) / 102) * 1000;
        const y = ((55 - Number(latitude)) / 95) * 500;
        return <g key={String(label)}><circle cx={x} cy={y} r="5" fill="#f3f4f6" stroke="#071015" strokeWidth="2" /><text x={x + 8} y={y + 4} fill="#d1d5db" fontSize="12" fontFamily="monospace">{label}</text></g>;
      })}
    </svg>
  );
}

function RouteMap({ highlighted }: { highlighted: HighlightedRoute }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!element.current || map.current) return;
    let instance: MapLibreMap;
    try {
      instance = new MapLibreMap({
        container: element.current,
        style: MAP_STYLE,
        attributionControl: { compact: true },
        interactive: false,
        cooperativeGestures: false,
        bounds: [[-22, -38], [77, 54]],
        fitBoundsOptions: { padding: 30, maxZoom: 2.8, duration: 0 },
      });
    } catch {
      // MapLibre construction touches browser WebGL APIs that can be unavailable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(true);
      return;
    }
    map.current = instance;
    instance.on('error', () => setMapError(true));
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(element.current);
    const resizeFrame = requestAnimationFrame(() => instance.resize());
    instance.once('load', () => {
      instance.addSource('parallel-seas-suez', { type: 'geojson', data: routeGeoJson(0) });
      instance.addSource('parallel-seas-cape', { type: 'geojson', data: routeGeoJson(1) });
      instance.addLayer({
        id: 'parallel-seas-suez-line',
        type: 'line',
        source: 'parallel-seas-suez',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#e6a23c', 'line-width': 3, 'line-opacity': 0.9 },
      });
      instance.addLayer({
        id: 'parallel-seas-cape-line',
        type: 'line',
        source: 'parallel-seas-cape',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#58c4a3', 'line-width': 3, 'line-opacity': 0.9 },
      });
      const waypointSource = {
        type: 'FeatureCollection' as const,
        features: [
          { type: 'Feature' as const, properties: { name: 'MUMBAI', kind: 'port' }, geometry: { type: 'Point' as const, coordinates: [72.85, 18.93] } },
          { type: 'Feature' as const, properties: { name: 'SUEZ', kind: 'chokepoint' }, geometry: { type: 'Point' as const, coordinates: [32.55, 29.95] } },
          { type: 'Feature' as const, properties: { name: 'CAPE', kind: 'chokepoint' }, geometry: { type: 'Point' as const, coordinates: [18.4, -34.4] } },
          { type: 'Feature' as const, properties: { name: 'ROTTERDAM', kind: 'port' }, geometry: { type: 'Point' as const, coordinates: [4.48, 51.92] } },
        ],
      };
      instance.addSource('parallel-seas-points', { type: 'geojson', data: waypointSource });
      instance.addLayer({
        id: 'parallel-seas-points',
        type: 'circle',
        source: 'parallel-seas-points',
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'port', 4, 3],
          'circle-color': ['match', ['get', 'kind'], 'port', '#f3f4f6', '#e6a23c'],
          'circle-stroke-color': '#0a0b0c',
          'circle-stroke-width': 1,
        },
      });
      instance.addLayer({
        id: 'parallel-seas-point-labels',
        type: 'symbol',
        source: 'parallel-seas-points',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 9,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: { 'text-color': '#d1d5db', 'text-halo-color': '#050607', 'text-halo-width': 1.2 },
      });
      setReady(true);
      instance.once('idle', () => {
        if (instance.queryRenderedFeatures({ layers: ['parallel-seas-suez-line', 'parallel-seas-cape-line'] }).length === 0) {
          setMapError(true);
        }
      });
    });
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const selectedOpacity = highlighted === 'both' ? 0.9 : 1;
    const mutedOpacity = highlighted === 'both' ? 0.9 : 0.2;
    const suezActive = highlighted === 'both' || highlighted === 'suez';
    const capeActive = highlighted === 'both' || highlighted === 'cape';
    instance.setPaintProperty('parallel-seas-suez-line', 'line-opacity', suezActive ? selectedOpacity : mutedOpacity);
    instance.setPaintProperty('parallel-seas-cape-line', 'line-opacity', capeActive ? selectedOpacity : mutedOpacity);
    instance.setPaintProperty('parallel-seas-suez-line', 'line-width', highlighted === 'suez' ? 4 : 3);
    instance.setPaintProperty('parallel-seas-cape-line', 'line-width', highlighted === 'cape' ? 4 : 3);
  }, [highlighted, ready]);

  return (
    <figure className="min-w-0 border border-gray-800 bg-[#080a0c]" aria-label="Approximate route map from Mumbai to Rotterdam">
      <div className="relative h-[320px] roomy:h-[420px]">
        <div ref={element} className={`absolute inset-0 h-full w-full ${mapError ? 'opacity-0' : ''}`} aria-hidden="true" />
        {mapError && <RouteSketch highlighted={highlighted} />}
        {mapError && (
          <div className="absolute inset-x-2 bottom-2 border border-gray-700 bg-black/90 px-3 py-2 text-center">
            <p className="text-[10px] leading-4 text-gray-400">
              The map renderer could not show the route layers. This schematic preserves the approximate comparison.
            </p>
          </div>
        )}
        {!ready && !mapError && (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Loading route map</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-x-4 gap-y-1 border border-gray-800 bg-black/85 px-3 py-2 text-[10px] font-mono uppercase tracking-wide">
          <span className="flex items-center gap-2 text-amber-400"><i className="h-0.5 w-5 bg-amber-400" /> Suez baseline</span>
          <span className="flex items-center gap-2 text-emerald-300"><i className="h-0.5 w-5 bg-emerald-300" /> Cape diversion</span>
        </div>
      </div>
      <figcaption className="border-t border-gray-800 px-3 py-2 text-[10px] leading-4 text-gray-500">
        Fixed waypoint sketch for comparison. Haversine leg sums approximate route length; this is not navigational guidance.
      </figcaption>
    </figure>
  );
}

function ScenarioInput({
  id,
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-gray-500">{label}</label>
      <div className="flex items-center border border-gray-700 bg-black focus-within:border-amber-500/70">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm tabular-nums text-gray-100 outline-none"
        />
        <span className="pr-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">{unit}</span>
      </div>
      <p className="mt-1 text-[10px] text-gray-600">Range {min}–{max}</p>
    </div>
  );
}

export function ParallelSeasWorkbench({
  initialSpeedKnots,
  initialClosureDelayDays,
}: {
  initialSpeedKnots: number;
  initialClosureDelayDays: number;
}) {
  const [speedInput, setSpeedInput] = useState(String(initialSpeedKnots));
  const [delayInput, setDelayInput] = useState(String(initialClosureDelayDays));
  const [highlighted, setHighlighted] = useState<HighlightedRoute>('both');
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const scenario = useMemo(() => {
    if (speedInput.trim() === '' || delayInput.trim() === '') return null;
    const speedKnots = Number(speedInput);
    const closureDelayDays = Number(delayInput);
    try {
      return calculateParallelSeasScenario({ speedKnots, closureDelayDays });
    } catch {
      return null;
    }
  }, [delayInput, speedInput]);

  async function copyScenarioLink() {
    if (!scenario) return;
    const url = new URL(window.location.href);
    url.searchParams.set('speed', speedInput);
    url.searchParams.set('delay', delayInput);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareUrl(null);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setLinkCopied(false);
      setShareUrl(url.toString());
    }
  }

  const timeComparison = scenario
    ? scenario.capeTimeSavedVsWaitDays > 0
      ? `Cape is ${dayFormat.format(scenario.capeTimeSavedVsWaitDays)} days faster under these assumptions.`
      : scenario.capeTimeSavedVsWaitDays < 0
        ? `Waiting is ${dayFormat.format(Math.abs(scenario.capeTimeSavedVsWaitDays))} days faster under these assumptions.`
        : 'Both options take the same modeled time.'
    : 'Correct the inputs to compare modeled passage times.';

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 desk:grid-cols-[minmax(0,1fr)_310px] gap-4" aria-label="Editable route comparison">
        <div className="min-w-0 space-y-3">
          <RouteMap highlighted={highlighted} />
          <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-800 px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Emphasize route</span>
            <div className="flex gap-1" role="group" aria-label="Emphasize route on map">
              {(['both', 'suez', 'cape'] as const).map((route) => (
                <button
                  key={route}
                  type="button"
                  aria-pressed={highlighted === route}
                  onClick={() => setHighlighted(route)}
                  className={`min-h-9 border px-3 text-[10px] font-mono uppercase tracking-wider transition-colors ${highlighted === route ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}
                >
                  {route}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="border border-gray-800 bg-gray-950/70" aria-label="Scenario assumptions">
          <div className="border-b border-gray-800 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500">Editable assumptions</p>
            <p className="mt-1 text-xs text-gray-500">Applied to both route estimates</p>
          </div>
          <div className="space-y-4 p-4">
            <ScenarioInput id="speed-knots" label="Average speed" unit="knots" value={speedInput} min={1} max={30} step={0.5} onChange={setSpeedInput} />
            <ScenarioInput id="closure-delay" label="Suez closure delay" unit="days" value={delayInput} min={0} max={90} step={0.5} onChange={setDelayInput} />
            <div className="border-l-2 border-amber-500/70 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-5 text-gray-400">
              Waiting assumes this full delay before sailing the Suez baseline. The Cape option assumes immediate departure and no queue on either route.
            </div>
            <button
              type="button"
              onClick={copyScenarioLink}
              disabled={!scenario}
              className="min-h-11 w-full border border-gray-700 px-3 text-xs font-mono uppercase tracking-wider text-gray-300 hover:border-amber-500/70 hover:text-amber-400 disabled:cursor-not-allowed disabled:text-gray-700"
            >
              {linkCopied ? 'Scenario link copied' : 'Copy scenario link'}
            </button>
            {shareUrl && (
              <label className="block text-[10px] leading-4 text-gray-500">
                Clipboard unavailable. Select and copy this link.
                <input readOnly aria-label="Scenario share URL" value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-1 min-h-10 w-full border border-gray-700 bg-black px-2 font-mono text-[10px] text-gray-300" />
              </label>
            )}
          </div>
        </aside>
      </section>

      {!scenario ? (
        <p role="alert" className="border border-red-900/70 bg-red-950/30 px-4 py-3 text-xs text-red-300">
          Enter a speed from 1 to 30 knots and a closure delay from 0 to 90 days.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-1 roomy:grid-cols-2 gap-3" aria-label="Passage time comparison">
            <article className="border border-amber-500/30 bg-amber-500/[0.035]">
              <div className="flex items-center justify-between border-b border-amber-500/15 px-4 py-3">
                <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400">Wait for Suez</h2>
                <span className="text-[10px] font-mono uppercase text-gray-600">Baseline route</span>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4">
                <div><p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Distance</p><p className="mt-1 text-xl font-mono tabular-nums text-gray-100">{numberFormat.format(scenario.suezDistanceNm)} <small className="text-xs text-gray-500">NM</small></p></div>
                <div><p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Passage incl. wait</p><p className="mt-1 text-xl font-mono tabular-nums text-gray-100">{dayFormat.format(scenario.waitTotalDays)} <small className="text-xs text-gray-500">days</small></p></div>
                <p className="col-span-2 text-[10px] leading-4 text-gray-600">{dayFormat.format(scenario.suezSailingDays)} modeled sailing days + {dayFormat.format(scenario.waitTotalDays - scenario.suezSailingDays)} assumed closure days.</p>
              </div>
            </article>
            <article className="border border-emerald-500/30 bg-emerald-500/[0.035]">
              <div className="flex items-center justify-between border-b border-emerald-500/15 px-4 py-3">
                <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-300">Divert via Cape</h2>
                <span className="text-[10px] font-mono uppercase text-gray-600">Alternative route</span>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4">
                <div><p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Distance</p><p className="mt-1 text-xl font-mono tabular-nums text-gray-100">{numberFormat.format(scenario.capeDistanceNm)} <small className="text-xs text-gray-500">NM</small></p></div>
                <div><p className="text-[10px] font-mono uppercase tracking-wide text-gray-500">Passage</p><p className="mt-1 text-xl font-mono tabular-nums text-gray-100">{dayFormat.format(scenario.capeSailingDays)} <small className="text-xs text-gray-500">days</small></p></div>
                <p className="col-span-2 text-[10px] leading-4 text-gray-600">+{numberFormat.format(scenario.capeExtraNm)} NM / +{dayFormat.format(scenario.capeExtraSailingDays)} sailing days versus the Suez waypoint baseline.</p>
              </div>
            </article>
          </section>

          <p aria-live="polite" className="border border-gray-800 px-4 py-3 text-sm text-gray-300">
            {timeComparison}
          </p>
        </>
      )}

      <section className="border-t border-gray-800 pt-4" aria-label="Model assumptions and limitations">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Model notes</h2>
        <ul className="mt-2 grid grid-cols-1 roomy:grid-cols-2 gap-x-8 gap-y-1 text-[10px] leading-5 text-gray-600">
          <li>Speed is a constant average over the full route; weather, currents, vessel handling, and speed restrictions are excluded.</li>
          <li>Distances sum great-circle legs between fixed illustrative waypoints. Actual navigable routes and canal transits differ.</li>
          <li>Closure delay is a scenario input, not a report that Suez is closed.</li>
          <li>These routes start outside the Persian Gulf; the Cape diversion does not provide a Hormuz bypass for vessels inside the Gulf.</li>
          <li>Fuel use, freight rates, cargo value, and economic effects are not estimated.</li>
        </ul>
      </section>
    </div>
  );
}

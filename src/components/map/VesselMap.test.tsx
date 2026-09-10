import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mapHarness = vi.hoisted(() => ({
  maps: [] as any[],
  constructorError: null as Error | null,
}));
const vesselHarness = vi.hoisted(() => ({
  state: {
    tankersOnly: false,
    anomalyFilter: false,
    selectedVessel: null,
    showTrack: false,
    mapCenter: null,
    targetVesselImo: null,
    setSelectedVessel: vi.fn(),
    setLastUpdate: vi.fn(),
    setMapCenter: vi.fn(),
    setTargetVesselImo: vi.fn(),
    setClusterVessels: vi.fn(),
  },
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    private handlers = new Map<string, Set<(...args: any[]) => void>>();
    private onceHandlers = new Map<string, Set<(...args: any[]) => void>>();
    private sources = new Map<string, any>();
    private layers = new Set<string>();
    private canvas: HTMLCanvasElement;

    constructor(options: { container: HTMLElement }) {
      if (mapHarness.constructorError) throw mapHarness.constructorError;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'maplibregl-canvas';
      options.container.appendChild(this.canvas);
      mapHarness.maps.push(this);
    }

    on(event: string, layerOrHandler: unknown, maybeHandler?: (...args: any[]) => void) {
      const handler = (typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler) as
        | ((...args: any[]) => void)
        | undefined;
      if (!handler) return this;
      const handlers = this.handlers.get(event) ?? new Set();
      handlers.add(handler);
      this.handlers.set(event, handlers);
      return this;
    }

    once(event: string, handler: (...args: any[]) => void) {
      const handlers = this.onceHandlers.get(event) ?? new Set();
      handlers.add(handler);
      this.onceHandlers.set(event, handlers);
      return this;
    }

    off(event: string, layerOrHandler: unknown, maybeHandler?: (...args: any[]) => void) {
      const handler = (typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler) as
        | ((...args: any[]) => void)
        | undefined;
      if (handler) this.handlers.get(event)?.delete(handler);
      return this;
    }

    emit(event: string, ...args: any[]) {
      this.handlers.get(event)?.forEach((handler) => handler(...args));
      const once = this.onceHandlers.get(event);
      if (once) {
        this.onceHandlers.delete(event);
        once.forEach((handler) => handler(...args));
      }
    }

    addSource(id: string, source: { data: unknown }) {
      const record = { ...source, setData: vi.fn() };
      this.sources.set(id, record);
      return record;
    }

    getSource(id: string) { return this.sources.get(id); }
    removeSource(id: string) { this.sources.delete(id); }
    addLayer(layer: { id: string }) { this.layers.add(layer.id); }
    getLayer(id: string) { return this.layers.has(id) ? { id } : undefined; }
    removeLayer(id: string) { this.layers.delete(id); }
    getCanvas() { return this.canvas; }
    isStyleLoaded() { return true; }
    getZoom() { return 5; }
    queryRenderedFeatures() { return []; }
    project(coords: [number, number]) { return { x: coords[0], y: coords[1] }; }
    flyTo() {}
    remove() {}
  }

  return { Map: MockMap, setWorkerUrl: vi.fn() };
});

vi.mock('@/stores/vessel', () => {
  const useVesselStore = Object.assign(vi.fn(() => vesselHarness.state), {
    getState: vi.fn(() => vesselHarness.state),
  });
  return { useVesselStore };
});

import { VesselMap } from './VesselMap';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function vessel(id: number) {
  const mmsi = `12345678${id}`;
  const imo = `900000${id}`;
  return {
    imo,
    mmsi,
    name: `TEST VESSEL ${id}`,
    flag: 'PA',
    shipType: 80,
    destination: 'FUJAIRAH',
    lastSeen: '2026-09-10T12:00:00.000Z',
    isSanctioned: false,
    sanctioningAuthority: null,
    sanctionReason: null,
    sanctionRiskCategory: null,
    anomalyType: null,
    anomalyConfidence: null,
    anomalyDetectedAt: null,
    position: {
      time: '2026-09-10T12:00:00.000Z',
      mmsi,
      imo,
      latitude: 25 + id / 10,
      longitude: 55 + id / 10,
      speed: 10,
      course: 90,
      heading: 90,
      navStatus: 0,
      lowConfidence: false,
    },
  };
}

function response(vessels: unknown[], ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ vessels, timestamp: '2026-09-10T12:00:00.000Z' }),
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderMap() {
  const view = render(<VesselMap />);
  await waitFor(() => expect(mapHarness.maps).toHaveLength(1));
  return { map: mapHarness.maps[0], rerender: view.rerender };
}

async function waitForSetData(map: any) {
  await waitFor(() => expect(map.getSource('vessels')?.setData).toHaveBeenCalled());
}

async function emitMapLoad(map: any) {
  act(() => map.emit('load'));
  await flush();
  // Return the active map in case a future MapLibre test double models a
  // replacement instance during style initialization.
  const latest = mapHarness.maps.at(-1);
  if (latest && latest !== map) {
    act(() => latest.emit('load'));
    await flush();
    return latest;
  }
  return map;
}

async function emitMapIdle(map: any) {
  act(() => map.emit('idle'));
  await flush();
}

beforeEach(() => {
  mapHarness.maps.length = 0;
  mapHarness.constructorError = null;
  vesselHarness.state.tankersOnly = false;
  vesselHarness.state.anomalyFilter = false;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VesselMap loading state', () => {
  it('explains the WebGL2 requirement when map initialization fails', () => {
    mapHarness.constructorError = new Error('WebGL2 unavailable');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<VesselMap />);

    expect(screen.getByText('MAP ERROR')).toBeInTheDocument();
    expect(screen.getByText('WebGL2 unavailable')).toBeInTheDocument();
    expect(screen.getByText(/WebGL2 required for map rendering/i)).toBeInTheDocument();
  });

  it('ignores a delayed load event from a disposed map instance', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const firstView = render(<VesselMap />);
    await waitFor(() => expect(mapHarness.maps).toHaveLength(1));
    const staleMap = mapHarness.maps[0];

    firstView.unmount();
    render(<VesselMap />);
    await waitFor(() => expect(mapHarness.maps).toHaveLength(2));
    const activeMap = mapHarness.maps[1];

    act(() => staleMap.emit('load'));
    expect(staleMap.getSource('vessels')).toBeUndefined();
    expect(activeMap.getSource('vessels')).toBeUndefined();

    act(() => activeMap.emit('load'));
    expect(activeMap.getSource('vessels')).toBeDefined();
  });

  it('shows an accessible loading HUD with animation only while acquiring', async () => {
    const gate = deferred<any>();
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    await renderMap();

    const map = screen.getByTestId('vessel-map');
    expect(map).toHaveAttribute('data-map-state', 'loading');
    expect(map).toHaveAttribute('data-vessel-state', 'loading');
    expect(map).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('vessel-loading-hud')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent(/map initializing/i);
    expect(document.querySelectorAll('.straits-acquisition-bar')).toHaveLength(4);
    expect(document.querySelectorAll('.straits-acquisition-bar-static')).toHaveLength(0);
  });

  it('keeps loading until map idle when the map loads before data', async () => {
    const gate = deferred<any>();
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    const { map } = await renderMap();
    const activeMap = await emitMapLoad(map);
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-map-state', 'ready');
    expect(screen.getByRole('status')).toHaveTextContent(/map online/i);

    gate.resolve(response([vessel(1)]));
    await flush();
    await waitForSetData(activeMap);
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'loading');

    await emitMapIdle(activeMap);
    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'ready'));
    expect(screen.queryByTestId('vessel-loading-hud')).not.toBeInTheDocument();
    expect(screen.getByTestId('vessel-map')).not.toHaveAttribute('aria-busy');
  });

  it('keeps loading until map idle when data arrives before the map', async () => {
    const gate = deferred<any>();
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    const { map } = await renderMap();

    gate.resolve(response([vessel(1)]));
    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-count', '1'));
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-map-state', 'loading');
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'loading');

    const activeMap = await emitMapLoad(map);
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-map-state', 'ready');
    expect(screen.getByRole('status')).toHaveTextContent(/map online/i);
    await waitForSetData(activeMap);
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'loading');
    await emitMapIdle(activeMap);
    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'ready'));
  });

  it('reports a successful empty response as empty after map idle', async () => {
    const gate = deferred<any>();
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    const { map } = await renderMap();
    const activeMap = await emitMapLoad(map);

    gate.resolve(response([]));
    await flush();
    await waitForSetData(activeMap);
    await emitMapIdle(activeMap);

    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'empty'));
    expect(screen.getByTestId('vessel-loading-hud')).toHaveTextContent(/no live vessel positions/i);
    expect(document.querySelectorAll('.straits-acquisition-bar-static')).toHaveLength(4);
    expect(document.querySelectorAll('.straits-acquisition-bar')).toHaveLength(0);
  });

  it('shows error for HTTP/network failure and recovers on the next request', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = deferred<any>();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockImplementationOnce(() => retry.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { map, rerender } = await renderMap();
    const activeMap = await emitMapLoad(map);

    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'error'));
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch vessels:', expect.any(Error));
    expect(screen.getByRole('status')).toHaveTextContent(/feed unavailable/i);
    expect(document.querySelectorAll('.straits-acquisition-bar-static')).toHaveLength(4);

    vesselHarness.state.tankersOnly = true;
    // The filter change is the deterministic retry trigger; production also
    // retries through the 30-second interval.
    await act(async () => { rerender(<VesselMap />); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    retry.resolve(response([vessel(1)]));
    await flush();
    await waitForSetData(activeMap);
    await emitMapIdle(activeMap);

    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'ready'));
    expect(screen.queryByTestId('vessel-loading-hud')).not.toBeInTheDocument();
  });

  it('ignores an aborted stale response from the previous filter request', async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        expect(init.signal).toBeDefined();
        return first.promise;
      })
      .mockImplementationOnce(() => second.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { map, rerender } = await renderMap();
    const activeMap = await emitMapLoad(map);

    vesselHarness.state.tankersOnly = true;
    await act(async () => { rerender(<VesselMap />); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    first.resolve(response([vessel(1)]));
    await flush();
    expect(activeMap.getSource('vessels')?.setData).not.toHaveBeenCalled();
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'loading');

    second.resolve(response([vessel(1), vessel(2)]));
    await flush();
    await waitForSetData(activeMap);
    await emitMapIdle(activeMap);
    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'ready'));
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-count', '2');
  });

  it('preserves ready data when a later refresh request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = deferred<any>();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockRejectedValueOnce(new Error('refresh failed'));
    vi.stubGlobal('fetch', fetchMock);
    const { map, rerender } = await renderMap();
    const activeMap = await emitMapLoad(map);

    first.resolve(response([vessel(1)]));
    await flush();
    await waitForSetData(activeMap);
    await emitMapIdle(activeMap);
    await waitFor(() => expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'ready'));

    vesselHarness.state.tankersOnly = true;
    await act(async () => { rerender(<VesselMap />); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await flush();

    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch vessels:', expect.any(Error));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-state', 'ready');
    expect(screen.getByTestId('vessel-map')).toHaveAttribute('data-vessel-count', '1');
    expect(screen.queryByTestId('vessel-loading-hud')).not.toBeInTheDocument();
  });
});

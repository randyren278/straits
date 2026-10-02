'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { COVERAGE_REGIONS, type HourCell } from '@/lib/coverage/diagnostics';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';

interface Peer {
  mmsi: string;
  imo: string | null;
  name: string | null;
  latitude: number;
  longitude: number;
  lastFix: string;
  source: string | null;
}

interface Diagnostics {
  generatedAt: string;
  region: { id: string; bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } };
  regionalCollection: { hourly: HourCell[] };
  peers: { vessels: Peer[]; limit: number };
  selectedVessel: null | {
    mmsi: string;
    name?: string | null;
    status: 'not_in_peer_sample' | 'insufficient_history' | 'observed_gaps';
    count: number;
    longestGapSeconds: number | null;
    longestGapStart?: string | null;
    longestGapEnd?: string | null;
    longestGapCollection?: { recordedWindows: number; activeWindows: number; sourceReportedFixes: number; sources: string[] };
    sinceLastFixSeconds?: number;
    sinceLastFixCollection?: { recordedWindows: number; activeWindows: number; sourceReportedFixes: number; sources: string[] };
    imo?: string | null;
    latitude?: number;
    longitude?: number;
  };
}

const COVERAGE_LABELS = [
  'Persian Gulf', 'Gulf of Oman / Arabian Sea', 'Arabian Sea / India west coast', 'Red Sea', 'Bab el-Mandeb / Gulf of Aden', 'Suez / Eastern Mediterranean',
];

function regionName(id: string): string {
  const chokepoint = CHOKEPOINTS[id];
  if (chokepoint) return chokepoint.name;
  const index = Number(id.split(':')[1]);
  return Number.isInteger(index) && COVERAGE_LABELS[index] ? `Coverage box · ${COVERAGE_LABELS[index]}` : id;
}

function compactTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function CoverageClient() {
  const [regionId, setRegionId] = useState('hormuz');
  const [mmsi, setMmsi] = useState('');
  const [dataState, setDataState] = useState<{ query: string; data: Diagnostics } | null>(null);
  const [errorState, setErrorState] = useState<{ query: string; message: string } | null>(null);
  const query = useMemo(() => {
    const params = new URLSearchParams({ region: regionId });
    if (mmsi) params.set('mmsi', mmsi);
    return params.toString();
  }, [regionId, mmsi]);
  const data = dataState?.query === query ? dataState.data : null;
  const error = errorState?.query === query ? errorState.message : null;
  const loading = !data && !error;

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/coverage/diagnostics?${query}`, { signal: abort.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Diagnostics unavailable (${response.status}).`);
        return response.json() as Promise<Diagnostics>;
      })
      .then((result) => {
        setDataState({ query, data: result });
        setErrorState(null);
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) setErrorState({ query, message: cause instanceof Error ? cause.message : 'Diagnostics unavailable.' });
      });
    return () => abort.abort();
  }, [query]);

  const cells = data?.regionalCollection.hourly ?? [];
  const selected = data?.selectedVessel;
  const peer = selected?.mmsi ? data?.peers.vessels.find((vessel) => vessel.mmsi === selected.mmsi) : null;
  const regionCenter = data ? {
    lat: (data.region.bounds.minLat + data.region.bounds.maxLat) / 2,
    lon: (data.region.bounds.minLon + data.region.bounds.maxLon) / 2,
  } : null;
  const regionMapHref = regionCenter
    ? `/dashboard?${new URLSearchParams({
      ...(regionId in CHOKEPOINTS ? { cp: regionId } : {}),
      lat: regionCenter.lat.toFixed(4), lon: regionCenter.lon.toFixed(4), z: '7.5',
    }).toString()}`
    : '/dashboard';
  const vesselMapHref = peer
    ? `/dashboard?${new URLSearchParams({
      ...(peer.imo ? { vessel: peer.imo } : {}),
      ...(regionId in CHOKEPOINTS ? { cp: regionId } : {}),
      lat: peer.latitude.toFixed(4), lon: peer.longitude.toFixed(4), z: '9.0',
    }).toString()}`
    : regionMapHref;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#050505] px-4 py-5 text-zinc-200 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-amber-500/20 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-500">Canary · Observation quality</p>
            <h1 className="mt-1 font-mono text-2xl uppercase tracking-wide text-white">Coverage diagnostics</h1>
            <p className="mt-1 max-w-2xl text-xs text-zinc-500">Regional feed collection and vessel history are shown as separate signals over the last 48 hours.</p>
          </div>
          <label className="flex w-full min-w-0 flex-col gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 sm:w-auto">
            Region
            <select value={regionId} onChange={(event) => { setRegionId(event.target.value); setMmsi(''); }} className="min-h-10 w-full min-w-0 max-w-full border border-amber-500/30 bg-black px-3 text-xs text-amber-100 outline-none focus:border-amber-400 sm:w-auto sm:min-w-64">
              {COVERAGE_REGIONS.map((region) => <option key={region.id} value={region.id}>{regionName(region.id)}</option>)}
            </select>
          </label>
        </div>

        {loading && <p role="status" aria-live="polite" className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Loading coverage diagnostics…</p>}
        {error && <div role="alert" className="border border-red-500/30 bg-red-950/20 px-4 py-3 font-mono text-xs text-red-300">{error}</div>}

        <section className="border border-zinc-800 bg-zinc-950/70 p-4 md:p-5" aria-labelledby="regional-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="regional-title" className="font-mono text-sm uppercase tracking-widest text-white">Regional collection · {regionName(regionId)}</h2>
              <p className="mt-1 text-xs text-zinc-500">Distinct recorded 10-minute regional intervals, grouped by UTC hour. A blank cell means no collection row was recorded.</p>
            </div>
            <Link href={regionMapHref} className="border border-amber-500/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-400 hover:bg-amber-500/10">Open region map ↗</Link>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16" aria-label="48-hour hourly collection heatstrip">
            {cells.map((cell) => {
              const level = cell.sourceReportedFixes == null ? 0 : cell.sourceReportedFixes === 0 ? 1 : cell.sourceReportedFixes < 10 ? 2 : cell.sourceReportedFixes < 100 ? 3 : 4;
              const colors = ['bg-zinc-900', 'bg-zinc-700', 'bg-amber-950', 'bg-amber-700', 'bg-amber-400'];
              const detail = cell.sourceReportedFixes == null ? 'No collection record' : `${cell.sourceReportedFixes} source-reported position fixes`;
              return <div key={cell.hour} title={`${compactTime(cell.hour)} UTC · ${detail} · ${cell.recordedWindows} distinct recorded windows`} className={`h-7 border border-white/5 ${colors[level]}`} aria-label={`${compactTime(cell.hour)} UTC: ${detail}; ${cell.recordedWindows} distinct recorded windows`} />;
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-zinc-500">
            <span>■ no record</span><span className="text-zinc-400">■ recorded, zero fixes</span><span className="text-amber-700">■ 1–9 fixes</span><span className="text-amber-500">■ 10–99</span><span className="text-amber-300">■ 100+</span>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Each cell counts distinct 10-minute regional windows. Source-reported fixes are summed across feeds and may include overlapping reports of the same position.</p>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">Collection sources: {Array.from(new Set(cells.flatMap((cell) => cell.sources))).join(', ') || 'no recorded source rows'} · {data ? `Snapshot ${compactTime(data.generatedAt)} UTC` : 'Awaiting snapshot'}</p>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
          <section className="border border-zinc-800 bg-zinc-950/70 p-4 md:p-5" aria-labelledby="peer-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="peer-title" className="font-mono text-sm uppercase tracking-widest text-white">Observed regional vessels</h2>
                <p className="mt-1 text-xs text-zinc-500">Latest retained positions whose last-observed point is inside this region, limited to the 100 most recently observed MMSIs.</p>
              </div>
              <label className="flex w-full min-w-0 flex-col gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 sm:w-auto">
                Inspect vessel
                <select value={mmsi} onChange={(event) => setMmsi(event.target.value)} className="min-h-10 w-full min-w-0 max-w-full border border-zinc-700 bg-black px-3 text-xs text-zinc-100 outline-none focus:border-amber-400 sm:w-auto sm:min-w-64">
                  <option value="">Select from observed vessels…</option>
                  {(data?.peers.vessels ?? []).map((vessel) => <option key={vessel.mmsi} value={vessel.mmsi}>{vessel.name || `MMSI ${vessel.mmsi}`} · {vessel.mmsi}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 max-h-80 overflow-auto border-t border-zinc-800">
              {(data?.peers.vessels ?? []).map((vessel) => (
                <button key={vessel.mmsi} type="button" onClick={() => setMmsi(vessel.mmsi)} className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-zinc-900 px-2 py-2 text-left font-mono text-[11px] hover:bg-zinc-900 ${mmsi === vessel.mmsi ? 'bg-amber-500/5 text-amber-200' : 'text-zinc-300'}`}>
                  <span className="truncate">{vessel.name || `MMSI ${vessel.mmsi}`} <span className="text-zinc-600">{vessel.imo ? `IMO ${vessel.imo}` : `MMSI ${vessel.mmsi}`}</span></span>
                  <span className="text-zinc-500">{compactTime(vessel.lastFix)} UTC</span>
                </button>
              ))}
              {data && data.peers.vessels.length === 0 && <p className="px-2 py-6 text-center font-mono text-xs text-zinc-500">No latest vessel positions in this region during the 48-hour window.</p>}
            </div>
          </section>

          <section className="border border-zinc-800 bg-zinc-950/70 p-4 md:p-5" aria-labelledby="vessel-title">
            <h2 id="vessel-title" className="font-mono text-sm uppercase tracking-widest text-white">Selected vessel history</h2>
            {!selected && <p className="mt-3 text-xs text-zinc-500">Choose one of the observed regional vessels to inspect its retained position history.</p>}
            {selected && <>
              <p className="mt-3 font-mono text-xs text-amber-300">{selected.name || `MMSI ${selected.mmsi}`} · {selected.mmsi}</p>
              {selected.status === 'not_in_peer_sample' && <p className="mt-3 text-xs text-zinc-400">This MMSI is not in the current 100-vessel regional peer sample. Select a vessel from the list to view its history.</p>}
              {selected.status === 'insufficient_history' && <p className="mt-3 border border-zinc-800 px-3 py-3 text-xs text-zinc-400">Insufficient history: {selected.count} retained fixes in this 48-hour window. No gap comparison is available.</p>}
              {selected.status === 'observed_gaps' && <div className="mt-3 border border-amber-500/20 px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Longest interval between retained fixes</p>
                <p className="mt-1 font-mono text-2xl text-amber-300">{Math.round((selected.longestGapSeconds ?? 0) / 60)} <span className="text-sm">min</span></p>
                <p className="mt-1 text-[10px] text-zinc-500">{selected.longestGapStart && compactTime(selected.longestGapStart)} → {selected.longestGapEnd && compactTime(selected.longestGapEnd)} UTC · {selected.count} fixes</p>
                {selected.longestGapCollection && <p className="mt-3 border-t border-zinc-800 pt-2 text-[10px] leading-relaxed text-zinc-400">Regional collection windows overlapping this position gap (10-minute granularity): {selected.longestGapCollection.recordedWindows} recorded, {selected.longestGapCollection.activeWindows} with source-reported fixes. {selected.longestGapCollection.recordedWindows === 0 ? 'No collection records are available for the overlapping windows.' : `${selected.longestGapCollection.sourceReportedFixes} source-reported fixes across ${selected.longestGapCollection.sources.join(', ') || 'recorded sources'}.`}</p>}
              </div>}
              {selected.sinceLastFixSeconds != null && selected.sinceLastFixCollection && <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Since the vessel’s last retained fix ({Math.floor(selected.sinceLastFixSeconds / 60)} min before this snapshot): regional collection recorded {selected.sinceLastFixCollection.recordedWindows} windows, {selected.sinceLastFixCollection.activeWindows} with source-reported fixes.</p>}
              {peer && <Link href={vesselMapHref} className="mt-3 inline-flex border border-amber-500/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-400 hover:bg-amber-500/10">Open vessel map ↗</Link>}
            </>}
            <p className="mt-4 border-t border-zinc-800 pt-3 text-[11px] leading-relaxed text-zinc-500">A vessel-specific gap does not explain why AIS observations stopped. These signals do not prove evasion.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

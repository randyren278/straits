'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EncounterCaseResponse, EncounterPosition, EncounterSelection } from '@/lib/investigations/encounters';

const COLORS = { self: '#f0ae48', partner: '#62d6c3' } as const;
const NEAR_FIX_MS = 30 * 60_000;
const GAP_MS = 45 * 60_000;

function utc(value: string | number): string {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? 'Time unavailable' : `${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(time)} UTC`;
}

function nearestFix(positions: EncounterPosition[], time: number): EncounterPosition | null {
  let closest: EncounterPosition | null = null;
  let distance = Infinity;
  for (const position of positions) {
    const delta = Math.abs(Date.parse(position.time) - time);
    if (delta < distance) { closest = position; distance = delta; }
  }
  return distance <= NEAR_FIX_MS ? closest : null;
}

function pairedSeparation(self: EncounterPosition[], partner: EncounterPosition[], time: number): { distanceKm: number; timeDeltaMinutes: number; self: EncounterPosition; partner: EncounterPosition } | null {
  const a = nearestFix(self, time);
  const b = nearestFix(partner, time);
  if (!a || !b) return null;
  const delta = Math.abs(Date.parse(a.time) - Date.parse(b.time));
  if (Math.abs(Date.parse(a.time) - time) > 15 * 60_000 || Math.abs(Date.parse(b.time) - time) > 15 * 60_000 || delta > 10 * 60_000) return null;
  const latitude = (b.latitude - a.latitude) * Math.PI / 180;
  const longitude = (b.longitude - a.longitude) * Math.PI / 180;
  const haversine = Math.sin(latitude / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(longitude / 2) ** 2;
  return { distanceKm: 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine))), timeDeltaMinutes: Math.round(delta / 60_000), self: a, partner: b };
}

function trackSegments(positions: EncounterPosition[]): EncounterPosition[][] {
  const segments: EncounterPosition[][] = [];
  let segment: EncounterPosition[] = [];
  for (const position of positions) {
    if (segment.length && Date.parse(position.time) - Date.parse(segment[segment.length - 1].time) > GAP_MS) {
      if (segment.length > 1) segments.push(segment);
      segment = [];
    }
    segment.push(position);
  }
  if (segment.length > 1) segments.push(segment);
  return segments;
}

function EncounterMap({ selection, moment }: { selection: EncounterSelection; moment: number }) {
  const self = selection.selfPositions;
  const partner = selection.partnerPositions;
  const selfCandidates = selection.selfCandidatePositions;
  const partnerCandidates = selection.partnerCandidatePositions;
  const all = [...self, ...partner, ...selfCandidates, ...partnerCandidates];
  if (all.length === 0) return <div className="flex h-full min-h-[25rem] items-center justify-center p-8 text-center text-xs text-gray-500">No raw AIS coordinates remain for this recorded encounter.</div>;

  const minLon = Math.min(...all.map((p) => p.longitude));
  const maxLon = Math.max(...all.map((p) => p.longitude));
  const minLat = Math.min(...all.map((p) => p.latitude));
  const maxLat = Math.max(...all.map((p) => p.latitude));
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const lonScale = 111.32 * Math.cos(centerLat * Math.PI / 180);
  const halfWidthKm = Math.max((maxLon - minLon) * lonScale / 2, 0.25);
  const halfHeightKm = Math.max((maxLat - minLat) * 111.32 / 2, 0.25);
  const scale = Math.min(390 / halfWidthKm, 235 / halfHeightKm);
  const point = (position: EncounterPosition) => ({ x: 500 + (position.longitude - centerLon) * lonScale * scale, y: 300 - (position.latitude - centerLat) * 111.32 * scale });
  const pair = pairedSeparation(self, partner, moment);
  const selectedSelf = nearestFix([...self, ...selfCandidates], moment);
  const selectedPartner = nearestFix([...partner, ...partnerCandidates], moment);

  return <div className="relative h-full min-h-[25rem] overflow-hidden bg-[#071015]" data-testid="encounter-coordinate-plot">
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="North-up coordinate plot of IMO-tagged fixes and provisional current-MMSI candidates; track lines stop at observation gaps" className="absolute inset-0 h-full w-full">
      <rect width="1000" height="600" fill="#071015" />
      {[100, 200, 300, 400, 500].map((y) => <line key={`y${y}`} x1="0" x2="1000" y1={y} y2={y} stroke="#1b3038" strokeDasharray="3 8" />)}
      {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => <line key={`x${x}`} x1={x} x2={x} y1="0" y2="600" stroke="#1b3038" strokeDasharray="3 8" />)}
      <circle cx="500" cy="300" r="165" fill="none" stroke="#1c3338" strokeDasharray="2 8" />
      <circle cx="500" cy="300" r="75" fill="none" stroke="#1c3338" strokeDasharray="2 8" />
      {([['self', self], ['partner', partner]] as const).flatMap(([key, positions]) => trackSegments(positions).map((segment, index) => <polyline key={`${key}-${index}`} points={segment.map((position) => { const { x, y } = point(position); return `${x},${y}`; }).join(' ')} fill="none" stroke={COLORS[key]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />))}
      {([['self', selfCandidates], ['partner', partnerCandidates]] as const).flatMap(([key, positions]) => trackSegments(positions).map((segment, index) => <polyline key={`${key}-candidate-${index}`} points={segment.map((position) => { const { x, y } = point(position); return `${x},${y}`; }).join(' ')} fill="none" stroke={COLORS[key]} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />))}
      {([['self', self], ['partner', partner]] as const).flatMap(([key, positions]) => positions.map((position, index) => { const { x, y } = point(position); return <circle key={`${key}-fix-${index}`} cx={x} cy={y} r="3" fill={position.lowConfidence ? '#9ca3af' : COLORS[key]} stroke="#071015" strokeWidth="1" />; }))}
      {([['self', selfCandidates], ['partner', partnerCandidates]] as const).flatMap(([key, positions]) => positions.map((position, index) => { const { x, y } = point(position); return <circle key={`${key}-candidate-fix-${index}`} cx={x} cy={y} r="3" fill="#071015" stroke={COLORS[key]} strokeWidth="1.5" opacity="0.7" />; }))}
      {pair && <line x1={point(pair.self).x} y1={point(pair.self).y} x2={point(pair.partner).x} y2={point(pair.partner).y} stroke="#f4f4f5" strokeWidth="2" strokeDasharray="4 5" />}
      {([['self', selectedSelf], ['partner', selectedPartner]] as const).map(([key, position]) => position && <g key={`${key}-selected`}>{(() => { const { x, y } = point(position); return <><circle cx={x} cy={y} r="13" fill="none" stroke={COLORS[key]} strokeWidth="2" opacity="0.7" /><circle cx={x} cy={y} r="6" fill={position.identityBasis === 'imo' ? COLORS[key] : '#071015'} stroke={COLORS[key]} strokeWidth="2" /></>; })()}</g>)}
      <text x="30" y="38" fill="#8ca4a7" fontSize="14" fontFamily="monospace" letterSpacing="3">AIS FIX GEOMETRY / NORTH UP</text>
      <text x="970" y="38" textAnchor="end" fill="#62777d" fontSize="13" fontFamily="monospace">N ↑</text>
      <text x="30" y="568" fill="#62777d" fontSize="12" fontFamily="monospace">{minLat.toFixed(3)}–{maxLat.toFixed(3)}° N · {minLon.toFixed(3)}–{maxLon.toFixed(3)}° E</text>
    </svg>
    <div className="pointer-events-none absolute bottom-3 right-3 border border-gray-700 bg-black/85 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-gray-300"><span style={{ color: COLORS.self }}>● Vessel A</span><span className="ml-4" style={{ color: COLORS.partner }}>● Vessel B</span><p className="mt-1 text-gray-400">Solid = IMO-tagged · dashed/hollow = MMSI candidate</p><p className="mt-1 text-gray-600">Lines stop where retained fixes have gaps</p></div>
  </div>;
}

function FixLane({ label, positions, color, start, end, moment, onSeek }: { label: string; positions: EncounterPosition[]; color: string; start: number; end: number; moment: number; onSeek: (time: number) => void }) {
  const closest = nearestFix(positions, moment);
  const markerPositions = positions.length <= 70 ? positions : positions.filter((_, index) => index % Math.ceil(positions.length / 70) === 0);
  const nearby = [...positions]
    .sort((a, b) => Math.abs(Date.parse(a.time) - moment) - Math.abs(Date.parse(b.time) - moment))
    .slice(0, 6)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return <div className="border border-gray-800 bg-black p-3" data-testid={`encounter-lane-${label}`}>
    <div className="flex items-baseline justify-between gap-3"><h3 className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>{label}</h3><span className="text-[9px] font-mono text-gray-600">{positions.filter((position) => position.identityBasis === 'imo').length} IMO · {positions.filter((position) => position.identityBasis === 'current_mmsi').length} MMSI candidates</span></div>
    <div className="relative mt-3 h-9 border-y border-gray-900 bg-gray-950" aria-hidden="true">
      <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-700" />
      {markerPositions.map((position, index) => <span key={`${position.time}-${index}`} className="absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black" style={{ left: `${Math.max(1, Math.min(99, (Date.parse(position.time) - start) / (end - start) * 100))}%`, backgroundColor: position.lowConfidence || position.identityBasis === 'current_mmsi' ? '#9ca3af' : color }} />)}
      <div className="pointer-events-none absolute top-0 h-full border-l border-amber-300" style={{ left: `${Math.max(0, Math.min(100, (moment - start) / (end - start) * 100))}%` }} />
    </div>
    <p className="mt-2 text-[10px] text-gray-400">{closest ? <>{utc(closest.time)} · {closest.latitude.toFixed(4)}°, {closest.longitude.toFixed(4)}° · {closest.source ?? 'source unrecorded'} · {closest.identityBasis === 'imo' ? 'IMO-tagged fix' : `provisional current-MMSI ${closest.mmsi} candidate`}{closest.lowConfidence ? ' · low confidence' : ''}{closest.speed !== null ? ` · ${closest.speed.toFixed(1)} kn` : ''}</> : positions.length ? 'No retained fix within 30 minutes of the selected time.' : 'No retained fixes or MMSI candidates in the selected window.'}</p>
    {nearby.length > 0 && <div className="mt-3 border-t border-gray-900 pt-2"><p className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Nearby fixes · move the time slider for others</p><div className="mt-1 max-h-28 overflow-y-auto">{nearby.map((position, index) => <button key={`${position.time}-${index}`} type="button" onClick={() => onSeek(Date.parse(position.time))} aria-label={`${label} fix ${utc(position.time)}`} className="flex min-h-10 w-full items-center justify-between gap-3 border-b border-gray-900 px-1 text-left text-[10px] hover:bg-gray-950 focus-visible:outline focus-visible:outline-amber-300"><span>{utc(position.time)}</span><span className="shrink-0 font-mono uppercase text-gray-600">{position.identityBasis === 'imo' ? 'IMO' : 'MMSI candidate'}</span></button>)}</div></div>}
  </div>;
}

export function EncounterCaseboard({ imo }: { imo: string }) {
  const [caseData, setCaseData] = useState<EncounterCaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moment, setMoment] = useState(0);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async (eventId: string | null) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/investigations/encounters/${imo}${eventId ? `?event=${encodeURIComponent(eventId)}` : ''}`;
      const response = await fetch(url, { signal: current.signal, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Encounter evidence is unavailable.');
      if (current.signal.aborted) return;
      const next = payload as EncounterCaseResponse;
      setCaseData(next);
      if (next.selected) setMoment(Math.round((Date.parse(next.selectedSummary?.firstSeenAt ?? next.selected.positionWindow.startsAt) + Date.parse(next.selectedSummary?.lastSeenAt ?? next.selected.positionWindow.endsAt)) / 2));
      const address = new URL(window.location.href);
      if (next.selected) address.searchParams.set('event', next.selected.id);
      else address.searchParams.delete('event');
      window.history.replaceState(null, '', address.toString());
    } catch (cause) {
      if (current.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Encounter evidence is unavailable.');
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [imo]);

  useEffect(() => {
    void load(new URL(window.location.href).searchParams.get('event'));
    return () => controller.current?.abort();
  }, [load]);

  const selected = caseData?.selected ?? null;
  const selectedSummary = caseData?.selectedSummary ?? null;
  const start = selected ? Date.parse(selected.positionWindow.startsAt) : 0;
  const end = selected ? Date.parse(selected.positionWindow.endsAt) : 0;
  const boundedMoment = selected ? Math.max(start, Math.min(end, moment)) : 0;
  const pair = selected ? pairedSeparation(selected.selfPositions, selected.partnerPositions, boundedMoment) : null;
  const hasCandidates = selected ? selected.selfCandidatePositions.length + selected.partnerCandidatePositions.length > 0 : false;
  const truncated = selected ? [selected.selfPositionsMeta, selected.partnerPositionsMeta, selected.selfCandidatePositionsMeta, selected.partnerCandidatePositionsMeta].some((meta) => meta.truncated) : false;
  const selfFixes = selected ? [...selected.selfPositions, ...selected.selfCandidatePositions].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)) : [];
  const partnerFixes = selected ? [...selected.partnerPositions, ...selected.partnerCandidatePositions].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)) : [];

  return <main className="mx-auto min-h-screen max-w-[96rem] px-6 py-7 text-gray-100 phone:px-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-amber-500/30 pb-5">
      <div><p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">Canary / Investigation graph / 02</p><h1 className="mt-2 text-2xl font-mono uppercase tracking-wider">Encounter Caseboard</h1><p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">Trace a recorded sustained proximity event through two vessels’ retained AIS observations. The event is a detector lead, not proof of a cargo transfer.</p></div>
      <Link href="/investigations" className="border border-gray-700 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-gray-300 hover:text-amber-300">← Investigations</Link>
    </div>

    {error && <div role="alert" className="mb-4 border border-red-900 bg-red-950/30 p-4 text-xs text-red-300">{error}<button type="button" onClick={() => void load(null)} className="ml-3 underline">Retry</button></div>}
    {loading && !caseData && <p role="status" className="border border-gray-800 p-8 text-center text-xs font-mono uppercase tracking-wider text-gray-500">Loading encounter evidence…</p>}
    {caseData && <>
      <div className="mb-4 flex flex-wrap items-baseline gap-3 border border-gray-800 bg-gray-950 px-4 py-3"><span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Subject vessel</span><span className="text-lg font-mono text-amber-400">{caseData.vessel.name}</span><span className="text-[10px] text-gray-500">IMO {caseData.vessel.imo} · MMSI {caseData.vessel.mmsi} · {caseData.vessel.flag ?? 'Flag unknown'}</span><Link href={`/dashboard?vessel=${caseData.vessel.imo}`} className="ml-auto text-[10px] font-mono uppercase text-gray-400 underline underline-offset-2 hover:text-white">Current map ↗</Link></div>
      {caseData.encounters.length === 0 && !selected ? <div className="border border-gray-800 bg-gray-950 p-10 text-center"><h2 className="font-mono text-base text-gray-200">No recorded sustained proximity events</h2><p className="mt-2 text-xs leading-5 text-gray-500">The ledger has no partner event for this vessel. This is not evidence that it never came close to another ship; collection and detection are incomplete.</p></div> : <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border border-gray-800 bg-gray-950/70"><div className="border-b border-gray-800 px-4 py-3"><h2 className="text-[10px] font-mono uppercase tracking-widest text-gray-200">Recorded links</h2><p className="mt-1 text-[10px] text-gray-600">Latest {caseData.encounters.length} ledger entries · scroll to inspect</p></div>{selectedSummary && !caseData.encounters.some((item) => item.id === selectedSummary.id) && <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-4"><p className="text-[9px] font-mono uppercase tracking-wider text-amber-400">Opened from older event link</p><p className="mt-2 text-xs font-mono text-gray-200">{selectedSummary.partnerName ?? selectedSummary.partnerImo}</p><p className="mt-1 text-[10px] text-gray-500">{utc(selectedSummary.firstSeenAt)}</p></div>}<ol className="max-h-[14rem] overflow-y-auto divide-y divide-gray-900 xl:max-h-[52rem]">{caseData.encounters.map((item) => <li key={item.id}><button type="button" onClick={() => void load(item.id)} aria-current={selected?.id === item.id ? 'true' : undefined} className={`w-full px-4 py-4 text-left hover:bg-amber-500/5 ${selected?.id === item.id ? 'border-l-2 border-amber-400 bg-amber-500/5' : 'border-l-2 border-transparent'}`}><span className="block text-xs font-mono text-gray-200">{item.partnerName ?? 'Unknown vessel'}</span><span className="mt-1 block text-[10px] text-gray-500">IMO {item.partnerImo} · {utc(item.firstSeenAt)}</span><span className="mt-2 block text-[9px] font-mono uppercase text-amber-400">{item.minDistanceKm === null ? 'Separation unavailable' : `Minimum recorded separation ${item.minDistanceKm.toFixed(2)} km`}</span>{item.partnerSanctioned && <span className="mt-1 block text-[9px] font-mono uppercase text-red-300">Partner listed in sanctions data at archival</span>}</button></li>)}</ol></aside>
        <div className="min-w-0 space-y-4" aria-busy={loading}>
          {selected && selectedSummary && <>
            <section className="border border-gray-800 bg-gray-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-mono uppercase tracking-widest text-amber-400">Selected detector lead</p><h2 className="mt-2 text-lg font-mono text-gray-100">{caseData.vessel.name} <span className="text-gray-600">↔</span> {selectedSummary.partnerName ?? selectedSummary.partnerImo}</h2><p className="mt-2 text-xs text-gray-400">Recorded interval: {utc(selectedSummary.firstSeenAt)} → {utc(selectedSummary.lastSeenAt)}</p></div><span className="border border-amber-500/40 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-amber-400">Suspected proximity event</span></div><p className="mt-3 text-[10px] leading-5 text-gray-500">The ledger records sustained proximity and minimum measured separation. Solid fixes carry the vessel IMO. Dashed, hollow-marked fixes carry only a current MMSI match; that MMSI may have belonged to another hull at the event time, so these are candidates rather than vessel tracks. Lines stop at observation gaps. Archived sanctions flags reflect data at archival time.</p></section>
            <section className="grid min-h-[25rem] border border-gray-800 bg-[#071015] lg:grid-cols-[minmax(0,1fr)_16rem]"><div className="min-h-[25rem]"><EncounterMap key={selected.id} selection={selected} moment={boundedMoment} /></div><div className="flex flex-col justify-between border-t border-gray-800 p-4 lg:border-l lg:border-t-0"><div><p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Evidence at selected time</p><p className="mt-2 text-base font-mono text-amber-400">{utc(boundedMoment)}</p><div className="mt-5 border-t border-gray-800 pt-4"><p className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Paired IMO-tagged fixes</p>{pair ? <><p className="mt-2 text-2xl font-mono tabular-nums text-gray-100">{pair.distanceKm.toFixed(2)} <span className="text-sm text-gray-500">km</span></p><p className="mt-1 text-[10px] text-gray-500">Calculated from two IMO-tagged AIS fixes {pair.timeDeltaMinutes} min apart; approximate, and separate from the ledger minimum.</p></> : <p className="mt-2 text-xs leading-5 text-gray-500">No near-simultaneous pair of IMO-tagged fixes at this moment. Candidate MMSI fixes are excluded from this distance.</p>}</div><p className="mt-4 text-[10px] leading-5 text-gray-500">A marker appears only when a fix falls within 30 minutes of the selected time. The display does not interpolate positions.</p></div><div className="mt-6 space-y-2 text-[10px] text-gray-400"><p><span style={{ color: COLORS.self }}>●</span> {caseData.vessel.name}: {selected.selfPositions.length} IMO fixes · {selected.selfCandidatePositions.length} MMSI candidates</p><p><span style={{ color: COLORS.partner }}>●</span> {selectedSummary.partnerName ?? selectedSummary.partnerImo}: {selected.partnerPositions.length} IMO fixes · {selected.partnerCandidatePositions.length} MMSI candidates</p><p className="pt-2 text-gray-600">Source: retained AIS position records · UTC timestamps</p></div></div></section>
            <section className="border border-gray-800 bg-gray-950/70 p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-[10px] font-mono uppercase tracking-widest text-gray-200">Synchronized time rail</h2><span className="text-[10px] text-gray-600">{utc(start)} — {utc(end)}</span></div><input type="range" aria-label="Caseboard time" min={start} max={end} step={1000} value={boundedMoment} onChange={(event) => setMoment(Number(event.target.value))} className="mt-5 w-full accent-amber-400" /><div className="mt-4 space-y-2"><FixLane label="Vessel A" positions={selfFixes} color={COLORS.self} start={start} end={end} moment={boundedMoment} onSeek={setMoment} /><FixLane label="Vessel B" positions={partnerFixes} color={COLORS.partner} start={start} end={end} moment={boundedMoment} onSeek={setMoment} /></div>{hasCandidates && <p className="mt-3 border-l-2 border-amber-500/50 pl-3 text-xs leading-5 text-gray-400">MMSI-only fixes are provisional. The current vessel-to-MMSI match does not establish who transmitted that MMSI at the event time.</p>}{truncated && <p role="status" className="mt-3 border-l-2 border-amber-500/50 pl-3 text-xs leading-5 text-gray-400">At least one fix stream exceeds 250 retained rows. The plot shows only its latest 250 within the window; earlier coordinates are omitted.</p>}{selected.selfTrackStatus === 'no_imo_fixes' || selected.partnerTrackStatus === 'no_imo_fixes' ? <p className="mt-3 border-l-2 border-gray-700 pl-3 text-xs text-gray-500">One or both vessels have no IMO-tagged fixes in this window. Raw AIS positions may have been pruned after retention, or may lack vessel IMO. The ledger event remains dated.</p> : null}</section>
          </>}
        </div>
      </div>}
    </>}
  </main>;
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { RegionContext } from '@/lib/context/region';
import type { ClaimEvaluation, InvestigationRegion, InvestigationWindow, ParsedClaim } from '@/lib/investigations/claims';
import type { InvestigationEvidence } from '@/lib/investigations/evidence';
import { SaveFollowActions } from '@/components/investigations/SaveFollowActions';

interface ClaimCheckResult {
  region: InvestigationRegion;
  window: InvestigationWindow;
  claim: ParsedClaim;
  evaluation: ClaimEvaluation;
  evidence: InvestigationEvidence | null;
}

const REGION_OPTIONS: Array<{ id: InvestigationRegion; label: string; prompt: string }> = [
  { id: 'hormuz', label: 'Strait of Hormuz', prompt: 'Hormuz traffic stopped' },
  { id: 'suez', label: 'Suez Canal', prompt: 'Suez disruption' },
  { id: 'babel_mandeb', label: 'Bab el-Mandeb', prompt: 'Are vessels being observed?' },
  { id: 'gulf_of_aden', label: 'Gulf of Aden', prompt: 'Are vessels being observed?' },
];

const WINDOWS: Array<{ id: InvestigationWindow; label: string }> = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 complete UTC days' },
];

function statusLabel(status: ClaimEvaluation['status']): string {
  switch (status) {
    case 'activity_observed': return 'Activity observed';
    case 'reduction_observed': return 'Reduction observed';
    case 'no_clear_reduction': return 'Reduction threshold not reached';
    case 'insufficient': return 'Insufficient evidence';
    case 'unsupported': return 'Unsupported';
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'No fix recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(date) + ' UTC';
}

function shipTypeLabel(shipType: number | null): string {
  if (shipType === null) return 'Unclassified';
  const family = shipType >= 80 && shipType <= 89 ? 'Tanker' : `AIS type ${Math.floor(shipType / 10) * 10}`;
  return `${family} · ${shipType}`;
}

function ContextSources({ context }: { context: RegionContext | null }) {
  if (!context) {
    return (
      <section aria-labelledby="context-sources-heading" className="mt-4 border border-gray-800 bg-gray-950/60">
        <div className="border-b border-gray-800 px-4 py-3">
          <h2 id="context-sources-heading" className="text-xs font-mono uppercase tracking-widest text-gray-200">Regional context</h2>
        </div>
        <p className="px-4 py-4 text-xs text-gray-600">Additional public context is temporarily unavailable. AIS evidence above remains independent.</p>
      </section>
    );
  }

  const port = context.sources.portwatch;
  const marine = context.sources.marine;
  const latestPortDay = 'rows' in port && port.rows?.length ? port.rows[0] : null;

  return (
    <section aria-labelledby="context-sources-heading" className="mt-4 border border-gray-800 bg-gray-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Separate evidence stream</p>
          <h2 id="context-sources-heading" className="mt-1 text-xs font-mono uppercase tracking-widest text-gray-200">Regional context</h2>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Does not determine claim result</span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-gray-800 md:grid-cols-2 md:divide-x md:divide-y-0">
        <article className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={port.source.url} target="_blank" rel="noreferrer" className="text-xs text-gray-200 underline decoration-gray-700 underline-offset-2 hover:text-amber-400">{port.source.name}</a>
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">{port.status.replace('_', ' ')}</span>
          </div>
          {latestPortDay ? (
            <>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">Latest source day · {latestPortDay.date}{port.status === 'available' && port.stale ? ' · stale' : ''}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="border border-gray-800 bg-black px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-gray-600">All categories</p><p className="mt-1 text-lg font-mono tabular-nums text-gray-200">{latestPortDay.counts.n_total.toLocaleString()}</p></div>
                <div className="border border-gray-800 bg-black px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-gray-600">Tanker category</p><p className="mt-1 text-lg font-mono tabular-nums text-amber-400">{latestPortDay.counts.n_tanker.toLocaleString()}</p></div>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-5 text-gray-500">{'error' in port ? port.error : 'reason' in port ? port.reason : 'No daily rows were returned.'}</p>
          )}
          <p className="mt-3 text-[10px] leading-4 text-gray-600">Daily category counts from the source; they are not cargo volume or official canal totals. {port.source.attribution} <a href={port.source.licenseUrl} target="_blank" rel="noreferrer" className="underline decoration-gray-700 underline-offset-2">Terms</a></p>
        </article>

        <article className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={marine.source.url} target="_blank" rel="noreferrer" className="text-xs text-gray-200 underline decoration-gray-700 underline-offset-2 hover:text-amber-400">{marine.source.name}</a>
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">{marine.status.replace('_', ' ')}</span>
          </div>
          {'forecast' in marine && marine.forecast ? (
            <>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">Forecast valid · {formatDate(marine.forecast.validAt)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="border border-gray-800 bg-black px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-gray-600">Wave height</p><p className="mt-1 text-lg font-mono tabular-nums text-gray-200">{marine.forecast.waveHeightM.toFixed(1)} m</p></div>
                <div className="border border-gray-800 bg-black px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-gray-600">Current speed</p><p className="mt-1 text-lg font-mono tabular-nums text-gray-200">{marine.forecast.currentVelocityKmh.toFixed(1)} km/h</p></div>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-5 text-gray-500">{'error' in marine ? marine.error : 'No valid forecast point was returned.'}</p>
          )}
          <p className="mt-3 text-[10px] leading-4 text-gray-600">Hourly ocean forecast at a fixed regional point, not a vessel movement record. {marine.source.attribution} <a href={marine.source.licenseUrl} target="_blank" rel="noreferrer" className="underline decoration-gray-700 underline-offset-2">Terms</a></p>
        </article>
      </div>
    </section>
  );
}

export function InvestigationsClient() {
  const [region, setRegion] = useState<InvestigationRegion>('hormuz');
  const [window, setWindow] = useState<InvestigationWindow>('24h');
  const [claimText, setClaimText] = useState('Hormuz traffic stopped');
  const [result, setResult] = useState<ClaimCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllVessels, setShowAllVessels] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  async function runCheck(
    selectedRegion: InvestigationRegion,
    selectedWindow: InvestigationWindow,
    text: string,
  ) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestSignal = controller.signal;
    setResult(null);
    setShowAllVessels(false);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ window: selectedWindow, claim: text });
      const response = await fetch(`/api/investigations/${selectedRegion}?${params}`, { signal: requestSignal, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Investigation evidence is unavailable.');
      setResult(payload as ClaimCheckResult);
    } catch (cause) {
      if (requestSignal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return;
      setError(cause instanceof Error ? cause.message : 'Investigation evidence is unavailable.');
      setResult(null);
    } finally {
      if (!requestSignal.aborted && activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void runCheck('hormuz', '24h', 'Hormuz traffic stopped');
    return () => activeRequest.current?.abort();
    // Initial evidence is deliberately loaded once; later checks use the submitted controls.
  }, []);

  function onRegionChange(value: InvestigationRegion) {
    setRegion(value);
    setClaimText(REGION_OPTIONS.find((option) => option.id === value)?.prompt ?? '');
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runCheck(region, window, claimText.trim());
  }

  const evidence = result?.evidence ?? null;
  const current = evidence?.activity.current;
  const previous = evidence?.activity.previous;
  const delta = current && previous ? current.contacts - previous.contacts : null;
  const deltaPercent = delta !== null && previous && previous.contacts > 0
    ? Math.round(delta / previous.contacts * 100)
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-7xl px-6 py-8 phone:px-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-amber-500/20 pb-5">
          <div>
            <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500">Analyst workspace / 01</p>
            <h1 className="text-2xl font-mono uppercase tracking-wider text-gray-100">Investigations</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Test a specific claim against dated observations. Empty coverage stays uncertain; a contact is not automatically a passage.
            </p>
          </div>
          <div className="flex gap-2"><Link href="/investigations/encounters" className="border border-amber-500/50 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-amber-400 hover:bg-amber-500/10">Encounter Caseboard ↗</Link><Link href="/dashboard" className="border border-gray-700 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:border-amber-500/50 hover:text-amber-400">Open live map</Link></div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
          <section aria-labelledby="claim-checker-heading" className="min-w-0 border border-gray-800 bg-gray-950/60">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">01 / Claim Checker</p>
                <h2 id="claim-checker-heading" className="mt-1 text-xs font-mono uppercase tracking-widest text-gray-200">What does the record support?</h2>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Bounded checks</span>
            </div>

            <form onSubmit={submit} className="grid grid-cols-1 gap-3 border-b border-gray-800 p-4 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-mono uppercase tracking-widest text-gray-600">Region</span>
                <select value={region} onChange={(event) => onRegionChange(event.target.value as InvestigationRegion)} className="h-10 w-full border border-gray-700 bg-black px-2 text-xs text-gray-200 focus:border-amber-500 focus:outline-none">
                  {REGION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-mono uppercase tracking-widest text-gray-600">Comparison window</span>
                <select value={window} onChange={(event) => setWindow(event.target.value as InvestigationWindow)} className="h-10 w-full border border-gray-700 bg-black px-2 text-xs text-gray-200 focus:border-amber-500 focus:outline-none">
                  {WINDOWS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <div className="flex items-end">
                <button type="submit" disabled={loading} className="h-10 w-full border border-amber-500/60 px-4 text-[10px] font-mono uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-500/10 disabled:cursor-wait disabled:opacity-50 sm:w-auto">
                  {loading ? 'Checking…' : 'Check claim'}
                </button>
              </div>
              <label className="block sm:col-span-3">
                <span className="mb-1 block text-[9px] font-mono uppercase tracking-widest text-gray-600">Claim or question</span>
                <input value={claimText} onChange={(event) => setClaimText(event.target.value)} maxLength={180} className="h-10 w-full border border-gray-700 bg-black px-3 text-xs text-gray-200 placeholder:text-gray-700 focus:border-amber-500 focus:outline-none" aria-describedby="claim-examples" />
                <span id="claim-examples" className="mt-1 block text-[10px] text-gray-600">Supported examples: “Hormuz traffic stopped”, “Suez disruption”, “Are vessels being observed?”</span>
              </label>
            </form>

            {error && <div role="alert" className="m-4 border border-red-900/70 bg-red-950/20 px-3 py-2 text-xs text-red-300">{error}</div>}

            {!result && loading && <p className="px-4 py-7 text-center text-xs font-mono uppercase tracking-widest text-gray-600" aria-live="polite">Updating the selected evidence…</p>}
            {result && (
              <div className="p-4" aria-busy={loading}>
                <p className="mb-3 text-[10px] font-mono uppercase tracking-wider text-gray-600">
                  Submitted check · {REGION_OPTIONS.find((option) => option.id === result.region)?.label} · {WINDOWS.find((option) => option.id === result.window)?.label} · “{result.claim.normalized}”
                </p>
                {loading && <p className="mb-3 text-[10px] font-mono uppercase tracking-wider text-amber-500" aria-live="polite">Updating selected evidence…</p>}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-amber-400">{statusLabel(result.evaluation.status)}</span>
                  {result.claim.supported && <span className="text-[10px] text-gray-600">Matched: {result.claim.description}</span>}
                </div>
                <h3 className="text-lg font-mono text-gray-100">{result.evaluation.headline}</h3>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-400">{result.evaluation.basis}</p>
                {result.claim.supported && evidence && <SaveFollowActions key={`${result.region}:${result.window}:${result.claim.normalized}`} region={result.region} window={result.window} claimText={result.claim.normalized} evidence={evidence} evaluation={result.evaluation} />}

                {!result.claim.supported ? (
                  <div className="mt-4 border-l-2 border-amber-500/50 bg-black px-3 py-3 text-xs leading-5 text-gray-400">
                    {result.evaluation.observedQuantity}. Try one of the supported examples above; other wording is not interpreted.
                  </div>
                ) : current && previous && (
                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="border border-gray-800 bg-black p-3">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Current observed contacts</p>
                      <p className="mt-2 text-2xl font-mono tabular-nums text-amber-400">{current.contacts.toLocaleString()}</p>
                      <p className="mt-1 text-[10px] text-gray-600">{current.label}</p>
                    </div>
                    <div className="border border-gray-800 bg-black p-3">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Reference contacts</p>
                      <p className="mt-2 text-2xl font-mono tabular-nums text-gray-200">{previous.contacts.toLocaleString()}</p>
                      <p className="mt-1 text-[10px] text-gray-600">{previous.label}</p>
                    </div>
                    <div className="border border-gray-800 bg-black p-3">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Change in distinct MMSIs</p>
                      <p className="mt-2 text-2xl font-mono tabular-nums text-gray-200">
                        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString()}`}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-600">{deltaPercent === null ? 'Percent change unavailable' : `${deltaPercent > 0 ? '+' : ''}${deltaPercent}% vs reference`}</p>
                    </div>
                  </div>
                )}

                {evidence && (
                  <div className="mt-4 border-t border-gray-800 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider">
                      <span className="text-gray-500">Collection: <b className="font-normal text-gray-300">{evidence.coverage.quality}</b></span>
                      <span className="text-gray-600">Latest regional fix: {formatDate(evidence.coverage.latestFix)}</span>
                    </div>
                    {evidence.coverage.nonEmptyHoursOfSix !== null && <p className="mt-1 text-[10px] text-gray-600">{evidence.coverage.nonEmptyHoursOfSix} of the last 6 hourly collection windows contained messages.</p>}
                    {evidence.coverage.historicalDays && <p className="mt-1 text-[10px] text-gray-600">Collection records appeared on {evidence.coverage.historicalDays.current}/{evidence.coverage.historicalDays.expected} selected days and {evidence.coverage.historicalDays.previous}/{evidence.coverage.historicalDays.expected} reference days. A recorded day does not prove continuous coverage.</p>}
                    {result.region === 'suez' && evidence.passages && (
                      <div className="mt-4 border border-gray-800 bg-black p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-300">Completed gate-to-gate passages</h4>
                          <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Suez model only</span>
                        </div>
                        <p className="mt-2 text-[10px] font-mono text-gray-500">{evidence.passages.current.startsAt} to {evidence.passages.current.endsAt} UTC · previous {evidence.passages.previous.startsAt} to {evidence.passages.previous.endsAt} UTC</p>
                        <p className="mt-2 text-xs text-gray-400">{result.evaluation.observedQuantity}</p>
                        <p className="mt-2 text-[10px] leading-4 text-gray-600">Incomplete tracks: {evidence.passages.current.incomplete} · Waiting contacts: {evidence.passages.current.waiting} · daily records {evidence.passages.current.daysWithData}/{evidence.passages.current.daysExpected} vs {evidence.passages.previous.daysWithData}/{evidence.passages.previous.daysExpected}.</p>
                        {evidence.passages.current.latestComputedAt && <p className="mt-1 text-[9px] font-mono uppercase tracking-wider text-gray-700">Latest crossing calculation {formatDate(evidence.passages.current.latestComputedAt)}</p>}
                      </div>
                    )}
                    <ul className="mt-3 space-y-1 text-[10px] leading-4 text-gray-600">
                      {evidence.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
                    </ul>
                    <p className="mt-3 text-[9px] font-mono uppercase tracking-wider text-gray-700">Evidence generated {formatDate(evidence.generatedAt)}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="who-gets-through-heading" className="min-w-0 border border-gray-800 bg-gray-950/60">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">02 / Who Gets Through?</p>
                <h2 id="who-gets-through-heading" className="mt-1 text-xs font-mono uppercase tracking-widest text-gray-200">Observed vessel mix</h2>
              </div>
              {evidence && <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">n = {evidence.activity.current.contacts.toLocaleString()}</span>}
            </div>
            <div className="px-4 py-3">
              <p className="mb-4 text-[10px] leading-4 text-gray-600">Contacts recorded inside the selected region. Membership here does not establish a completed transit.</p>
              {!evidence ? (
                <p className="border border-gray-800 bg-black px-3 py-7 text-center text-xs text-gray-600">Run a supported check to load the observed sample.</p>
              ) : evidence.cohorts.length === 0 ? (
                <p className="border border-gray-800 bg-black px-3 py-7 text-center text-xs text-gray-600">No vessel contacts were recorded in this window.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[21rem] border-collapse text-left">
                      <thead><tr className="border-b border-gray-800 text-[9px] font-mono uppercase tracking-wider text-gray-600"><th className="py-2 pr-2 font-normal">Flag</th><th className="py-2 pr-2 font-normal">AIS type</th><th className="py-2 text-right font-normal">Sample</th></tr></thead>
                      <tbody>{evidence.cohorts.map((cohort) => (
                        <tr key={`${cohort.flag}-${cohort.shipType}`} className="border-b border-gray-900 text-xs text-gray-300">
                          <td className="py-2 pr-2">{cohort.flag}</td>
                          <td className="py-2 pr-2 text-gray-500">{shipTypeLabel(cohort.shipType)}</td>
                          <td className="py-2 text-right font-mono tabular-nums text-amber-400">{cohort.sampleSize.toLocaleString()}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="mt-5 border-t border-gray-800 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Individual observed contacts</h3>
                      <span className="text-[9px] font-mono text-gray-700">latest sample · {evidence.vessels.length}</span>
                    </div>
                    <ul className="max-h-[25rem] divide-y divide-gray-900 overflow-y-auto">
                      {evidence.vessels.slice(0, showAllVessels ? 30 : 10).map((vessel) => (
                        <li key={vessel.imo ?? vessel.mmsi}>
                          <div className="flex min-h-11 items-center justify-between gap-3 py-2 text-xs">
                            <span className="min-w-0 truncate text-gray-300">{vessel.name}<span className="ml-2 text-[10px] text-gray-600">{vessel.flag ?? 'Flag unknown'} · {vessel.imo ?? vessel.mmsi}</span></span>
                            <span className="flex shrink-0 items-center gap-3 font-mono text-[9px]"><span className="text-gray-600">{formatDate(vessel.observedAt)}</span>{vessel.imo && /^\d{7}$/.test(vessel.imo) && <Link href={`/investigations/encounters/${vessel.imo}`} className="text-amber-400 underline underline-offset-2 hover:text-amber-200">Caseboard</Link>}<Link href={vessel.mapHref} className="text-gray-400 underline underline-offset-2 hover:text-white">Map</Link></span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {evidence.vessels.length > 10 && (
                      <button type="button" onClick={() => setShowAllVessels((value) => !value)} className="mt-2 min-h-11 text-[10px] font-mono uppercase tracking-wider text-amber-500 hover:text-amber-300">
                        {showAllVessels ? 'Show fewer contacts' : `Show all ${evidence.vessels.length} sampled contacts`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
        {evidence && <ContextSources context={evidence.context} />}
        <p className="mt-4 text-[9px] font-mono uppercase tracking-wider text-gray-700">Straits observation record · AIS positions are observations; passages require their own route model.</p>
      </main>
    </div>
  );
}

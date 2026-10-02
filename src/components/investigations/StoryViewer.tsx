'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { InvestigationStoryRecord } from '@/lib/investigations/story-model';

const STEPS = ['Assessment', 'Counts & coverage', 'Observed vessels', 'Sources & limits'];
const REGION_LABELS = { hormuz: 'Strait of Hormuz', suez: 'Suez Canal', babel_mandeb: 'Bab el-Mandeb', gulf_of_aden: 'Gulf of Aden' } as const;

function formatDate(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : `${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`;
}

function statusLabel(value: string): string {
  if (value === 'no_clear_reduction') return 'below signal threshold';
  return value.replaceAll('_', ' ');
}

export function StoryViewer({ story }: { story: InvestigationStoryRecord }) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const snapshot = story.snapshot;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyFallback('');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyFallback(window.location.href);
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-8 phone:px-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500">Immutable evidence snapshot · {REGION_LABELS[snapshot.region]}</p>
          <h1 className="max-w-3xl text-xl font-mono text-gray-100">{snapshot.claim.text}</h1>
          <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-gray-600">Saved {formatDate(story.createdAt)} · {snapshot.window} comparison</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyLink()} className="border border-gray-700 px-3 py-2 text-[9px] font-mono uppercase tracking-wider text-gray-300 hover:border-amber-500/50 hover:text-amber-400">{copied ? 'Copied' : 'Copy link'}</button>
          <Link href={`/embed/investigations/${story.id}`} className="border border-gray-700 px-3 py-2 text-[9px] font-mono uppercase tracking-wider text-gray-400 hover:text-amber-400">Embed view</Link>
        </div>
      </div>
      {copyFallback && <label className="mb-4 block text-[10px] text-gray-500">Clipboard unavailable. Select and copy this story URL.<input readOnly value={copyFallback} onFocus={(event) => event.currentTarget.select()} className="mt-1 min-h-10 w-full border border-gray-800 bg-gray-950 px-2 font-mono text-[10px] text-gray-300" /></label>}

      <ol aria-label="Story steps" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} className={`min-h-10 w-full border px-2 text-left text-[9px] font-mono uppercase tracking-wider ${step === index ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-gray-800 text-gray-600 hover:text-gray-300'}`}><span className="mr-2 text-gray-700">0{index + 1}</span>{label}</button></li>)}
      </ol>

      <section aria-live="polite" className="min-h-72 border border-gray-800 bg-gray-950/60 p-4 sm:p-6">
        {step === 0 && <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Assessment at save time</p>
          <span className="mt-3 inline-block border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-amber-400">{statusLabel(snapshot.evaluation.status)}</span>
          <h2 className="mt-4 text-xl font-mono text-gray-100">{snapshot.evaluation.headline}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">{snapshot.evaluation.basis}</p>
          <p className="mt-4 border-l-2 border-amber-500/40 bg-black px-3 py-3 text-xs text-gray-300">{snapshot.evaluation.observedQuantity}</p>
          <p className="mt-5 text-[10px] text-gray-600">Question: “{snapshot.claim.text}” · {snapshot.claim.description}</p>
          {snapshot.annotation && <blockquote className="mt-5 border-t border-gray-800 pt-4 text-xs italic leading-5 text-gray-400">{snapshot.annotation}</blockquote>}
        </div>}

        {step === 1 && <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Observed counts and collection coverage</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[snapshot.evidence.activity.current, snapshot.evidence.activity.previous].map((period, index) => <div key={period.startsAt} className="border border-gray-800 bg-black p-4">
              <p className="text-[9px] font-mono uppercase tracking-wider text-gray-600">{index === 0 ? 'Selected window' : 'Reference window'}</p>
              <p className="mt-2 text-3xl font-mono tabular-nums text-amber-400">{period.contacts.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-300">distinct vessel contacts</p>
              <p className="mt-3 text-[10px] leading-4 text-gray-600">{period.label}<br />{formatDate(period.startsAt)} – {formatDate(period.endsAt)}</p>
            </div>)}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border border-gray-800 p-3"><p className="text-[9px] font-mono uppercase text-gray-600">Collection quality</p><p className="mt-2 text-sm font-mono text-gray-200">{snapshot.evidence.coverage.quality}</p></div>
            <div className="border border-gray-800 p-3"><p className="text-[9px] font-mono uppercase text-gray-600">Latest regional fix</p><p className="mt-2 text-xs text-gray-300">{formatDate(snapshot.evidence.coverage.latestFix)}</p></div>
            <div className="border border-gray-800 p-3"><p className="text-[9px] font-mono uppercase text-gray-600">Evidence generated</p><p className="mt-2 text-xs text-gray-300">{formatDate(snapshot.evidence.generatedAt)}</p></div>
          </div>
          {snapshot.evidence.coverage.nonEmptyHoursOfSix !== null && <p className="mt-3 text-xs text-gray-500">{snapshot.evidence.coverage.nonEmptyHoursOfSix} of the latest 6 hourly collection windows contained messages.</p>}
          {snapshot.evidence.passages && <p className="mt-3 text-xs text-gray-400">Suez model: {snapshot.evidence.passages.current.completed} completed, {snapshot.evidence.passages.current.incomplete} incomplete, {snapshot.evidence.passages.current.waiting} waiting; daily aggregates {snapshot.evidence.passages.current.daysWithData}/{snapshot.evidence.passages.current.daysExpected}.</p>}
        </div>}

        {step === 2 && <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Observed sample</p><h2 className="mt-1 text-sm font-mono uppercase text-gray-200">Vessels recorded in the selected region</h2></div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Snapshot list · {snapshot.evidence.vessels.length} shown</span>
          </div>
          <p className="mt-2 text-[10px] text-gray-600">These contacts do not establish completed passages. Map links open current map context and are not historical replay.</p>
          {snapshot.evidence.vessels.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[35rem] border-collapse text-left text-xs">
            <thead><tr className="border-b border-gray-800 font-mono uppercase tracking-wider text-gray-600"><th className="py-2 pr-3 font-normal">Vessel</th><th className="py-2 pr-3 font-normal">Flag / type</th><th className="py-2 pr-3 font-normal">Observed</th><th className="py-2 font-normal">Map</th></tr></thead>
            <tbody>{snapshot.evidence.vessels.map((vessel) => <tr key={vessel.imo ?? vessel.mmsi} className="border-b border-gray-900 text-gray-300"><td className="py-2 pr-3">{vessel.name}<span className="ml-2 text-[9px] text-gray-600">{vessel.imo ?? vessel.mmsi}</span></td><td className="py-2 pr-3 text-gray-500">{vessel.flag ?? 'Unknown flag'} · {vessel.shipType ?? 'Unclassified'}</td><td className="py-2 pr-3 text-[10px] text-gray-500">{formatDate(vessel.observedAt)}</td><td className="py-2"><Link className="text-[9px] uppercase text-amber-500 underline underline-offset-2" href={vessel.mapHref}>Current map</Link></td></tr>)}</tbody>
          </table></div> : <p className="mt-4 border border-gray-800 bg-black p-6 text-center text-xs text-gray-600">No vessel sample was recorded in this snapshot.</p>}
          {snapshot.evidence.cohorts.length > 0 && <p className="mt-4 text-[10px] text-gray-500">Cohort rows: {snapshot.evidence.cohorts.map((cohort) => `${cohort.flag} / ${cohort.shipType ?? 'unknown'} (${cohort.sampleSize})`).join(' · ')}</p>}
        </div>}

        {step === 3 && <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Source record and limitations</p>
          <ul className="mt-4 divide-y divide-gray-900 border-y border-gray-900">
            {snapshot.sources.map((source) => <li key={`${source.name}-${source.timestamp}`} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xs text-gray-200">{source.url ? <a className="underline decoration-gray-700 underline-offset-2 hover:text-amber-400" href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</h2><span className="text-[9px] font-mono text-gray-600">{formatDate(source.timestamp)}</span></div>
              <p className="mt-1 text-xs leading-5 text-gray-500">{source.records}</p>
              {source.attribution && <p className="mt-1 text-[10px] text-gray-600">{source.attribution} {source.licenseUrl && <a href={source.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Terms</a>}</p>}
            </li>)}
          </ul>
          <h2 className="mt-5 text-[9px] font-mono uppercase tracking-widest text-gray-600">Known limits</h2>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-500">{snapshot.evidence.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul>
          <p className="mt-5 border-t border-gray-800 pt-3 text-[10px] text-gray-600">This page preserves what was recorded at save time. It does not update when live evidence changes.</p>
        </div>}
      </section>

      <div className="mt-3 flex items-center justify-between">
        <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="min-h-10 border border-gray-800 px-4 text-[9px] font-mono uppercase tracking-wider text-gray-300 disabled:opacity-40">Previous</button>
        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-700">{step + 1} / {STEPS.length}</span>
        <button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))} className="min-h-10 border border-amber-500/40 px-4 text-[9px] font-mono uppercase tracking-wider text-amber-400 disabled:opacity-40">Next</button>
      </div>
    </main>
  );
}

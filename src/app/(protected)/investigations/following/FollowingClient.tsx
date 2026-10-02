'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { compareFollowBaseline, parseFollowList } from '@/lib/investigations/story-model';
import type { InvestigationFollow } from '@/lib/investigations/story-model';
import type { ClaimEvaluation, InvestigationRegion, InvestigationWindow } from '@/lib/investigations/claims';
import type { InvestigationEvidence } from '@/lib/investigations/evidence';

const FOLLOW_KEY = 'straits:investigation-follows:v1';

interface CurrentReport { evaluation: ClaimEvaluation; evidence: InvestigationEvidence }
interface FollowState { item: InvestigationFollow; report?: CurrentReport; reasons?: string[]; checkedAt?: string; error?: string }

const REGION_LABELS: Record<InvestigationRegion, string> = {
  hormuz: 'Strait of Hormuz',
  suez: 'Suez Canal',
  babel_mandeb: 'Bab el-Mandeb',
  gulf_of_aden: 'Gulf of Aden',
};

function humanTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : `${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`;
}

export function FollowingClient() {
  const [items, setItems] = useState<InvestigationFollow[]>([]);
  const [states, setStates] = useState<FollowState[]>([]);
  const [checking, setChecking] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const checkNow = useCallback(async (selected = items) => {
    setChecking(true);
    const checks = await Promise.all(selected.map(async (item): Promise<FollowState> => {
      try {
        const query = new URLSearchParams({ claim: item.claimText, window: item.window });
        const response = await fetch(`/api/investigations/${item.region}?${query}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload?.evaluation || !payload?.evidence) throw new Error(payload?.error ?? 'Current evidence could not be loaded.');
        const report: CurrentReport = { evaluation: payload.evaluation, evidence: payload.evidence };
        return { item, report, reasons: compareFollowBaseline(item.baseline, report).reasons, checkedAt: new Date().toISOString() };
      } catch (cause) {
        return { item, error: cause instanceof Error ? cause.message : 'Current evidence could not be loaded.' };
      }
    }));
    setStates(checks);
    setChecking(false);
  }, [items]);

  useEffect(() => {
    let saved: InvestigationFollow[];
    try {
      saved = parseFollowList(localStorage.getItem(FOLLOW_KEY));
    } catch {
      setStorageError('Browser storage is unavailable. Following cannot be loaded or changed in this browser.');
      setChecking(false);
      return;
    }
    setItems(saved);
    void checkNow(saved);
  // Load browser-local follows once, then compare explicitly on this page visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unfollow(key: string) {
    const next = items.filter((item) => item.key !== key);
    setItems(next);
    setStates((current) => current.filter((state) => state.item.key !== key));
    try {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
      setStorageError(null);
    } catch {
      setStorageError('Browser storage is unavailable. This unfollow change may not persist after leaving the page.');
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-8 phone:px-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500">Analyst workspace / 02</p>
          <h1 className="text-2xl font-mono uppercase tracking-wider text-gray-100">Following</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">Saved on this device. Questions are checked when you open this page; there are no background alerts.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void checkNow()} disabled={checking || items.length === 0} className="border border-gray-700 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-gray-300 hover:border-amber-500/50 hover:text-amber-400 disabled:opacity-50">{checking ? 'Checking…' : 'Check again'}</button>
          <Link href="/investigations" className="border border-gray-700 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-amber-400">New check</Link>
        </div>
      </div>

      {storageError && <p role="alert" className="mb-3 border border-red-900/70 bg-red-950/20 px-3 py-2 text-xs text-red-300">{storageError}</p>}

      {items.length === 0 ? (
        <div className="border border-gray-800 bg-gray-950/60 p-8 text-center">
          <p className="text-xs text-gray-500">No followed questions are saved in this browser.</p>
          <Link href="/investigations" className="mt-3 inline-block text-[10px] font-mono uppercase tracking-wider text-amber-400 underline underline-offset-4">Open Investigations</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const state = states.find((candidate) => candidate.item.key === item.key);
            const changed = !!state?.reasons?.length;
            return (
              <article key={item.key} className="border border-gray-800 bg-gray-950/60">
                <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">{REGION_LABELS[item.region]} · {item.window} comparison</p>
                    <h2 className="mt-2 text-base font-mono text-gray-100">“{item.claimText}”</h2>
                    <p className="mt-2 text-[10px] text-gray-600">Baseline saved {humanTime(item.savedAt)} · {item.baseline.contacts.toLocaleString()} observed contacts</p>
                    {state?.checkedAt && <p className="mt-1 text-[9px] font-mono uppercase tracking-wider text-gray-700">Checked {humanTime(state.checkedAt)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`border px-2 py-1 text-[9px] font-mono uppercase tracking-wider ${state?.error ? 'border-red-900 text-red-300' : changed ? 'border-amber-500/50 text-amber-400' : state?.report ? 'border-emerald-900 text-emerald-400' : 'border-gray-800 text-gray-600'}`}>
                      {state?.error ? 'Check unavailable' : changed ? 'Material update' : state?.report ? 'No material change' : 'Checking'}
                    </span>
                    <button type="button" onClick={() => unfollow(item.key)} className="min-h-9 border border-gray-800 px-3 text-[9px] font-mono uppercase tracking-wider text-gray-500 hover:border-red-900 hover:text-red-300">Unfollow</button>
                  </div>
                </div>
                {state?.error && <p role="alert" className="border-t border-gray-800 px-4 py-3 text-xs text-red-300">{state.error}</p>}
                {state?.report && <div className="border-t border-gray-800 px-4 py-3">
                  <p className="text-xs text-gray-200">{state.report.evaluation.headline}</p>
                  <p className="mt-1 text-[10px] text-gray-500">Now: {state.report.evidence.activity.current.contacts.toLocaleString()} contacts · collection {state.report.evidence.coverage.quality}</p>
                  {!!state.reasons?.length && <ul className="mt-2 space-y-1 text-[10px] text-amber-300">{state.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>}
                  <p className="mt-2 text-[10px] text-gray-600">{state.report.evidence.limitations[0]}</p>
                </div>}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

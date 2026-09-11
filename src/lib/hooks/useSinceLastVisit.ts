'use client';

/**
 * "Since your last visit" — what changed while the visitor was away.
 *
 * The previous visit's timestamp lives in localStorage; a sessionStorage
 * flag stops re-mounts within one session from advancing it, so the number
 * stays meaningful for the whole visit. Counts come from /api/anomalies
 * (active events) compared against that timestamp.
 */
import { useEffect, useState } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { compactAge } from '@/components/ui/StatusChip';

const LAST_VISIT_KEY = 'straits:lastVisit';
const SESSION_KEY = 'straits:visitSession';

export interface SinceLastVisit {
  /** Previous visit timestamp. */
  since: Date;
  /** Compact age of that visit ("3d"), computed once at mount. */
  sinceLabel: string;
  /** Active events detected after `since`. */
  newEvents: number;
  /** Of those, on vessels in the watchlist. */
  onWatched: number;
}

/** Pure counting so the rule is testable without storage or fetch. */
export function countSince(
  anomalies: Array<{ detectedAt: string | Date; imo: string }>,
  since: Date,
  watchedImos: Set<string>,
): { newEvents: number; onWatched: number } {
  let newEvents = 0;
  let onWatched = 0;
  for (const a of anomalies) {
    const at = new Date(a.detectedAt).getTime();
    if (Number.isNaN(at) || at <= since.getTime()) continue;
    newEvents++;
    if (watchedImos.has(a.imo)) onWatched++;
  }
  return { newEvents, onWatched };
}

/** Read the previous visit and stamp this one. Exported for tests. */
export function rememberVisit(now: Date = new Date()): Date | null {
  if (typeof window === 'undefined') return null;
  try {
    const previous = window.localStorage.getItem(LAST_VISIT_KEY);
    if (!window.sessionStorage.getItem(SESSION_KEY)) {
      window.sessionStorage.setItem(SESSION_KEY, '1');
      // Store an empty sentinel for a first-ever visit. Without it, a React
      // development remount sees the timestamp just written to localStorage
      // and mistakes the current visit for a previous one.
      window.sessionStorage.setItem(`${SESSION_KEY}:prev`, previous ?? '');
      window.localStorage.setItem(LAST_VISIT_KEY, now.toISOString());
      return previous ? new Date(previous) : null;
    }
    // Same session: the previous visit is fixed at session start. An empty
    // value means this is still the user's first-ever visit.
    const sessionPrev = window.sessionStorage.getItem(`${SESSION_KEY}:prev`);
    return sessionPrev ? new Date(sessionPrev) : null;
  } catch {
    return null;
  }
}

/** Read the session's fixed previous visit without mutating storage. */
function readPreviousVisit(): Date | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
      ? window.sessionStorage.getItem(`${SESSION_KEY}:prev`)
      : window.localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return null;
    const previous = new Date(raw);
    return Number.isNaN(previous.getTime()) ? null : previous;
  } catch {
    return null;
  }
}

export function useSinceLastVisit(): SinceLastVisit | null {
  const watchlist = useVesselStore((s) => s.watchlist);
  const [visit] = useState(() => {
    const since = readPreviousVisit();
    return since ? { since, sinceLabel: compactAge(since) } : null;
  });
  const [anomalies, setAnomalies] = useState<Array<{ detectedAt: string; imo: string }> | null>(null);

  useEffect(() => {
    rememberVisit();
  }, []);

  useEffect(() => {
    if (!visit) return;
    let cancelled = false;
    fetch('/api/anomalies')
      .then((r) => (r.ok ? r.json() : { anomalies: [] }))
      .then((d) => { if (!cancelled) setAnomalies(d.anomalies ?? []); })
      .catch(() => { if (!cancelled) setAnomalies([]); });
    return () => { cancelled = true; };
  }, [visit]);

  if (!visit || !anomalies) return null;
  const watched = new Set(watchlist.map((w) => w.imo));
  return { ...visit, ...countSince(anomalies, visit.since, watched) };
}

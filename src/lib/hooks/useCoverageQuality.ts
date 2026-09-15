'use client';

/**
 * Per-chokepoint observation quality from /api/coverage, shared across every
 * subscriber through usePolledJson so the header widgets, the mobile sheet and
 * the analytics page add exactly one poller between them.
 */
import { usePolledJson } from './usePolledJson';
import type { ObservationQuality } from '@/lib/constants/coverage';

export interface CoverageBasis {
  bucketsLast6h: number;
  nonEmptyLast6h: number;
  latestFix: string | null;
  latestFixAgeMinutes: number | null;
  unique24h: number;
}

export interface ChokepointCoverage {
  id: string;
  name: string;
  quality: ObservationQuality;
  basis: CoverageBasis;
  subscribed: boolean;
}

const POLL_MS = 60_000;

async function fetchCoverage(): Promise<Record<string, ChokepointCoverage>> {
  const res = await fetch('/api/coverage');
  if (!res.ok) throw new Error(`coverage ${res.status}`);
  const json = (await res.json()) as { chokepoints?: ChokepointCoverage[] };
  return Object.fromEntries((json.chokepoints ?? []).map((c) => [c.id, c]));
}

/** Map of chokepoint id → quality, or null until the first response lands. */
export function useCoverageQuality(): Record<string, ChokepointCoverage> | null {
  return usePolledJson('/api/coverage', fetchCoverage, POLL_MS);
}

/** Rank for "best observed first" ordering. */
export const QUALITY_RANK: Record<ObservationQuality, number> = { recent: 0, intermittent: 1, insufficient: 2 };

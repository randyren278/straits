'use client';

/**
 * Hourly collection record per chokepoint from /api/coverage/history, shared
 * across subscribers via usePolledJson (one poller per window length).
 */
import { usePolledJson } from './usePolledJson';
import type { RegionHistory, HourlyBucket } from '@/lib/db/coverage';

export type { RegionHistory, HourlyBucket };

const POLL_MS = 5 * 60_000;

async function fetchHistory(hours: number): Promise<RegionHistory[]> {
  const res = await fetch(`/api/coverage/history?hours=${hours}`);
  if (!res.ok) throw new Error(`coverage history ${res.status}`);
  const json = (await res.json()) as { regions?: RegionHistory[] };
  return json.regions ?? [];
}

export function useCoverageHistory(hours: 24 | 168): RegionHistory[] | null {
  return usePolledJson(`/api/coverage/history?hours=${hours}`, () => fetchHistory(hours), POLL_MS);
}

'use client';

import { usePolledJson } from './usePolledJson';

export interface ChokepointStat {
  id: string;
  name: string;
  totalVessels: number;
  tankerCount: number;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

async function fetchChokepoints(signal: AbortSignal): Promise<ChokepointStat[]> {
  const response = await fetch('/api/chokepoints', { signal });
  if (!response.ok) throw new Error(`chokepoints ${response.status}`);
  const data = await response.json();
  return data.chokepoints ?? [];
}

export function useChokepointStats(): ChokepointStat[] | null {
  return usePolledJson('/api/chokepoints', fetchChokepoints, 60_000);
}

'use client';
import { useEffect } from 'react';
import { usePolledJson } from './usePolledJson';
import { useTrackStore } from '@/stores/tracks';
import type { TracksResponse } from '@/lib/tracks/types';

const fetchTracks = async (signal: AbortSignal): Promise<TracksResponse> => {
  const res = await fetch('/api/tracks', { signal });
  if (!res.ok) throw new Error(`tracks ${res.status}`);
  return res.json();
};

/** Polls the track engine output and feeds the nowcaster. */
export function useTracks() {
  const data = usePolledJson<TracksResponse>('/api/tracks', fetchTracks, 60_000);
  const ingest = useTrackStore((s) => s.ingest);
  useEffect(() => { if (data && Array.isArray(data.vessels)) ingest(data); }, [data, ingest]);
}

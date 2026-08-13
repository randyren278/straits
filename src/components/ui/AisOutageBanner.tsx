/**
 * Says out loud why the map is empty.
 *
 * When the upstream AIS feed goes dark, every vessel layer renders nothing and
 * the dashboard looks indistinguishable from a broken deploy — during the Aug
 * 2026 provider outage the only signal a visitor got was a blank map and a
 * small amber dot in the header. This is the sentence that was missing.
 *
 * It reads `/api/status` through the same `usePolledJson` key StatusChip uses,
 * so it joins that component's existing poller rather than opening a second
 * one: the hook's registry is keyed by URL and ref-counts subscribers.
 */
'use client';

import { AlertTriangle } from 'lucide-react';
import { usePolledJson } from '@/lib/hooks/usePolledJson';
import type { StatusState } from './StatusChip';

async function fetchStatus(): Promise<StatusState> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error(`/api/status responded ${res.status}`);
  return res.json();
}

export function AisOutageBanner() {
  const status = usePolledJson<StatusState>('/api/status', fetchStatus, 60 * 1000);

  // Only the hard-offline state earns a banner. `degraded` is a late harvest,
  // which the header dot already covers, and `null` means the first poll has
  // not landed — announcing an outage there would flash on every cold load.
  if (status?.ais !== 'offline') return null;

  return (
    <div
      data-testid="ais-outage-banner"
      role="status"
      className="flex items-start gap-2 px-4 py-2 border-t border-red-500/30 bg-red-500/10"
    >
      <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-red-500" aria-hidden="true" />
      <p className="text-xs font-mono text-red-400 leading-relaxed">
        <span className="uppercase tracking-wider text-red-500">AIS feed offline</span>
        <span className="text-gray-400">
          {' — '}no live vessel positions are being received from the upstream AIS provider.
          Positions, tracks and chokepoint counts are stale or empty. Oil prices and news are unaffected.
        </span>
      </p>
    </div>
  );
}

/**
 * StatusBar component — shows live/degraded/offline indicators for AIS, prices, and news.
 * Polls /api/status every 60 seconds. Terminal aesthetic: tight, subtle, no animations.
 * Requirements: WIRE-05
 */
'use client';

import { useEffect, useState } from 'react';

type SourceStatus = 'live' | 'degraded' | 'offline' | null;

interface StatusState {
  ais: SourceStatus;
  prices: SourceStatus;
  news: SourceStatus;
}

function getDotColor(status: SourceStatus): string {
  switch (status) {
    case 'live': return 'bg-amber-500';
    case 'degraded': return 'bg-yellow-400';
    case 'offline': return 'bg-red-500';
    default: return 'bg-gray-600'; // loading
  }
}

function getLabelColor(status: SourceStatus): string {
  if (status === 'live' || status === 'degraded') return 'text-amber-500/60';
  return 'text-gray-500';
}

interface IndicatorProps {
  label: string;
  status: SourceStatus;
}

function Indicator({ label, status }: IndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(status)}`} />
      <span className={`text-xs font-mono uppercase tracking-wider ${getLabelColor(status)}`}>
        {label}
      </span>
    </div>
  );
}

export function StatusBar() {
  const [status, setStatus] = useState<StatusState>({ ais: null, prices: null, news: null });

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // Network error — leave current state unchanged
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 px-2 border-l border-amber-500/20">
      <Indicator label="AIS" status={status.ais} />
      <Indicator label="Prices" status={status.prices} />
      <Indicator label="News" status={status.news} />
    </div>
  );
}

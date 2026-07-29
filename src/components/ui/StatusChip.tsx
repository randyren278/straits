/**
 * Merged data-freshness and system-status indicator.
 *
 * On the live site these were two separate widgets 54px apart saying the same
 * thing in two visual languages — amber dots reading as a warning next to a
 * "less than a minute ago" claim. This is one element: a single dot carrying
 * the worst source state, the relative age beside it, and the per-source
 * breakdown behind a tap.
 *
 * It also owns the only /api/status poller. Both layouts render from one
 * component so the hidden one does not double the request rate.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { isValid } from 'date-fns';
import { useVesselStore } from '@/stores/vessel';
import { usePolledJson } from '@/lib/hooks/usePolledJson';

export type SourceStatus = 'live' | 'degraded' | 'offline' | null;

export interface StatusState {
  ais: SourceStatus;
  prices: SourceStatus;
  news: SourceStatus;
}

/**
 * Compact relative age for the mobile chip.
 *
 * date-fns' formatDistanceToNow returns prose — "less than a minute" is 19
 * characters, which ate roughly 250px of a 390px top bar and undid the point of
 * collapsing the header. The desktop half of this component has room for prose;
 * the chip does not.
 */
export function compactAge(at: Date, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at.getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const SEVERITY: SourceStatus[] = ['offline', 'degraded', 'live'];

export function worstStatus(s: StatusState): SourceStatus {
  const present = [s.ais, s.prices, s.news];
  return SEVERITY.find((level) => present.includes(level)) ?? null;
}

function dotClass(status: SourceStatus): string {
  switch (status) {
    case 'live': return 'bg-amber-500';
    case 'degraded': return 'bg-yellow-400';
    case 'offline': return 'bg-red-500';
    default: return 'bg-gray-600';
  }
}

function labelClass(status: SourceStatus): string {
  return status === 'live' || status === 'degraded' ? 'text-amber-500/60' : 'text-gray-500';
}

const SOURCES: Array<{ key: keyof StatusState; label: string }> = [
  { key: 'ais', label: 'AIS' },
  { key: 'prices', label: 'Prices' },
  { key: 'news', label: 'News' },
];

const DEFAULT_STATUS: StatusState = { ais: null, prices: null, news: null };

async function fetchStatus(): Promise<StatusState> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error(`/api/status responded ${res.status}`);
  return res.json();
}

export function StatusChip() {
  // Shared across every mounted copy (one per breakpoint) — see usePolledJson.
  const status = usePolledJson('/api/status', fetchStatus, 60 * 1000) ?? DEFAULT_STATUS;
  const [open, setOpen] = useState(false);
  const [age, setAge] = useState<string | null>(null);
  const { lastUpdate } = useVesselStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Recomputed on a tick so the impure clock read never happens during render.
  useEffect(() => {
    if (!lastUpdate || !isValid(lastUpdate)) {
      return;
    }
    const compute = () => setAge(compactAge(lastUpdate));
    compute();
    const interval = setInterval(compute, 10_000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const worst = worstStatus(status);
  const worstLabel = worst ?? 'unknown';
  // The chip's label is abbreviated for space; the accessible name is not.
  const spoken = age === 'now' ? 'data updated just now' : age ? `data updated ${age} ago` : null;
  const summary = spoken ? `Systems ${worstLabel}, ${spoken}` : `Systems ${worstLabel}`;

  return (
    <>
      {/* Mobile: one dot, one age, detail on tap. */}
      <div className="lg:hidden relative">
        <button
          type="button"
          data-testid="status-chip-mobile"
          aria-label={summary}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden min-h-[44px] min-w-[44px] px-2 inline-flex items-center gap-1.5"
        >
          <span className={`w-1.5 h-1.5 ${dotClass(worst)}`} />
          {age && <span className="text-xs font-mono text-gray-400">{age}</span>}
        </button>
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="System status detail"
            className="absolute right-0 top-full z-50 min-w-[180px] bg-black border border-amber-500/20 p-3 flex flex-col gap-2"
          >
            {SOURCES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 ${dotClass(status[key])}`} />
                <span className="text-xs font-mono uppercase tracking-wider text-gray-300">{label}</span>
                <span className={`ml-auto text-xs font-mono ${labelClass(status[key])}`}>
                  {status[key] ?? 'unknown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: unchanged three-indicator row. */}
      <div
        data-testid="status-chip-desktop"
        className="hidden lg:flex items-center gap-3 px-2 border-l border-amber-500/20"
        role="status"
        aria-label="System status indicators"
      >
        {SOURCES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 ${dotClass(status[key])}`} />
            <span className={`text-xs font-mono uppercase tracking-wider ${labelClass(status[key])}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

'use client';

/**
 * Current watch — the first thing on the rail.
 *
 * Three observations, each backed by a number and each a single tap from its
 * evidence: an event opens the contact's dossier on the map, a traffic change
 * flies to the zone, a coverage gap flies to the silent zone. Rendered from
 * /api/watch; see src/lib/watch/compose.ts for how the three are chosen.
 */
import { Radar, ChevronRight } from 'lucide-react';
import { usePolledJson } from '@/lib/hooks/usePolledJson';
import { useSinceLastVisit } from '@/lib/hooks/useSinceLastVisit';
import { useVesselStore } from '@/stores/vessel';
import type { WatchItem } from '@/lib/watch/compose';

interface WatchResponse {
  generatedAt: string;
  items: WatchItem[];
}

async function fetchWatch(): Promise<WatchResponse> {
  const res = await fetch('/api/watch');
  if (!res.ok) throw new Error(`/api/watch responded ${res.status}`);
  return res.json();
}

const TONE: Record<WatchItem['tone'], string> = {
  alert: 'border-l-red-500',
  warn: 'border-l-amber-500',
  info: 'border-l-gray-500',
};

const KIND_LABEL: Record<WatchItem['kind'], string> = {
  event: 'Contact',
  traffic: 'Region',
  coverage: 'Coverage',
};

/** Shared by the rail panel and the mobile peek strip. */
export function useCurrentWatch(): WatchItem[] | null {
  const data = usePolledJson<WatchResponse>('/api/watch', fetchWatch, 60 * 1000);
  return data ? data.items : null;
}

/** Navigate to an observation's evidence: map view first, dossier when there is one. */
export function openWatchItem(item: WatchItem): void {
  const store = useVesselStore.getState();
  if (!item.target) return;
  if (item.target.zoom > 0) {
    store.setMapCenter({ lat: item.target.lat, lon: item.target.lon, zoom: item.target.zoom });
  }
  if (item.target.imo) {
    store.setTargetVesselImo(item.target.imo);
  }
}

export function CurrentWatchPanel() {
  const items = useCurrentWatch();
  const sinceVisit = useSinceLastVisit();

  return (
    <div className="bg-black" role="region" aria-label="Current watch" data-testid="current-watch">
      <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center gap-2">
        <Radar className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">Current watch</span>
      </div>

      {sinceVisit && (
        <p data-testid="since-last-visit" className="px-3 py-1.5 border-b border-amber-500/10 text-[11px] font-mono text-gray-400">
          <span className="text-gray-500 uppercase tracking-wider text-[10px]">Since your last visit</span>
          <span className="text-gray-600">
            {' · '}{sinceVisit.sinceLabel === 'now' ? 'just now' : `${sinceVisit.sinceLabel} ago`}{' · '}
          </span>
          {sinceVisit.newEvents === 0
            ? 'no new events'
            : `${sinceVisit.newEvents} new event${sinceVisit.newEvents === 1 ? '' : 's'}`}
          {sinceVisit.onWatched > 0 && (
            <span className="text-amber-400"> · {sinceVisit.onWatched} on watched vessels</span>
          )}
        </p>
      )}

      {items === null && (
        <p className="px-3 py-2 text-xs text-gray-500 font-mono">Composing…</p>
      )}
      {items !== null && items.length === 0 && (
        <p className="px-3 py-2 text-xs text-gray-500 font-mono">
          Nothing unusual on watch. Feed live, zones fresh, no new events.
        </p>
      )}
      {items && items.map((item) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">{KIND_LABEL[item.kind]}</span>
              <span className="text-[10px] font-mono text-gray-500">{item.evidence}</span>
            </div>
            <div className="mt-0.5 text-xs text-gray-100 font-mono leading-snug">{item.title}</div>
            <div className="mt-0.5 text-[11px] text-gray-400 leading-snug">{item.detail}</div>
          </>
        );
        const cls = `w-full text-left px-3 py-2 border-b border-amber-500/10 border-l-2 ${TONE[item.tone]}`;
        return item.target ? (
          <button
            key={`${item.kind}-${item.at}`}
            type="button"
            onClick={() => openWatchItem(item)}
            className={`${cls} hover:bg-amber-500/5 focus:bg-amber-500/5 group`}
            aria-label={`${item.title}. ${item.detail}. Open on map`}
          >
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">{body}</div>
              <ChevronRight className="w-3.5 h-3.5 mt-1 text-gray-600 group-hover:text-amber-500 shrink-0" aria-hidden="true" />
            </div>
          </button>
        ) : (
          <div key={`${item.kind}-${item.at}`} className={cls}>{body}</div>
        );
      })}
    </div>
  );
}

/**
 * Dashboard bottom sheet.
 *
 * Replaces the stacked panel column that forced 3.11 screens of scrolling on a
 * phone. Peek shows a chokepoint strip; dragging up reveals tabbed panels.
 *
 * The handle is itself the 44px target. An earlier build used an absolutely
 * positioned transparent hit area across the sheet top, which sat over the tab
 * row and swallowed every tap meant for it — a defect no size check can see.
 */
'use client';

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSheetDetent, type Detent } from '@/lib/hooks/useSheetDetent';

export interface Chokepoint {
  name: string;
  tankers: number;
  total: number;
}

export interface MobileSheetProps {
  chokepoints: Chokepoint[];
  /** Forced back to peek by the parent — e.g. a vessel was selected. */
  collapsed: boolean;
  panels: { prices: ReactNode; intel: ReactNode };
}

type TabId = 'choke' | 'prices' | 'intel';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'choke', label: 'Chokepoints' },
  { id: 'prices', label: 'Prices' },
  { id: 'intel', label: 'Intel' },
];

const HEIGHT: Record<Detent, string> = {
  peek: 'h-[88px]',
  half: 'h-[46dvh]',
  full: 'h-[72dvh]',
};

export function MobileSheet({ chokepoints, collapsed, panels }: MobileSheetProps) {
  const { detent, cycle, collapse, isOpen } = useSheetDetent();
  const [active, setActive] = useState<TabId>('choke');
  const baseId = useId();

  // The vessel sheet and this sheet share the same bottom edge; two stacked
  // sheets is the defect this layout exists to remove.
  useEffect(() => {
    if (collapsed) collapse();
  }, [collapsed, collapse]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const current = TABS.findIndex((t) => t.id === active);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;

    event.preventDefault();
    const nextId = TABS[next].id;
    setActive(nextId);
    // Roving tabindex drops the old button to -1, so focus must follow or the
    // screen-reader cursor is stranded on a tab that is no longer selected.
    document.getElementById(`${baseId}-tab-${nextId}`)?.focus();
  }

  return (
    <div
      data-testid="mobile-sheet"
      data-detent={detent}
      className={`lg:hidden fixed inset-x-0 bottom-[var(--straits-nav-h)] z-30 flex flex-col bg-black border-t border-amber-500 shadow-[0_-8px_24px_rgba(0,0,0,0.85)] transition-[height] duration-200 ${HEIGHT[detent]}`}
    >
      <button
        type="button"
        onClick={cycle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
        className="h-11 shrink-0 w-full flex items-center justify-center"
      >
        <span className="w-9 h-[3px] bg-amber-500/50" />
      </button>

      {!isOpen && (
        // A per-chokepoint list here needed ~668px in a 390px viewport, so it
        // could only be a horizontal scroll strip — and this project has already
        // shipped one of those that hid 404px with no cue it existed. An
        // aggregate always fits at every width, hides nothing, and is a better
        // glance anyway; the per-chokepoint breakdown is one tap away in the
        // Chokepoints tab.
        <div
          data-testid="sheet-peek-strip"
          className="h-11 shrink-0 flex items-baseline gap-2 px-4"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-amber-500">Chokepoints</span>
          <span className="text-sm font-mono text-white">
            {chokepoints.reduce((sum, c) => sum + c.tankers, 0)}
          </span>
          <span className="text-xs font-mono text-gray-500">
            tankers / {chokepoints.reduce((sum, c) => sum + c.total, 0)} vessels
          </span>
          <span className="ml-auto text-xs font-mono text-gray-500">{chokepoints.length} zones</span>
        </div>
      )}

      {isOpen && (
        <>
          <div
            role="tablist"
            aria-label="Dashboard panels"
            onKeyDown={handleKeyDown}
            className="grid grid-cols-3 shrink-0 border-t border-amber-500/20"
          >
            {TABS.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  id={`${baseId}-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={selected ? `${baseId}-panel-${tab.id}` : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  className={`min-h-[44px] text-xs font-mono uppercase tracking-wider transition-colors ${
                    selected
                      ? 'text-amber-500 bg-amber-500/10 shadow-[inset_0_-2px_0_var(--color-amber-500)]'
                      : 'text-gray-500'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active}`}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            {active === 'choke' && (
              <div>
                {chokepoints.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between min-h-[44px] px-4 border-b border-amber-500/10"
                  >
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-500">{c.name}</span>
                    <span className="text-xs font-mono text-gray-500">
                      <span className="text-sm text-gray-200">{c.tankers}</span> / {c.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {active === 'prices' && panels.prices}
            {active === 'intel' && panels.intel}
          </div>
        </>
      )}
    </div>
  );
}

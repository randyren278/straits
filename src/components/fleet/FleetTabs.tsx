/**
 * FleetTabs — category navigation for the Fleet page.
 *
 * One tablist, three layouts: a 2-column grid on phones, where eight tabs laid
 * end to end (~760px) cannot fit a 390px screen; a 4-column grid at tablet,
 * which divides eight tabs into two clean rows rather than the 7+1 orphan that
 * flex-wrap produces at 1180; and the horizontal strip at desk widths.
 * Rendering a single DOM tree with responsive classes keeps exactly one
 * aria-selected node in the document.
 *
 * Holds no domain data — given labels and counts it renders a strip and
 * reports clicks.
 */
'use client';

import type { KeyboardEvent } from 'react';

export interface FleetTab {
  id: string;
  label: string;
  count: number;
  accent?: 'amber' | 'red';
}

interface FleetTabsProps {
  tabs: FleetTab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FleetTabs({ tabs, activeId, onChange }: FleetTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const current = tabs.findIndex((t) => t.id === activeId);
    if (current === -1) return;

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;

    if (next === null) return;
    event.preventDefault();

    const nextId = tabs[next].id;
    onChange(nextId);

    // Focus must follow selection. Roving tabindex drops the previously focused
    // button to tabIndex -1, so without this the focus ring and screen-reader
    // cursor stay on a tab that is no longer selected, and the next Tab press
    // leaves from the wrong place.
    document.getElementById(`fleet-tab-${nextId}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Fleet categories"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 roomy:grid-cols-4 desk:flex desk:flex-wrap border border-amber-500/20 bg-gray-900/40"
      data-testid="fleet-tabs"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const red = tab.accent === 'red';

        const base =
          'flex items-center justify-between gap-2 min-h-[44px] desk:min-h-0 px-3 py-2 ' +
          'text-xs font-mono uppercase tracking-wider border-r border-b desk:border-b-0 ' +
          'border-amber-500/10 transition-colors text-left';

        const state = active
          ? red
            ? 'text-red-400 bg-red-500/10 shadow-[inset_0_-2px_0_0_rgb(248,113,113)]'
            : 'text-amber-500 bg-amber-500/10 shadow-[inset_0_-2px_0_0_rgb(245,158,11)]'
          : red
            ? 'text-red-400/70 hover:bg-red-500/5'
            : 'text-gray-500 hover:bg-amber-500/5';

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`fleet-tab-${tab.id}`}
            // Only the active panel is mounted, so pointing at an inactive
            // tab's panel id would be a dangling IDREF.
            aria-controls={active ? `fleet-panel-${tab.id}` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`${base} ${state}`}
          >
            <span>{tab.label}</span>
            <span className={active ? '' : 'text-gray-400'}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}

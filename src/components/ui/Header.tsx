/**
 * Dashboard header component.
 * Shows title, navigation tabs, search input, data freshness, filters, notification bell, and chokepoint widgets.
 * Requirements: MAP-06, MAP-07, ANOM-02, HIST-01
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DataFreshness } from './DataFreshness';
import { TankerFilter } from './TankerFilter';
import { SearchInput } from './SearchInput';
import { ChokepointWidgets } from './ChokepointWidget';
import { NotificationBell } from './NotificationBell';
import { AnomalyFilter } from './AnomalyFilter';
import { StatusChip } from './StatusChip';
import { StraitsMark } from './StraitsMark';

interface SearchResult {
  imo: string;
  mmsi: string;
  name: string;
  flag: string;
  latitude: number | null;
  longitude: number | null;
}

interface ChokepointBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface HeaderProps {
  onSearchSelect?: (result: SearchResult) => void;
  onChokepointSelect?: (bounds: ChokepointBounds, name: string) => void;
}

export function Header({ onSearchSelect, onChokepointSelect }: HeaderProps) {
  const pathname = usePathname();
  const activeTab = pathname === '/fleet' ? 'fleet' : pathname === '/analytics' ? 'analytics' : pathname === '/about' ? 'about' : 'dashboard';
  const [chokepointsOpen, setChokepointsOpen] = useState(false);

  return (
    <header className="bg-black border-b border-amber-500/20">
      {/* Desktop: single row. Mobile: title + nav row, controls below */}
      {/* Desktop: this row's content is ~1372px intrinsic, so every viewport
          between the lg breakpoint and that width used to pan horizontally —
          the bell sat fully off screen at 1024. It wraps onto a second line
          instead; at 1440 it still fits one line, so that layout is unchanged. */}
      <div className="min-h-14 flex items-center justify-between px-4 lg:flex-wrap max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-0">
        {/* Top row: logo + nav (always visible) */}
        <div className="flex items-center max-lg:justify-between max-lg:min-h-12 max-lg:w-full">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 max-lg:min-h-[44px]">
            <StraitsMark size={20} className="shrink-0" />
            {/* Wordmark hidden on narrow phones so all 4 nav tabs fit without clipping */}
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500 max-sm:hidden">Straits</h1>
          </Link>
          {/* A horizontal scroll strip here hid 35px of the About tab at 320px
              with no cue it existed. Tabs are tightened at max-sm so all four
              fit; flex-wrap is the visible fallback rather than a silent clip. */}
          <nav className="flex gap-1 ml-6 max-lg:ml-2 max-lg:min-w-0 max-lg:flex-wrap max-sm:gap-0.5">
            <Link
              href="/dashboard"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-1 ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Live Map
            </Link>
            <Link
              href="/analytics"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-1 ${
                activeTab === 'analytics'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Analytics
            </Link>
            <Link
              href="/fleet"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-1 ${
                activeTab === 'fleet'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Fleet
            </Link>
            <Link
              href="/about"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-1 ${
                activeTab === 'about'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              About
            </Link>
          </nav>
        </div>
        {/* Controls: search on its own line (mobile); rest below it */}
        <div className="flex items-center gap-4 max-lg:flex-col max-lg:items-stretch max-lg:gap-2 max-lg:px-0 max-lg:py-2 max-lg:border-t max-lg:border-amber-500/10">
          {activeTab === 'dashboard' && (
            <SearchInput onSelectVessel={onSearchSelect} />
          )}
          {/* Mobile: these wrap onto as many rows as they need. They used to sit in a
              horizontal scroll strip, which hid ~310px of controls off the right edge
              of a 390px phone with no visible cue that anything was there. */}
          <div className="flex items-center gap-4 max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-2 max-lg:w-full [&>*]:shrink-0">
            {activeTab === 'dashboard' && (
              <>
                <DataFreshness />
                <TankerFilter />
                <AnomalyFilter />
              </>
            )}
            <NotificationBell />
            <StatusChip />
          </div>
        </div>
      </div>
      {activeTab === 'dashboard' && (
        /* Mobile: toggle sits above the widgets, not inline to their left where it
           stole 108px of an already-tight row. */
        <div className="flex items-start px-4 py-2 border-t border-amber-500/10 max-lg:flex-col max-lg:gap-1">
          {/* Mobile: collapsed behind a toggle to reclaim the fold. Desktop: always shown. */}
          <button
            onClick={() => setChokepointsOpen((v) => !v)}
            aria-expanded={chokepointsOpen}
            className="hidden max-lg:inline-flex items-center gap-1 min-h-[44px] text-xs font-mono uppercase tracking-widest text-amber-500"
          >
            Chokepoints {chokepointsOpen ? '▾' : '▸'}
          </button>
          <div className={`${chokepointsOpen ? 'max-lg:block' : 'max-lg:hidden'} lg:block w-full`}>
            <ChokepointWidgets onSelect={onChokepointSelect} />
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Dashboard header component.
 * Shows title, navigation tabs, search input, data freshness, filters, notification bell, and chokepoint widgets.
 * Requirements: MAP-06, MAP-07, ANOM-02, HIST-01
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DataFreshness } from './DataFreshness';
import { TankerFilter } from './TankerFilter';
import { SearchInput } from './SearchInput';
import { ChokepointWidgets } from './ChokepointWidget';
import { NotificationBell } from './NotificationBell';
import { AnomalyFilter } from './AnomalyFilter';
import { StatusBar } from './StatusBar';
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

  return (
    <header className="bg-black border-b border-amber-500/20">
      {/* Desktop: single row. Mobile: title + nav row, controls below */}
      <div className="h-14 flex items-center justify-between px-4 max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-0">
        {/* Top row: logo + nav (always visible) */}
        <div className="flex items-center max-lg:justify-between max-lg:h-12 max-lg:w-full">
          <Link href="/dashboard" className="flex items-center gap-2">
            <StraitsMark size={20} className="shrink-0" />
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">Straits</h1>
          </Link>
          <nav className="flex gap-1 ml-6 max-lg:ml-2">
            <Link
              href="/dashboard"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-2 ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Live Map
            </Link>
            <Link
              href="/analytics"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-2 ${
                activeTab === 'analytics'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Analytics
            </Link>
            <Link
              href="/fleet"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-2 ${
                activeTab === 'fleet'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Fleet
            </Link>
            <Link
              href="/about"
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-2 ${
                activeTab === 'about'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              About
            </Link>
          </nav>
        </div>
        {/* Controls row: map tooling only on dashboard; telemetry (bell + status) everywhere */}
        <div className="flex items-center gap-4 max-lg:gap-2 max-lg:flex-wrap max-lg:px-0 max-lg:py-2 max-lg:border-t max-lg:border-amber-500/10">
          {activeTab === 'dashboard' && (
            <>
              <SearchInput onSelectVessel={onSearchSelect} />
              <DataFreshness />
              <TankerFilter />
              <AnomalyFilter />
            </>
          )}
          <NotificationBell />
          <StatusBar />
        </div>
      </div>
      {activeTab === 'dashboard' && (
        <div className="flex items-start px-4 py-2 border-t border-amber-500/10 max-md:overflow-x-auto">
          <ChokepointWidgets onSelect={onChokepointSelect} />
        </div>
      )}
    </header>
  );
}

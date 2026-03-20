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
  const activeTab = pathname === '/analytics' ? 'analytics' : pathname === '/about' ? 'about' : 'dashboard';

  return (
    <header className="bg-black border-b border-amber-500/20">
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center">
          <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">Tanker Tracker</h1>
          <nav className="flex gap-1 ml-6">
            <Link
              href="/dashboard"
              className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Live Map
            </Link>
            <Link
              href="/analytics"
              className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
                activeTab === 'analytics'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              Analytics
            </Link>
            <Link
              href="/about"
              className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
                activeTab === 'about'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              About
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <SearchInput onSelectVessel={onSearchSelect} />
          <DataFreshness />
          <TankerFilter />
          <AnomalyFilter />
          <NotificationBell />
          <StatusBar />
        </div>
      </div>
      {activeTab === 'dashboard' && (
        <div className="flex items-start px-4 py-2 border-t border-amber-500/10">
          <ChokepointWidgets onSelect={onChokepointSelect} />
        </div>
      )}
    </header>
  );
}

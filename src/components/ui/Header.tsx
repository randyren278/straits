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
  const isAnalytics = pathname === '/analytics';

  return (
    <header className="bg-[#16162a] border-b border-gray-800">
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center">
          <h1 className="text-lg font-bold text-white">Tanker Tracker</h1>
          <nav className="flex gap-1 ml-6">
            <Link
              href="/dashboard"
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                !isAnalytics ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Live Map
            </Link>
            <Link
              href="/analytics"
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isAnalytics ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Analytics
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <SearchInput onSelectVessel={onSearchSelect} />
          <DataFreshness />
          <TankerFilter />
          <AnomalyFilter />
          <NotificationBell />
        </div>
      </div>
      {!isAnalytics && (
        <div className="h-10 flex items-center px-4 border-t border-gray-800/50">
          <ChokepointWidgets onSelect={onChokepointSelect} />
        </div>
      )}
    </header>
  );
}

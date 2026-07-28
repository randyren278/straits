/**
 * Dashboard header component.
 * Shows title, navigation tabs, search input, data freshness, filters, notification bell, and chokepoint widgets.
 * Requirements: MAP-06, MAP-07, ANOM-02, HIST-01
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
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

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Live Map', id: 'dashboard' },
  { href: '/analytics', label: 'Analytics', id: 'analytics' },
  { href: '/fleet', label: 'Fleet', id: 'fleet' },
  { href: '/about', label: 'About', id: 'about' },
] as const;

export function Header({ onSearchSelect, onChokepointSelect }: HeaderProps) {
  const pathname = usePathname();
  const activeTab = pathname === '/fleet' ? 'fleet' : pathname === '/analytics' ? 'analytics' : pathname === '/about' ? 'about' : 'dashboard';
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="bg-black border-b border-amber-500/20">
      <div className="min-h-14 max-lg:min-h-11 flex items-center justify-between px-4 lg:flex-wrap max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-0">
        <div className="flex items-center max-lg:justify-between max-lg:min-h-11 max-lg:w-full">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 max-lg:min-w-[44px] max-lg:min-h-[44px]"
          >
            <StraitsMark size={20} className="shrink-0" />
            {/* Wordmark hidden on narrow phones so all 4 nav tabs fit without clipping */}
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500 max-sm:hidden">Straits</h1>
          </Link>

          {/* Below lg this is replaced by MobileBottomNav, which puts the same
              destinations in the thumb zone instead of the top 33%. */}
          <nav className="max-lg:hidden flex gap-1 ml-6">
            {NAV_ITEMS.map(({ href, label, id }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center whitespace-nowrap px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
                  activeTab === id
                    ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                    : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile-only cluster: status, search toggle, alerts, all in the
              single 44px row. StatusChip and NotificationBell each own a
              background poller (/api/status, /api/alerts), so this is a
              second mount of both alongside the desktop copies below —
              usePolledJson (inside each component) shares the interval and
              in-flight request across every mounted copy of the same URL, so
              two mounts never mean two pollers. */}
          <div data-testid="header-mobile-controls" className="lg:hidden flex items-center gap-3">
            {activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-expanded={searchOpen}
                aria-label="Search vessels"
                className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400"
              >
                <Search className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            )}
            <NotificationBell />
            <StatusChip />
          </div>
        </div>

        {/* Desktop control row. Below lg the filters live on the map and the
            search input moves behind the toggle above, so the whole row is dropped. */}
        <div
          data-testid="header-controls"
          className="max-lg:hidden flex items-center gap-4"
        >
          {activeTab === 'dashboard' && (
            <SearchInput onSelectVessel={onSearchSelect} />
          )}
          <div className="flex items-center gap-4">
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

      {searchOpen && activeTab === 'dashboard' && (
        <div data-testid="mobile-search" className="lg:hidden px-4 py-2 border-t border-amber-500/10">
          <SearchInput onSelectVessel={onSearchSelect} />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div
          data-testid="header-chokepoints"
          className="max-lg:hidden flex items-start px-4 py-2 border-t border-amber-500/10"
        >
          <div className="w-full">
            <ChokepointWidgets onSelect={onChokepointSelect} />
          </div>
        </div>
      )}
    </header>
  );
}

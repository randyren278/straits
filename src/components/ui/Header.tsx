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
import { AisOutageBanner } from './AisOutageBanner';

interface SearchResult {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
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
      <div className="min-h-14 phone:min-h-11 flex items-center justify-between px-4 roomy:flex-wrap phone:h-auto phone:flex-col phone:items-stretch phone:gap-0">
        <div className="flex items-center phone:justify-between phone:min-h-11 phone:w-full">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 phone:min-w-[44px] phone:min-h-[44px] tablet:min-w-[44px] tablet:min-h-[44px]"
          >
            <StraitsMark size={20} className="shrink-0" />
            {/* Wordmark hidden on narrow phones so all 4 nav tabs fit without clipping */}
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500 max-sm:hidden">Straits</h1>
          </Link>

          {/* Below 768 this is replaced by MobileBottomNav, which puts the same
              destinations in the thumb zone instead of the top 33%. Tablets keep
              this row — rotation must not change the navigation model. */}
          <nav className="phone:hidden flex gap-1 ml-6">
            {NAV_ITEMS.map(({ href, label, id }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center whitespace-nowrap px-3 py-1 tablet:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
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
          <div data-testid="header-mobile-controls" className="roomy:hidden flex items-center gap-3">
            {activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-expanded={searchOpen}
                aria-label="Search vessels"
                className="roomy:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400"
              >
                <Search className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            )}
            <NotificationBell />
            <StatusChip />
          </div>
        </div>

        {/* Control row from 768 up. On phones the filters live on the map and
            the search input moves behind the toggle above, so the row is dropped.
            Between 768 and 1279 the row carries search, alerts and status only:
            at 820px the full desktop set measured ~932px against an 820px
            viewport. DataFreshness duplicates StatusChip, and the filters have a
            map-anchored copy in MapFilterChips, so both are cut first. */}
        <div
          data-testid="header-controls"
          className="phone:hidden flex items-center gap-4"
        >
          {activeTab === 'dashboard' && (
            <SearchInput onSelectVessel={onSearchSelect} />
          )}
          <div className="flex items-center gap-4">
            {activeTab === 'dashboard' && (
              <div className="hidden desk:flex items-center gap-4">
                <DataFreshness />
                <TankerFilter />
                <AnomalyFilter />
              </div>
            )}
            <NotificationBell />
            <StatusChip />
          </div>
        </div>
      </div>

      {searchOpen && activeTab === 'dashboard' && (
        <div data-testid="mobile-search" className="roomy:hidden px-4 py-2 border-t border-amber-500/10">
          <SearchInput onSelectVessel={onSearchSelect} />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div
          data-testid="header-chokepoints"
          className="phone:hidden flex items-start px-4 py-2 border-t border-amber-500/10"
        >
          <div className="w-full">
            <ChokepointWidgets onSelect={onChokepointSelect} />
          </div>
        </div>
      )}

      {/* Not gated on activeTab: a dark AIS feed empties the fleet table and
          analytics charts too, so the explanation belongs on every route. */}
      <AisOutageBanner />
    </header>
  );
}

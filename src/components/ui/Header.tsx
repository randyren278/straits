/**
 * Dashboard header component.
 * Shows title, search input, data freshness, filters, notification bell, and chokepoint widgets.
 * Requirements: MAP-06, MAP-07, ANOM-02
 */
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
  return (
    <header className="bg-[#16162a] border-b border-gray-800">
      <div className="h-14 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold text-white">Tanker Tracker</h1>
        <div className="flex items-center gap-4">
          <SearchInput onSelectVessel={onSearchSelect} />
          <DataFreshness />
          <TankerFilter />
          <AnomalyFilter />
          <NotificationBell />
        </div>
      </div>
      <div className="h-10 flex items-center px-4 border-t border-gray-800/50">
        <ChokepointWidgets onSelect={onChokepointSelect} />
      </div>
    </header>
  );
}

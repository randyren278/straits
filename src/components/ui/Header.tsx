/**
 * Dashboard header component.
 * Shows title, data freshness, and filter controls.
 */
import { DataFreshness } from './DataFreshness';
import { TankerFilter } from './TankerFilter';

export function Header() {
  return (
    <header className="h-14 bg-[#16162a] border-b border-gray-800 flex items-center justify-between px-4">
      <h1 className="text-lg font-bold text-white">Tanker Tracker</h1>
      <div className="flex items-center gap-4">
        <DataFreshness />
        <TankerFilter />
      </div>
    </header>
  );
}

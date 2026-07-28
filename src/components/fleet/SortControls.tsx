/**
 * Sort controls for the Fleet page tables.
 *
 * Two surfaces, one state: clickable column headers on desktop, and a
 * <select> on mobile — the Sanctioned tab renders a card list on phones
 * with no headers to click.
 */
'use client';

import { useId } from 'react';

import type { SortColumn, SortDir } from '@/lib/hooks/useTableView';

interface SortableHeaderProps {
  column: SortColumn<never>;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  accent?: 'amber' | 'red';
  className?: string;
}

export function SortableHeader({
  column,
  activeKey,
  dir,
  onSort,
  accent = 'amber',
  className = '',
}: SortableHeaderProps) {
  const active = column.key === activeKey;
  const accentText = accent === 'red' ? 'text-red-400/70' : 'text-amber-500';
  const indicator = active ? (dir === 'asc' ? '▲' : '▼') : '↕';

  return (
    <th
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-2 text-xs font-mono uppercase tracking-widest ${accentText} font-normal ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="inline-flex items-center gap-1.5 uppercase tracking-widest hover:opacity-80 transition-opacity"
      >
        {column.label}
        <span className={active ? '' : 'opacity-40'} aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}

interface MobileSortBarProps {
  columns: SortColumn<never>[];
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  accent?: 'amber' | 'red';
}

export function MobileSortBar({ columns, activeKey, dir, onSort, accent = 'amber' }: MobileSortBarProps) {
  const selectId = useId();
  const accentText = accent === 'red' ? 'text-red-400' : 'text-amber-500';
  const accentBorder = accent === 'red' ? 'border-red-500/30' : 'border-amber-500/30';

  function handleChange(value: string): void {
    const [key, wanted] = value.split(':') as [string, SortDir];
    const column = columns.find((c) => c.key === key);
    if (!column) return;

    // toggleSort on a new column applies that column's default direction;
    // on the active column it flips. Derive how many calls that needs.
    if (key !== activeKey) {
      onSort(key);
      if (wanted !== column.defaultDir) onSort(key);
      return;
    }
    if (wanted !== dir) onSort(key);
  }

  return (
    <div className={`lg:hidden flex items-center justify-end gap-2 border-b ${accentBorder} bg-gray-900/30 px-3 py-2`}>
      <label htmlFor={selectId} className="text-xs font-mono uppercase tracking-wider text-gray-500">
        Sort
      </label>
      <select
        id={selectId}
        value={`${activeKey}:${dir}`}
        onChange={(e) => handleChange(e.target.value)}
        className={`min-h-[44px] bg-black border ${accentBorder} ${accentText} px-2 py-1 text-xs font-mono uppercase tracking-wider`}
      >
        {columns.flatMap((column) => {
          const first = column.defaultDir;
          const second: SortDir = first === 'asc' ? 'desc' : 'asc';
          return [first, second].map((d) => (
            <option key={`${column.key}:${d}`} value={`${column.key}:${d}`}>
              {column.label} {d === 'asc' ? '▲' : '▼'}
            </option>
          ));
        })}
      </select>
    </div>
  );
}

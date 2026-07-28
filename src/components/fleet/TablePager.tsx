/**
 * TablePager — prev/next paging control for the Fleet page tables.
 * Renders nothing when the rows fit on a single page.
 */
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePagerProps {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
  accent?: 'amber' | 'red';
}

export function TablePager({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
  accent = 'amber',
}: TablePagerProps) {
  if (pageCount <= 1) return null;

  const accentText = accent === 'red' ? 'text-red-400' : 'text-amber-500';
  const accentBorder = accent === 'red' ? 'border-red-500/20' : 'border-amber-500/20';
  const button =
    `inline-flex items-center gap-1 min-h-[44px] lg:min-h-0 px-3 py-1.5 text-xs font-mono ` +
    `uppercase tracking-wider border transition-colors disabled:opacity-30 ` +
    `disabled:cursor-not-allowed ${accentText} ${accentBorder} hover:enabled:bg-white/5`;

  return (
    <div className={`flex items-center justify-center gap-4 border-t ${accentBorder} bg-gray-900/30 px-4 py-2`}>
      <button
        type="button"
        className={button}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Prev
      </button>

      <span className="text-xs font-mono uppercase tracking-wider text-gray-500" aria-live="polite">
        Showing {rangeStart}–{rangeEnd} of {total}
      </span>

      <button
        type="button"
        className={button}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

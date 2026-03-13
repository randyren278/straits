/**
 * TimeRangeSelector Component (HIST-01)
 *
 * Button group for selecting analytics time range.
 */
'use client';

import type { TimeRange } from '@/types/analytics';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1 bg-black border border-gray-800 p-1">
      {TIME_RANGES.map(({ value: rangeValue, label }) => (
        <button
          key={rangeValue}
          onClick={() => onChange(rangeValue)}
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
            value === rangeValue
              ? 'bg-amber-500 text-black border-amber-500'
              : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

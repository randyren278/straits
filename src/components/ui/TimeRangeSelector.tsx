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
    <div className="flex gap-1 bg-[#1a1a2e] rounded-lg p-1">
      {TIME_RANGES.map(({ value: rangeValue, label }) => (
        <button
          key={rangeValue}
          onClick={() => onChange(rangeValue)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            value === rangeValue
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

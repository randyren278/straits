/**
 * ChokepointSelector Component (HIST-01)
 *
 * Button toggles for selecting which chokepoints to display.
 */
'use client';

import { CHOKEPOINTS } from '@/lib/geo/chokepoints';

interface ChokepointSelectorProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ChokepointSelector({ selected, onChange }: ChokepointSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Don't allow deselecting the last one
      if (selected.length > 1) {
        onChange(selected.filter(s => s !== id));
      }
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {Object.values(CHOKEPOINTS).map((cp) => (
        <button
          key={cp.id}
          onClick={() => toggle(cp.id)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            selected.includes(cp.id)
              ? 'bg-amber-600 text-white'
              : 'bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {cp.name}
        </button>
      ))}
    </div>
  );
}

/**
 * ChokepointSelector Component (HIST-01)
 *
 * Button toggles for selecting which chokepoints to display.
 */
'use client';

import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';

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
    <div className="flex gap-2 flex-wrap max-md:grid max-md:grid-cols-2" role="group" aria-label="Chokepoint selection">
      {Object.values(CHOKEPOINTS).map((cp) => (
        <button
          key={cp.id}
          onClick={() => toggle(cp.id)}
          aria-pressed={selected.includes(cp.id)}
          className={`inline-flex items-center justify-center px-3 py-1.5 max-md:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
            selected.includes(cp.id)
              ? 'bg-amber-500 text-black border-amber-500'
              : 'bg-black border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
          }`}
        >
          {cp.name}
        </button>
      ))}
    </div>
  );
}

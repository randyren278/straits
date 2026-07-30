/**
 * Map layer filters, anchored to the map they control.
 *
 * These lived in the header, stacked above the map and costing ~10,200px² of
 * a 390px screen. They are map controls; they belong on the map surface, the
 * way every mobile map app places them.
 *
 * Phone and tablet only — the desk header keeps its own copy. Both instances
 * are in the DOM but `desk:hidden` / `hidden desk:flex` compute to
 * display:none, so exactly one is ever in the accessibility tree.
 */
'use client';

import { TankerFilter } from '@/components/ui/TankerFilter';
import { AnomalyFilter } from '@/components/ui/AnomalyFilter';

export function MapFilterChips() {
  return (
    <div
      data-testid="map-filter-chips"
      className="desk:hidden absolute top-3 left-3 z-10 flex gap-2"
    >
      <TankerFilter />
      <AnomalyFilter />
    </div>
  );
}

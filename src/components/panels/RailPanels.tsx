/**
 * The dashboard's intel panel stack.
 *
 * Rendered in two places that must never drift apart: the pinned rail at desk
 * widths, and IntelDrawer at tablet widths. Extracted so adding a panel means
 * one edit, not two.
 *
 * Holds no state. VesselPanel is conditional on the store's selection, which is
 * why this reads the store directly rather than taking it as a prop — both
 * consumers would otherwise have to duplicate the subscription.
 */
'use client';

import { ClusterPanel } from './ClusterPanel';
import { VesselPanel } from './VesselPanel';
import { WatchlistPanel } from './WatchlistPanel';
import { OilPricePanel } from './OilPricePanel';
import { NewsPanel } from './NewsPanel';
import { useVesselStore } from '@/stores/vessel';

export function RailPanels() {
  const selectedVessel = useVesselStore((state) => state.selectedVessel);

  return (
    <>
      <ClusterPanel />
      {selectedVessel && <VesselPanel />}
      <WatchlistPanel />
      <OilPricePanel />
      <NewsPanel />
    </>
  );
}

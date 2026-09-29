/**
 * Dashboard page entry — server component.
 * The dashboard shell must not wait for vessel-count queries. Live counts
 * arrive independently after the map starts loading.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, INTL-02, INTL-03, ANOM-01, HIST-02
 */
import { DashboardClient } from './DashboardClient';

export default function DashboardPage() {
  return <>
    <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="anonymous" />
    <link rel="preconnect" href="https://tiles.basemaps.cartocdn.com" crossOrigin="anonymous" />
    <DashboardClient />
  </>;
}

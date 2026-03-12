/**
 * Dashboard page with interactive vessel map.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-08
 */
import { VesselMap } from '@/components/map/VesselMap';
import { VesselPanel } from '@/components/panels/VesselPanel';
import { Header } from '@/components/ui/Header';

export default function DashboardPage() {
  return (
    <div className="h-screen flex flex-col bg-[#1a1a2e]">
      <Header />
      <main className="flex-1 relative">
        <VesselMap />
        <VesselPanel />
      </main>
    </div>
  );
}

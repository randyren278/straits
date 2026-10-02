import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { ParallelSeasWorkbench } from '@/components/scenarios/ParallelSeasWorkbench';
import { DEFAULT_SCENARIO, parseScenarioValue } from '@/lib/scenarios/parallel-seas';
import { isCanaryEnabled } from '@/lib/canary';

type ScenarioSearchParams = Promise<{
  speed?: string | string[];
  delay?: string | string[];
}>;

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: ScenarioSearchParams;
}) {
  if (!isCanaryEnabled()) notFound();
  const params = await searchParams;
  const initialSpeedKnots = parseScenarioValue(params.speed, DEFAULT_SCENARIO.speedKnots, 1, 30);
  const initialClosureDelayDays = parseScenarioValue(params.delay, DEFAULT_SCENARIO.closureDelayDays, 0, 90);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-7xl space-y-5 px-6 py-7 phone:px-3 phone:py-4 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
        <header className="border-b border-amber-500/20 pb-4">
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500">Passage planning · scenario model</p>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h1 className="text-2xl font-mono uppercase tracking-wider text-gray-100">Parallel Seas</h1>
              <p className="mt-1 text-xs text-gray-500">Mumbai to Rotterdam · wait for Suez or divert around the Cape</p>
            </div>
            <span className="border border-gray-700 px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-gray-500">Assumption model · not a forecast</span>
          </div>
        </header>

        <ParallelSeasWorkbench
          initialSpeedKnots={initialSpeedKnots}
          initialClosureDelayDays={initialClosureDelayDays}
        />
      </main>
    </div>
  );
}

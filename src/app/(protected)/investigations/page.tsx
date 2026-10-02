import { notFound } from 'next/navigation';
import { Header } from '@/components/ui/Header';
import { isCanaryEnabled } from '@/lib/canary';

export default function InvestigationsPage() {
  if (!isCanaryEnabled()) notFound();

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8 phone:px-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
        <div className="mb-8 border-b border-amber-500/20 pb-5">
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500">Analyst workspace</p>
          <h1 className="text-2xl font-mono uppercase tracking-wider text-gray-100">Investigations</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Follow vessel activity over time and keep the observations behind each assessment together.
          </p>
        </div>

        <section aria-label="Investigation workspace" className="border border-gray-800 bg-gray-950/60">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <h2 className="text-xs font-mono uppercase tracking-widest text-gray-300">Recent investigations</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-600">Workspace ready</span>
          </div>
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-300">Your investigation files will appear here.</p>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-gray-600">
              Start with a vessel or chokepoint from the live map. This workspace is being prepared for linked observations and analyst notes.
            </p>
          </div>
        </section>

        <p className="mt-4 text-[10px] font-mono uppercase tracking-wider text-gray-700">
          Live vessel observations remain available on the map.
        </p>
      </main>
    </div>
  );
}

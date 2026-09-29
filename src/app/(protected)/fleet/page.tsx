/**
 * Fleet Overview Page (M006-S01)
 *
 * Tabbed view of active anomalies: one tab per anomaly type plus a
 * sanctioned-vessels tab. One panel is mounted at a time and server-paged
 * in 15-row slices, keeping the page near a single screen on phones.
 * Terminal aesthetic: bg-black, amber accents, font-mono, no border-radius.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/ui/Header';
import { FleetTablePanel } from '@/components/fleet/FleetTablePanel';
import { FleetTabs, type FleetTab } from '@/components/fleet/FleetTabs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ANOMALY_TYPE_LABELS, type Anomaly, type AnomalyType } from '@/types/anomaly';

const SANCTIONED_TAB_ID = 'sanctioned';

interface FleetCount { anomalyType: string; count: number }

export default function FleetPage() {
  const [counts, setCounts] = useState<FleetCount[]>([]);
  const [initialPage, setInitialPage] = useState<{ tab: string; rows: Anomaly[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSummary() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/anomalies?view=fleet-summary', { signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}: Failed to fetch anomalies`);
        }
        const data: { counts: FleetCount[]; initialTab: string | null; initialAnomalies: Anomaly[] } = await res.json();
        if (!controller.signal.aborted) {
          setCounts(data.counts || []);
          setInitialPage(data.initialTab ? { tab: data.initialTab, rows: data.initialAnomalies || [] } : null);
        }
      } catch (err) {
        console.error('Fleet page fetch error:', err);
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load fleet data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchSummary();
    return () => controller.abort();
  }, []);

  const tabs = useMemo<FleetTab[]>(() => {
    const sanctioned = counts.find((row) => row.anomalyType === SANCTIONED_TAB_ID);
    const byType = counts
      .filter((row) => row.anomalyType !== SANCTIONED_TAB_ID)
      .sort((a, b) => b.count - a.count)
      .map((row) => ({
        id: row.anomalyType,
        label: ANOMALY_TYPE_LABELS[row.anomalyType as AnomalyType] ?? row.anomalyType.replaceAll('_', ' '),
        count: row.count,
      }));
    return sanctioned
      ? [{ id: SANCTIONED_TAB_ID, label: 'Sanctioned', count: sanctioned.count, accent: 'red' as const }, ...byType]
      : byType;
  }, [counts]);
  const activeCount = counts.reduce((sum, row) => sum + (row.anomalyType === SANCTIONED_TAB_ID ? 0 : row.count), 0);
  const categoryCount = tabs.length - (tabs[0]?.id === SANCTIONED_TAB_ID ? 1 : 0);

  // Derived, not stored: falls back to the first tab (Sanctioned when present,
  // otherwise the largest category) both on first load and whenever a refetch
  // removes the tab that was selected.
  const activeTab = selectedTab && tabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : tabs[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto phone:p-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
        {/* Page title */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">FLEET OVERVIEW</h1>
            {!loading && !error && (
              <p className="text-xs text-gray-600 mt-0.5 font-mono">
                {activeCount} active anomalies across {categoryCount} categories
              </p>
            )}
          </div>
          {/* Export current fleet snapshot for offline analysis */}
          <div className="flex gap-2 shrink-0">
            <a
              href="/api/export?format=csv"
              className="inline-flex items-center phone:min-h-[44px] tablet:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              Export CSV
            </a>
            <a
              href="/api/export?format=json"
              className="inline-flex items-center phone:min-h-[44px] tablet:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-gray-600/50 text-gray-400 hover:bg-gray-800/50 transition-colors"
            >
              JSON
            </a>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <p className="text-amber-500 font-mono text-sm uppercase tracking-widest animate-pulse">
              LOADING FLEET DATA...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 border border-red-500/50 bg-red-900/10">
            <p className="text-red-400 font-mono text-sm">ERROR: {error}</p>
            <p className="text-gray-500 font-mono text-xs mt-2">
              Check network connection and try refreshing the page.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && activeCount === 0 && (
          <div className="flex items-center justify-center h-64 border border-amber-500/10 bg-gray-900/30">
            <p className="text-gray-500 font-mono text-sm uppercase tracking-widest">
              NO ACTIVE ANOMALIES DETECTED
            </p>
          </div>
        )}

        {/* Tabbed panels */}
        {!loading && !error && activeCount > 0 && activeTab && (
          <ErrorBoundary>
            <FleetTabs tabs={tabs} activeId={activeTab} onChange={setSelectedTab} />

            <div
              role="tabpanel"
              id={`fleet-panel-${activeTab}`}
              aria-labelledby={`fleet-tab-${activeTab}`}
              className="mt-4"
            >
              {/* A new tab remounts page, sort and dossier state. */}
              <FleetTablePanel
                key={activeTab}
                tab={activeTab}
                total={tabs.find((tab) => tab.id === activeTab)?.count ?? 0}
                initialRows={initialPage?.tab === activeTab ? initialPage.rows : undefined}
              />
            </div>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

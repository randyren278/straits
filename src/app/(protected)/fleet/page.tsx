/**
 * Fleet Overview Page (M006-S01)
 *
 * Tabbed view of active anomalies: one tab per anomaly type plus a
 * sanctioned-vessels tab. One panel is mounted at a time and each caps
 * rendering at 25 rows, keeping the page near a single screen.
 * Terminal aesthetic: bg-black, amber accents, font-mono, no border-radius.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/ui/Header';
import { AnomalyTable } from '@/components/fleet/AnomalyTable';
import { SanctionedVessels } from '@/components/fleet/SanctionedVessels';
import { FleetTabs, type FleetTab } from '@/components/fleet/FleetTabs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { Anomaly, AnomalyType } from '@/types/anomaly';
import { ANOMALY_TYPE_LABELS } from '@/types/anomaly';

const SANCTIONED_TAB_ID = 'sanctioned';

/** Group anomalies by type and sort groups by count descending */
function groupByType(anomalies: Anomaly[]): Array<{ type: AnomalyType; items: Anomaly[] }> {
  const groups = new Map<AnomalyType, Anomaly[]>();

  for (const anomaly of anomalies) {
    const existing = groups.get(anomaly.anomalyType);
    if (existing) {
      existing.push(anomaly);
    } else {
      groups.set(anomaly.anomalyType, [anomaly]);
    }
  }

  return Array.from(groups.entries())
    .map(([type, items]) => ({ type, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** Deduplicate sanctioned vessels by IMO, keeping the highest risk score */
function dedupeSanctioned(anomalies: Anomaly[]): Anomaly[] {
  const byImo = new Map<string, Anomaly>();
  for (const a of anomalies.filter((x) => x.isSanctioned)) {
    const existing = byImo.get(a.imo);
    if (!existing || (a.riskScore ?? 0) > (existing.riskScore ?? 0)) {
      byImo.set(a.imo, a);
    }
  }
  return Array.from(byImo.values());
}

export default function FleetPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnomalies() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/anomalies');
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}: Failed to fetch anomalies`);
        }
        const data: { anomalies: Anomaly[] } = await res.json();
        if (!cancelled) {
          setAnomalies(data.anomalies || []);
        }
      } catch (err) {
        console.error('Fleet page fetch error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load fleet data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAnomalies();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupByType(anomalies), [anomalies]);
  const sanctionedVessels = useMemo(() => dedupeSanctioned(anomalies), [anomalies]);

  const tabs = useMemo<FleetTab[]>(() => {
    const list: FleetTab[] = [];
    if (sanctionedVessels.length > 0) {
      list.push({
        id: SANCTIONED_TAB_ID,
        label: 'Sanctioned',
        count: sanctionedVessels.length,
        accent: 'red',
      });
    }
    for (const { type, items } of groups) {
      list.push({ id: type, label: ANOMALY_TYPE_LABELS[type], count: items.length });
    }
    return list;
  }, [groups, sanctionedVessels]);

  // Derived, not stored: falls back to the first tab (Sanctioned when present,
  // otherwise the largest category) both on first load and whenever a refetch
  // removes the tab that was selected.
  const activeTab = selectedTab && tabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : tabs[0]?.id ?? null;

  const activeGroup = groups.find((g) => g.type === activeTab);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto max-lg:p-3 max-lg:pb-[calc(var(--straits-nav-h)+1rem)]">
        {/* Page title */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">FLEET OVERVIEW</h1>
            {!loading && !error && (
              <p className="text-xs text-gray-600 mt-0.5 font-mono">
                {anomalies.length} active anomalies across {groups.length} categories
              </p>
            )}
          </div>
          {/* Export current fleet snapshot for offline analysis */}
          <div className="flex gap-2 shrink-0">
            <a
              href="/api/export?format=csv"
              className="inline-flex items-center max-lg:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              Export CSV
            </a>
            <a
              href="/api/export?format=json"
              className="inline-flex items-center max-lg:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-gray-600/50 text-gray-400 hover:bg-gray-800/50 transition-colors"
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
        {!loading && !error && anomalies.length === 0 && (
          <div className="flex items-center justify-center h-64 border border-amber-500/10 bg-gray-900/30">
            <p className="text-gray-500 font-mono text-sm uppercase tracking-widest">
              NO ACTIVE ANOMALIES DETECTED
            </p>
          </div>
        )}

        {/* Tabbed panels */}
        {!loading && !error && anomalies.length > 0 && activeTab && (
          <ErrorBoundary>
            <FleetTabs tabs={tabs} activeId={activeTab} onChange={setSelectedTab} />

            <div
              role="tabpanel"
              id={`fleet-panel-${activeTab}`}
              aria-labelledby={`fleet-tab-${activeTab}`}
              className="mt-4"
            >
              {/* key remounts the panel on tab change, resetting sort, page and any open dossier */}
              {activeTab === SANCTIONED_TAB_ID ? (
                <SanctionedVessels key={activeTab} vessels={sanctionedVessels} />
              ) : activeGroup ? (
                <AnomalyTable key={activeTab} anomalyType={activeGroup.type} anomalies={activeGroup.items} />
              ) : null}
            </div>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

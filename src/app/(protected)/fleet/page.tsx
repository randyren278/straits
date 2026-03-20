/**
 * Fleet Overview Page (M006-S01)
 *
 * Displays all active anomalies grouped by type in collapsible tables.
 * Fetches from /api/anomalies and groups client-side by anomalyType.
 * Terminal aesthetic: bg-black, amber accents, font-mono, no border-radius.
 */
'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/ui/Header';
import { AnomalyTable } from '@/components/fleet/AnomalyTable';
import type { Anomaly, AnomalyType } from '@/types/anomaly';

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

export default function FleetPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, []);

  const groups = groupByType(anomalies);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">
            FLEET OVERVIEW
          </h1>
          {!loading && !error && (
            <p className="text-xs text-gray-600 mt-0.5 font-mono">
              {anomalies.length} active anomalies across {groups.length} categories
            </p>
          )}
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
            <p className="text-red-400 font-mono text-sm">
              ERROR: {error}
            </p>
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

        {/* Anomaly tables grouped by type */}
        {!loading && !error && anomalies.length > 0 && (
          <div className="space-y-4">
            {groups.map(({ type, items }) => (
              <AnomalyTable
                key={type}
                anomalyType={type}
                anomalies={items}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

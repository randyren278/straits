'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnomalyTable } from './AnomalyTable';
import { SanctionedVessels } from './SanctionedVessels';
import type { TableView, SortDir } from '@/lib/hooks/useTableView';
import type { Anomaly, AnomalyType } from '@/types/anomaly';

const PAGE_SIZE = 15;
const EMPTY_ROWS: Anomaly[] = [];

/** Fetch only the active tab's current page; sort and pager remain global. */
export function FleetTablePanel({ tab, total, initialRows }: { tab: string; total: number; initialRows?: Anomaly[] }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'riskScore', dir: 'desc' });
  const [result, setResult] = useState<{ key: string; rows: Anomaly[]; error: string | null } | null>(
    () => initialRows ? { key: `${tab}:1:riskScore:desc`, rows: initialRows, error: null } : null,
  );
  const requestKey = `${tab}:${page}:${sort.key}:${sort.dir}`;
  const rows = result?.key === requestKey ? result.rows : EMPTY_ROWS;
  const loading = result?.key !== requestKey;
  const error = result?.key === requestKey ? result.error : null;

  useEffect(() => {
    if (result?.key === requestKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      view: 'fleet-page', tab, page: String(page), sort: sort.key, dir: sort.dir,
    });
    fetch(`/api/anomalies?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load fleet page`);
        return response.json() as Promise<{ anomalies: Anomaly[] }>;
      })
      .then((data) => { if (!controller.signal.aborted) setResult({ key: requestKey, rows: data.anomalies, error: null }); })
      .catch((cause) => {
        if (!controller.signal.aborted) setResult({
          key: requestKey, rows: [], error: cause instanceof Error ? cause.message : 'Failed to load fleet page',
        });
      });
    return () => controller.abort();
  }, [tab, page, sort, requestKey, result?.key]);

  const view = useMemo<TableView<Anomaly>>(() => ({
    rows,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
    rangeStart: total ? (page - 1) * PAGE_SIZE + 1 : 0,
    rangeEnd: Math.min(page * PAGE_SIZE, total),
    sortKey: sort.key,
    sortDir: sort.dir,
    toggleSort: (key) => {
      setSort((previous) => {
        if (previous.key === key) return { key, dir: previous.dir === 'asc' ? 'desc' : 'asc' };
        const defaultDir = key === 'vesselName' ? 'asc' : 'desc';
        return { key, dir: defaultDir };
      });
      setPage(1);
    },
    setPage: (next) => setPage(Math.max(1, Math.min(next, Math.ceil(total / PAGE_SIZE)))),
  }), [rows, page, total, sort]);

  if (loading) return <p className="p-6 text-xs font-mono uppercase text-amber-500" role="status">Loading fleet page…</p>;
  if (error) return <p className="p-6 text-xs font-mono text-red-400" role="alert">{error}</p>;
  if (tab === 'sanctioned') return <SanctionedVessels vessels={rows} remoteView={view} />;
  return <AnomalyTable anomalyType={tab as AnomalyType} anomalies={rows} remoteView={view} />;
}

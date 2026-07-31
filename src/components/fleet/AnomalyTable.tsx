/**
 * AnomalyTable — sortable, paged table of anomalies for a single anomaly type.
 * Rendered as the content of a Fleet page tab; the tab controls visibility,
 * so this component has no collapse of its own.
 * Requirements: M006-S01 (Fleet page grouped anomaly tables)
 */
'use client';

import React, { useState } from 'react';
import { AnomalyBadge } from '@/components/ui/AnomalyBadge';
import { FleetVesselDetail } from '@/components/fleet/FleetVesselDetail';
import { TablePager } from '@/components/fleet/TablePager';
import { SortableHeader, MobileSortBar } from '@/components/fleet/SortControls';
import { handleRowKeyDown } from '@/components/fleet/rowActivation';
import { useTableView, type SortColumn } from '@/lib/hooks/useTableView';
import type { Anomaly, AnomalyType } from '@/types/anomaly';

interface AnomalyTableProps {
  anomalyType: AnomalyType;
  anomalies: Anomaly[];
}

function toTime(value: Date | string): number | null {
  const t = (typeof value === 'string' ? new Date(value) : value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Sortable columns. Flag is excluded — it is empty for every row. */
export const ANOMALY_SORT_COLUMNS: SortColumn<Anomaly>[] = [
  { key: 'vesselName', label: 'Vessel Name', defaultDir: 'asc', value: (a) => a.vesselName ?? null },
  { key: 'riskScore', label: 'Risk Score', defaultDir: 'desc', value: (a) => a.riskScore ?? null },
  { key: 'detectedAt', label: 'Detected', defaultDir: 'desc', value: (a) => toTime(a.detectedAt) },
];

function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function AnomalyTable({ anomalyType, anomalies }: AnomalyTableProps) {
  const [expandedImo, setExpandedImo] = useState<string | null>(null);
  const view = useTableView(anomalies, ANOMALY_SORT_COLUMNS, { defaultSortKey: 'riskScore' });

  const [nameColumn, riskColumn, detectedColumn] = ANOMALY_SORT_COLUMNS;

  // An expanded row that survives a page or sort change points at a vessel
  // no longer in view.
  function handleSort(key: string): void {
    setExpandedImo(null);
    view.toggleSort(key);
  }

  function handlePageChange(page: number): void {
    setExpandedImo(null);
    view.setPage(page);
  }

  return (
    <div className="border border-amber-500/20 bg-black">
      <MobileSortBar
        columns={ANOMALY_SORT_COLUMNS as SortColumn<never>[]}
        activeKey={view.sortKey}
        dir={view.sortDir}
        onSort={handleSort}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <SortableHeader
                column={nameColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={handleSort}
              />
              <th className="phone:hidden px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                IMO
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                Flag
              </th>
              <SortableHeader
                column={riskColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={handleSort}
              />
              <th className="phone:hidden px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                Confidence
              </th>
              <SortableHeader
                column={detectedColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {view.rows.map((anomaly) => (
              <React.Fragment key={anomaly.id}>
                <tr
                  className={`border-t border-amber-500/10 cursor-pointer transition-colors ${
                    expandedImo === anomaly.imo ? 'bg-amber-500/10' : 'hover:bg-amber-500/5'
                  }`}
                  data-imo={anomaly.imo}
                  data-anomaly-id={anomaly.id}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedImo === anomaly.imo}
                  aria-label={`${anomaly.vesselName || anomaly.imo}: expand for intelligence dossier`}
                  onClick={() => setExpandedImo((prev) => (prev === anomaly.imo ? null : anomaly.imo))}
                  onKeyDown={(e) =>
                    handleRowKeyDown(e, () =>
                      setExpandedImo((prev) => (prev === anomaly.imo ? null : anomaly.imo)),
                    )
                  }
                >
                  <td className="px-4 py-2 phone:py-3.5 text-sm font-mono text-gray-300">
                    {anomaly.vesselName || '—'}
                  </td>
                  <td className="phone:hidden px-4 py-2 text-sm font-mono text-gray-400">{anomaly.imo}</td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">{anomaly.flag || '—'}</td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {anomaly.riskScore != null ? (
                      <span
                        className={
                          anomaly.riskScore >= 70
                            ? 'text-red-400'
                            : anomaly.riskScore >= 40
                              ? 'text-amber-400'
                              : 'text-green-400'
                        }
                      >
                        {anomaly.riskScore}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="phone:hidden px-4 py-2">
                    <AnomalyBadge type={anomaly.anomalyType} confidence={anomaly.confidence} />
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-500">
                    {formatTimestamp(anomaly.detectedAt)}
                  </td>
                </tr>
                {expandedImo === anomaly.imo && (
                  <tr className="border-t border-amber-500/10">
                    <td colSpan={6} className="p-0">
                      <FleetVesselDetail
                        imo={anomaly.imo}
                        anomalyDetails={
                          anomaly.details as Parameters<typeof FleetVesselDetail>[0]['anomalyDetails']
                        }
                        anomalyType={anomalyType}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager
        page={view.page}
        pageCount={view.pageCount}
        rangeStart={view.rangeStart}
        rangeEnd={view.rangeEnd}
        total={view.total}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

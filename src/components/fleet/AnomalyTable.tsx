/**
 * AnomalyTable — Collapsible table of anomalies for a single anomaly type.
 * Renders vessel metadata columns for the Fleet page.
 * Requirements: M006-S01 (Fleet page grouped anomaly tables)
 */
'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AnomalyBadge } from '@/components/ui/AnomalyBadge';
import { FleetVesselDetail } from '@/components/fleet/FleetVesselDetail';
import type { Anomaly, AnomalyType } from '@/types/anomaly';

interface AnomalyTableProps {
  anomalyType: AnomalyType;
  anomalies: Anomaly[];
}

const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  going_dark: 'Going Dark',
  loitering: 'Loitering',
  deviation: 'Route Deviation',
  speed: 'Speed Anomaly',
  repeat_going_dark: 'Repeat Going Dark',
  sts_transfer: 'STS Transfer',
};

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
  const [expanded, setExpanded] = useState<boolean>(false);
  const [expandedImo, setExpandedImo] = useState<string | null>(null);

  return (
    <div className="border border-amber-500/20 bg-black">
      {/* Section header — click to collapse/expand */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
        aria-expanded={expanded}
        aria-label={`${ANOMALY_TYPE_LABELS[anomalyType]} anomalies — ${anomalies.length} detected`}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-amber-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-500" />
          )}
          <AnomalyBadge type={anomalyType} confidence="confirmed" size="md" />
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500">
            {ANOMALY_TYPE_LABELS[anomalyType]}
          </span>
          <span className="text-xs font-mono text-gray-500">
            [{anomalies.length}]
          </span>
        </div>
      </button>

      {/* Collapsible table body */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-t border-amber-500/10">
                <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  Vessel Name
                </th>
                <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  IMO
                </th>
                <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  Flag
                </th>
                <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  Risk Score
                </th>
                <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  Confidence
                </th>
                <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  Detected
                </th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((anomaly) => (
                <React.Fragment key={anomaly.id}>
                  <tr
                    className={`border-t border-amber-500/10 cursor-pointer transition-colors ${
                      expandedImo === anomaly.imo
                        ? 'bg-amber-500/10'
                        : 'hover:bg-amber-500/5'
                    }`}
                    data-imo={anomaly.imo}
                    data-anomaly-id={anomaly.id}
                    onClick={() => setExpandedImo(prev => prev === anomaly.imo ? null : anomaly.imo)}
                  >
                  <td className="px-4 py-2 text-sm font-mono text-gray-300">
                    {anomaly.vesselName || '—'}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {anomaly.imo}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {anomaly.flag || '—'}
                  </td>
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
                  <td className="px-4 py-2">
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
                        anomalyDetails={anomaly.details}
                        anomalyType={anomaly.anomalyType}
                      />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * SanctionedVessels — Red-accented panel listing sanctioned vessels at top of Fleet page.
 * Receives a pre-filtered, deduplicated array of Anomaly records from FleetPage.
 * Click a row to expand the inline intelligence dossier (FleetVesselDetail).
 * Returns null when the array is empty (renders nothing).
 * Requirements: M007-S01 (Sanctions Priority List)
 */
'use client';

import React, { useState } from 'react';
import { FleetVesselDetail } from '@/components/fleet/FleetVesselDetail';
import type { Anomaly } from '@/types/anomaly';

interface SanctionedVesselsProps {
  vessels: Anomaly[];
}

export function SanctionedVessels({ vessels }: SanctionedVesselsProps) {
  const [expandedImo, setExpandedImo] = useState<string | null>(null);

  if (vessels.length === 0) {
    return null;
  }

  return (
    <div
      className="border border-red-500/30 bg-black"
      data-testid="sanctioned-vessels"
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 bg-gray-900/50 px-4 py-3">
        {/* Red dot indicator */}
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 text-xs font-mono uppercase tracking-widest">
          SANCTIONED VESSELS
        </span>
        <span className="text-xs font-mono text-red-400/70">
          [{vessels.length}]
        </span>
      </div>

      {/* Desktop table (md+) — clips Sanction Category on phones, so mobile uses the card list below */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-t border-red-500/10">
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                Vessel Name
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                IMO
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                Flag
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                Risk Score
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                Sanction Category
              </th>
            </tr>
          </thead>
          <tbody>
            {vessels.map((vessel) => (
              <React.Fragment key={vessel.imo}>
                <tr
                  className={`border-t border-red-500/10 cursor-pointer transition-colors ${
                    expandedImo === vessel.imo
                      ? 'bg-red-500/10'
                      : 'hover:bg-red-500/5'
                  }`}
                  data-imo={vessel.imo}
                  aria-expanded={expandedImo === vessel.imo}
                  role="button"
                  aria-label={`${vessel.vesselName || vessel.imo}: expand for intelligence dossier`}
                  onClick={() => setExpandedImo(prev => prev === vessel.imo ? null : vessel.imo)}
                >
                  <td className="px-4 py-2 text-sm font-mono text-gray-300">
                    {vessel.vesselName || '—'}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {vessel.imo}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {vessel.flag || '—'}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono">
                    {vessel.riskScore != null ? (
                      <span
                        className={
                          vessel.riskScore >= 70
                            ? 'text-red-400'
                            : vessel.riskScore >= 40
                              ? 'text-amber-400'
                              : 'text-green-400'
                        }
                      >
                        {vessel.riskScore}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {vessel.sanctionRiskCategory || '—'}
                  </td>
                </tr>
                {expandedImo === vessel.imo && (
                  <tr className="border-t border-red-500/10">
                    <td colSpan={5} className="p-0">
                      <FleetVesselDetail
                        imo={vessel.imo}
                        anomalyDetails={vessel.details as Parameters<typeof FleetVesselDetail>[0]['anomalyDetails']}
                        anomalyType={vessel.anomalyType}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list (<md) — Sanction Category always visible (the table clips it on phones) */}
      <div className="lg:hidden divide-y divide-red-500/10">
        {vessels.map((vessel) => (
          <React.Fragment key={vessel.imo}>
            <button
              type="button"
              data-imo={vessel.imo}
              aria-expanded={expandedImo === vessel.imo}
              aria-label={`${vessel.vesselName || vessel.imo}: expand for intelligence dossier`}
              onClick={() => setExpandedImo((prev) => (prev === vessel.imo ? null : vessel.imo))}
              className={`w-full text-left min-h-[44px] px-4 py-3 ${expandedImo === vessel.imo ? 'bg-red-500/10' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-gray-200">{vessel.vesselName || '—'}</span>
                {vessel.riskScore != null && (
                  <span
                    className={`text-xs font-mono border px-2 py-0.5 ${
                      vessel.riskScore >= 70
                        ? 'border-red-400 text-red-400'
                        : vessel.riskScore >= 40
                          ? 'border-amber-400 text-amber-400'
                          : 'border-green-400 text-green-400'
                    }`}
                  >
                    RISK {vessel.riskScore}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-gray-500 mt-1">
                IMO {vessel.imo} · {vessel.flag || '—'}
              </div>
              <div className="text-xs font-mono text-red-400/90 mt-1.5 border-t border-red-500/15 pt-1.5">
                {vessel.sanctionRiskCategory || '—'}
              </div>
            </button>
            {expandedImo === vessel.imo && (
              <FleetVesselDetail
                imo={vessel.imo}
                anomalyDetails={vessel.details as Parameters<typeof FleetVesselDetail>[0]['anomalyDetails']}
                anomalyType={vessel.anomalyType}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

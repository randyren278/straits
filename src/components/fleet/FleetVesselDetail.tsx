'use client';

/**
 * FleetVesselDetail — Inline intelligence dossier for expanded fleet table rows.
 * Fetches risk score + history from API and renders risk factors, anomaly history,
 * destination log, sanctions, and a "Show on Map" navigation button.
 *
 * Requirements: M006-S02 (Inline Vessel Detail & Map Navigation)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ExternalLink, MapPin, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { AnomalyBadge } from '@/components/ui/AnomalyBadge';
import { useVesselStore } from '@/stores/vessel';
import type { RiskFactors } from '@/lib/db/risk-scores';
import type {
  AnomalyType,
  Confidence,
  GoingDarkDetails,
  LoiteringDetails,
  SpeedDetails,
  StsTransferDetails,
  DeviationDetails,
  RepeatGoingDarkDetails,
} from '@/types/anomaly';

type AnomalyDetails =
  | GoingDarkDetails
  | LoiteringDetails
  | DeviationDetails
  | SpeedDetails
  | RepeatGoingDarkDetails
  | StsTransferDetails;

interface FleetVesselDetailProps {
  imo: string;
  anomalyDetails: AnomalyDetails;
  anomalyType: AnomalyType;
}

interface SanctionDetail {
  authority: string;
  riskCategory: string | null;
  datasets: string[] | null;
  flag: string | null;
  aliases: string[] | null;
  opensanctionsUrl: string | null;
  vesselType: string | null;
  name: string | null;
}

interface AnomalyHistoryItem {
  id: number;
  anomalyType: string;
  confidence: string;
  detectedAt: string;
  resolvedAt: string | null;
}

interface DestChange {
  id: number;
  previousDestination: string;
  newDestination: string;
  changedAt: string;
}

/** Extract lat/lon from anomaly details when position data is available */
function extractPosition(
  details: AnomalyDetails,
  type: AnomalyType
): { lat: number; lon: number } | null {
  switch (type) {
    case 'going_dark':
      return (details as GoingDarkDetails).lastPosition;
    case 'loitering':
      return (details as LoiteringDetails).centroid;
    case 'speed':
      return (details as SpeedDetails).lastPosition;
    case 'sts_transfer': {
      const sts = details as StsTransferDetails;
      return { lat: sts.lat, lon: sts.lon };
    }
    case 'deviation':
    case 'repeat_going_dark':
      return null;
    default:
      return null;
  }
}

function getRiskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
}

function getBarColor(value: number, max: number): string {
  const pct = (value / max) * 100;
  if (pct >= 70) return 'bg-red-500';
  if (pct >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
}

const RISK_FACTORS: ReadonlyArray<{ label: string; key: keyof RiskFactors; max: number }> = [
  { label: 'Going Dark', key: 'goingDark', max: 40 },
  { label: 'Sanctions', key: 'sanctions', max: 25 },
  { label: 'Flag Risk', key: 'flagRisk', max: 15 },
  { label: 'Loitering', key: 'loitering', max: 10 },
  { label: 'STS Events', key: 'sts', max: 10 },
] as const;

export function FleetVesselDetail({ imo, anomalyDetails, anomalyType }: FleetVesselDetailProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<{ score: number; factors: RiskFactors; computedAt: string | null } | null>(null);
  const [sanctionDetail, setSanctionDetail] = useState<SanctionDetail | null>(null);
  const [anomalyHistory, setAnomalyHistory] = useState<AnomalyHistoryItem[]>([]);
  const [destChanges, setDestChanges] = useState<DestChange[]>([]);

  const position = extractPosition(anomalyDetails, anomalyType);
  const canShowOnMap = position !== null;

  // Fetch dossier data on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchDossier() {
      setLoading(true);
      setError(null);
      try {
        const [riskRes, historyRes] = await Promise.all([
          fetch(`/api/vessels/${imo}/risk`),
          fetch(`/api/vessels/${imo}/history`),
        ]);
        if (cancelled) return;

        if (riskRes.ok) {
          const data = await riskRes.json();
          setRiskScore({ score: data.score, factors: data.factors, computedAt: data.computedAt });
          setSanctionDetail(data.sanction || null);
        } else {
          console.error(`[FleetVesselDetail] Risk fetch failed for IMO ${imo}: HTTP ${riskRes.status}`);
        }

        if (historyRes.ok) {
          const data = await historyRes.json();
          setAnomalyHistory(data.anomalies || []);
          setDestChanges(data.destinationChanges || []);
        } else {
          console.error(`[FleetVesselDetail] History fetch failed for IMO ${imo}: HTTP ${historyRes.status}`);
        }
      } catch (err) {
        console.error('[FleetVesselDetail] Dossier fetch error for IMO', imo, err);
        if (!cancelled) {
          setError('Failed to load intelligence data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDossier();
    return () => { cancelled = true; };
  }, [imo]);

  const handleShowOnMap = () => {
    if (!position) return;
    useVesselStore.getState().setMapCenter({ lat: position.lat, lon: position.lon, zoom: 12 });
    router.push('/dashboard');
  };

  // Loading state
  if (loading) {
    return (
      <div className="px-4 py-6 bg-gray-900/40 border-t border-amber-500/10">
        <p className="text-amber-500 font-mono text-xs uppercase tracking-widest animate-pulse text-center">
          LOADING INTELLIGENCE...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-4 py-4 bg-gray-900/40 border-t border-amber-500/10">
        <p className="text-red-400 font-mono text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/40 border-t border-amber-500/10 px-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Risk Score Section */}
        <div className="border border-amber-500/20 bg-black/40">
          <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">RISK SCORE</span>
          </div>
          {riskScore ? (
            <div className="px-3 py-2">
              <div className={`text-2xl font-mono font-bold mb-2 ${getRiskColor(riskScore.score)}`}>
                {riskScore.score}
              </div>
              <div className="space-y-1.5">
                {RISK_FACTORS.map(({ label, key, max }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-20 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-gray-800">
                      <div
                        className={`h-full ${getBarColor(riskScore.factors[key], max)}`}
                        style={{ width: `${(riskScore.factors[key] / max) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-white w-8 text-right">
                      {riskScore.factors[key]}/{max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-3">
              <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">
                RISK SCORE UNAVAILABLE
              </span>
            </div>
          )}
        </div>

        {/* Anomaly History Section */}
        <div className="border border-amber-500/20 bg-black/40">
          <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
            <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">ANOMALY HISTORY</span>
            <span className="text-xs text-gray-500 font-mono">{anomalyHistory.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {anomalyHistory.length > 0 ? (
              anomalyHistory.map((a) => (
                <div key={a.id} className="px-3 py-1.5 border-b border-gray-800/50 text-xs">
                  <div className="flex items-center justify-between">
                    <AnomalyBadge
                      type={a.anomalyType as AnomalyType}
                      confidence={a.confidence as Confidence}
                      size="sm"
                    />
                    <span className="text-gray-500 font-mono">
                      {format(new Date(a.detectedAt), 'MM/dd HH:mm')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-3">
                <span className="text-xs text-gray-600 font-mono">No anomaly history</span>
              </div>
            )}
          </div>
        </div>

        {/* Destination Log Section */}
        <div className="border border-amber-500/20 bg-black/40">
          <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
            <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">DESTINATION LOG</span>
            <span className="text-xs text-gray-500 font-mono">{destChanges.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {destChanges.length > 0 ? (
              destChanges.map((dc) => (
                <div key={dc.id} className="px-3 py-1.5 border-b border-gray-800/50 text-xs">
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-gray-500">{dc.previousDestination}</span>
                    <span className="text-amber-500">{'\u2192'}</span>
                    <span className="text-white">{dc.newDestination}</span>
                  </div>
                  <div className="text-gray-600 font-mono mt-0.5">
                    {format(new Date(dc.changedAt), 'MM/dd HH:mm')}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-3">
                <span className="text-xs text-gray-600 font-mono">No destination changes</span>
              </div>
            )}
          </div>
        </div>

        {/* Sanctions + Show on Map Section */}
        <div className="flex flex-col gap-4">
          {/* Sanctions Block */}
          {sanctionDetail && (
            <div className="border border-red-700 bg-red-900/30">
              <div className="px-3 py-1.5 border-b border-red-700 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-red-400 font-mono uppercase tracking-widest">SANCTIONED</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-red-300">Authority</span>
                  <span className="font-mono text-white">{sanctionDetail.authority}</span>
                </div>
                {sanctionDetail.datasets && sanctionDetail.datasets.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sanctionDetail.datasets.map((d) => (
                      <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 border border-red-700 text-red-300">
                        {d.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
                {sanctionDetail.flag && (
                  <div className="flex justify-between text-xs">
                    <span className="text-red-300">Flag</span>
                    <span className="font-mono text-white uppercase">{sanctionDetail.flag}</span>
                  </div>
                )}
                {sanctionDetail.aliases && sanctionDetail.aliases.length > 0 && (
                  <div>
                    <span className="text-xs text-red-300">Aliases:</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {sanctionDetail.aliases.map((alias) => (
                        <span key={alias} className="text-[10px] font-mono text-gray-400 bg-gray-800/50 px-1 py-0.5">
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {sanctionDetail.opensanctionsUrl && (
                  <a
                    href={sanctionDetail.opensanctionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-red-300 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="font-mono">OpenSanctions Profile</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Show on Map Button */}
          <button
            onClick={handleShowOnMap}
            disabled={!canShowOnMap}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-widest border transition-colors
              ${canShowOnMap
                ? 'border-amber-500/60 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500'
                : 'border-gray-700 text-gray-600 cursor-not-allowed'
              }`}
            title={!canShowOnMap ? 'Position data not available for this anomaly type' : `Show IMO ${imo} on map`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Show on Map
          </button>
        </div>
      </div>
    </div>
  );
}

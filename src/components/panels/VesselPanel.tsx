'use client';

/**
 * Vessel detail side panel component.
 * Displays selected vessel information with track toggle, anomaly section, and watchlist button.
 * Requirements: MAP-02, MAP-04, INTL-01, ANOM-01, HIST-02, PANL-01, PANL-02, PANL-03
 */
import { useState, useEffect, useCallback } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { AlertTriangle, Eye, EyeOff, ChevronDown, ChevronRight, Shield, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AnomalyBadge } from '../ui/AnomalyBadge';
import type { AnomalyType, Confidence } from '@/types/anomaly';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import type { RiskFactors } from '@/lib/db/risk-scores';

export function VesselPanel() {
  const { selectedVessel, showTrack, setShowTrack, setSelectedVessel, watchlist, addToWatchlist, removeFromWatchlist } =
    useVesselStore();
  const [userId, setUserId] = useState<string | null>(null);

  // Intelligence dossier state
  const [riskScore, setRiskScore] = useState<{ score: number; factors: RiskFactors; computedAt: string | null } | null>(null);
  const [riskError, setRiskError] = useState(false);
  const [sanctionDetail, setSanctionDetail] = useState<{
    authority: string; riskCategory: string | null; datasets: string[] | null;
    flag: string | null; aliases: string[] | null; opensanctionsUrl: string | null;
    vesselType: string | null; name: string | null;
  } | null>(null);
  const [anomalyHistory, setAnomalyHistory] = useState<Array<{
    id: number; anomalyType: string; confidence: string;
    detectedAt: string; resolvedAt: string | null; details: Record<string, unknown>;
  }>>([]);
  const [destChanges, setDestChanges] = useState<Array<{
    id: number; previousDestination: string; newDestination: string; changedAt: string;
  }>>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    risk: true, anomalies: false, destinations: false,
  });

  // Initialize user ID from localStorage
  useEffect(() => {
    let id = localStorage.getItem('tanker_tracker_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tanker_tracker_user_id', id);
    }
    setUserId(id);
  }, []);

  // imo may be null for IMO-less vessels (position-only reports from vessel_positions)
  const vesselImo = selectedVessel ? ((selectedVessel as VesselWithSanctions).imo ?? null) : null;

  // Fetch intelligence dossier data when vessel changes
  useEffect(() => {
    if (!vesselImo) {
      setRiskScore(null);
      setRiskError(false);
      setSanctionDetail(null);
      setAnomalyHistory([]);
      setDestChanges([]);
      return;
    }

    const fetchDossier = async () => {
      try {
        const [riskRes, historyRes] = await Promise.all([
          fetch(`/api/vessels/${vesselImo}/risk`),
          fetch(`/api/vessels/${vesselImo}/history`),
        ]);
        if (riskRes.ok) {
          const data = await riskRes.json();
          setRiskScore({ score: data.score, factors: data.factors, computedAt: data.computedAt });
          setSanctionDetail(data.sanction || null);
          setRiskError(false);
        } else {
          setRiskError(true);
        }
        if (historyRes.ok) {
          const data = await historyRes.json();
          setAnomalyHistory(data.anomalies || []);
          setDestChanges(data.destinationChanges || []);
        }
      } catch (err) {
        console.error('[VesselPanel] Failed to fetch dossier:', err);
        setRiskError(true);
      }
    };
    fetchDossier();
  }, [vesselImo]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  if (!selectedVessel) return null;

  const isWatched = vesselImo ? watchlist.some(w => w.imo === vesselImo) : false;

  const handleWatchlist = async () => {
    if (!userId || !vesselImo) return;

    if (isWatched) {
      removeFromWatchlist(vesselImo);
      await fetch(`/api/watchlist?imo=${vesselImo}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
    } else {
      addToWatchlist({ userId, imo: vesselImo, addedAt: new Date(), notes: null });
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ imo: vesselImo }),
      });
    }
  };

  // Extract anomaly data from selectedVessel (if present via extended type)
  const vesselWithAnomaly = selectedVessel as typeof selectedVessel & {
    anomalyType?: string | null;
    anomalyConfidence?: string | null;
    anomalyDetectedAt?: Date | null;
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getBarColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 70) return 'bg-red-500';
    if (pct >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-black">
      {/* Terminal panel header */}
      <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">VESSEL DETAIL</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWatchlist}
            className={`p-1 ${
              isWatched ? 'text-amber-500' : 'text-gray-500 hover:text-white'
            }`}
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSelectedVessel(null)}
            className="text-gray-500 hover:text-white p-1"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Vessel name */}
      <div className="px-3 py-2 border-b border-amber-500/10">
        <span className="font-mono text-white text-xs">{selectedVessel.name}</span>
      </div>

      {/* Data rows */}
      <div className="px-3 py-2 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">IMO</span>
          <span className="font-mono text-white">{selectedVessel.imo || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">MMSI</span>
          <span className="font-mono text-white">{selectedVessel.mmsi}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Flag</span>
          <span className="font-mono text-white">{selectedVessel.flag || 'Unknown'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span className="font-mono text-white">
            {selectedVessel.shipType == null
              ? 'Unknown'
              : selectedVessel.shipType >= 80 && selectedVessel.shipType <= 89
                ? `Tanker (${selectedVessel.shipType})`
                : `Type ${selectedVessel.shipType}`}
          </span>
        </div>
        <div className="border-t border-amber-500/10 pt-1.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-gray-500">Speed</span>
            <span className="font-mono text-white">
              {selectedVessel.position?.speed?.toFixed(1) ?? 'N/A'} kn
            </span>
          </div>
          <div className="flex justify-between mb-1.5">
            <span className="text-gray-500">Heading</span>
            <span className="font-mono text-white">
              {selectedVessel.position?.heading ?? 'N/A'}
              {selectedVessel.position?.heading != null && '\u00B0'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Course</span>
            <span className="font-mono text-white">
              {selectedVessel.position?.course ?? 'N/A'}
              {selectedVessel.position?.course != null && '\u00B0'}
            </span>
          </div>
        </div>
        <div className="border-t border-amber-500/10 pt-1.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-gray-500">Destination</span>
            <span className="font-mono text-white">{selectedVessel.destination || 'Not reported'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Position</span>
            <span className="font-mono text-white text-xs">
              {selectedVessel.position?.latitude.toFixed(4)},{' '}
              {selectedVessel.position?.longitude.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      {/* Sanctions Alert Section (M005-S03) */}
      {'isSanctioned' in selectedVessel &&
        (selectedVessel as VesselWithSanctions).isSanctioned === true && (() => {
          const sv = selectedVessel as VesselWithSanctions;
          const riskCat = sv.sanctionRiskCategory || sanctionDetail?.riskCategory || '';
          const isShadow = riskCat === 'mare.shadow;poi';
          const isDetained = riskCat.startsWith('mare.detained');
          const isSanctionedRisk = riskCat === 'sanction';
          const bgColor = isShadow ? 'bg-purple-900/30 border-purple-700' : isDetained ? 'bg-rose-900/30 border-rose-700' : 'bg-red-900/30 border-red-700';
          const textColor = isShadow ? 'text-purple-400' : isDetained ? 'text-rose-400' : 'text-red-400';
          const subColor = isShadow ? 'text-purple-300' : isDetained ? 'text-rose-300' : 'text-red-300';
          const label = isShadow ? 'SHADOW FLEET' : isDetained ? 'DETAINED' : isSanctionedRisk ? 'SANCTIONED' : 'LISTED';

          // Derive authorities from datasets if available
          const datasets = sanctionDetail?.datasets || [];
          const authorityLabels: Record<string, string> = {
            us_ofac_sdn: 'OFAC SDN', us_ofac_cons: 'OFAC Non-SDN', us_trade_csl: 'US CSL',
            eu_fsf: 'EU FSF', eu_sanctions_map: 'EU Sanctions', eu_journal_sanctions: 'EU Journal',
            gb_fcdo_sanctions: 'UK FCDO', ca_dfatd_sema_sanctions: 'Canada SEMA',
            ch_seco_sanctions: 'Swiss SECO', un_1718_vessels: 'UN 1718',
            ua_war_sanctions: 'Ukraine War', fr_tresor_gels_avoir: 'France Trésor',
            be_fod_sanctions: 'Belgium FOD', mc_fund_freezes: 'Monaco',
            ae_local_terrorists: 'UAE',
          };
          const authorities = datasets
            .map((d: string) => authorityLabels[d] || d.replace(/_/g, ' '))
            .filter(Boolean);

          return (
            <div className={`mx-3 mb-2 px-3 py-2 ${bgColor}`}>
              <div className={`flex items-center gap-2 ${textColor}`}>
                <AlertTriangle className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-widest">{label}</span>
              </div>

              {/* Authorities */}
              {authorities.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {authorities.map((auth: string) => (
                    <span key={auth} className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                      isShadow ? 'border-purple-700 text-purple-300' : isDetained ? 'border-rose-700 text-rose-300' : 'border-red-700 text-red-300'
                    }`}>
                      {auth}
                    </span>
                  ))}
                </div>
              )}

              {/* Sanctions flag (from sanctions data, may differ from AIS flag) */}
              {sanctionDetail?.flag && (
                <div className="mt-1.5 flex justify-between text-xs">
                  <span className={subColor}>Sanctions Flag</span>
                  <span className="font-mono text-white uppercase">{sanctionDetail.flag}</span>
                </div>
              )}

              {/* Aliases */}
              {sanctionDetail?.aliases && sanctionDetail.aliases.length > 0 && (
                <div className="mt-1.5">
                  <span className={`text-xs ${subColor}`}>Also known as:</span>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {sanctionDetail.aliases.map((alias: string) => (
                      <span key={alias} className="text-[10px] font-mono text-gray-400 bg-gray-800/50 px-1 py-0.5">
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* OpenSanctions link */}
              {sanctionDetail?.opensanctionsUrl && (
                <a
                  href={sanctionDetail.opensanctionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-1.5 flex items-center gap-1 text-xs ${subColor} hover:underline`}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="font-mono">OpenSanctions Profile</span>
                </a>
              )}
            </div>
          );
        })()}

      {/* Anomaly Detection Section */}
      {vesselWithAnomaly.anomalyType && (
        <div className="mx-3 mb-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2">
            <AnomalyBadge
              type={vesselWithAnomaly.anomalyType as AnomalyType}
              confidence={(vesselWithAnomaly.anomalyConfidence as Confidence) || 'unknown'}
              size="md"
            />
            <span className="text-orange-400 text-xs font-mono uppercase tracking-widest">Anomaly Detected</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {vesselWithAnomaly.anomalyType === 'going_dark' && 'AIS signal lost in coverage zone'}
            {vesselWithAnomaly.anomalyType === 'loitering' && 'Vessel loitering in open water'}
            {vesselWithAnomaly.anomalyType === 'speed' && 'Unusual speed detected (possible drift)'}
            {vesselWithAnomaly.anomalyType === 'deviation' && 'Vessel deviating from expected route'}
            {vesselWithAnomaly.anomalyDetectedAt && (
              <div className="text-xs mt-1">
                Detected: {formatDistanceToNow(new Date(vesselWithAnomaly.anomalyDetectedAt), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Score Section (PANL-02) */}
      {vesselImo && riskError && (
        <div className="mx-3 mb-2 border border-amber-500/20">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">RISK SCORE UNAVAILABLE</span>
          </div>
        </div>
      )}
      {vesselImo && riskScore && (
        <div className="mx-3 mb-2 border border-amber-500/20">
          <button
            onClick={() => toggleSection('risk')}
            className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">RISK SCORE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm font-bold ${getRiskColor(riskScore.score)}`}>
                {riskScore.score}
              </span>
              {expandedSections.risk
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </button>
          {expandedSections.risk && (
            <div className="px-3 py-2 space-y-1.5">
              {([
                { label: 'Going Dark', value: riskScore.factors.goingDark, max: 40 },
                { label: 'Sanctions', value: riskScore.factors.sanctions, max: 25 },
                { label: 'Flag Risk', value: riskScore.factors.flagRisk, max: 15 },
                { label: 'Loitering', value: riskScore.factors.loitering, max: 10 },
                { label: 'STS Events', value: riskScore.factors.sts, max: 10 },
              ] as const).map(({ label, value, max }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-20 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-gray-800">
                    <div
                      className={`h-full ${getBarColor(value, max)}`}
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-white w-8 text-right">{value}/{max}</span>
                </div>
              ))}
              {riskScore.computedAt && (
                <div className="text-xs text-gray-600 pt-1">
                  Computed {formatDistanceToNow(new Date(riskScore.computedAt), { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Anomaly History Section (PANL-01) */}
      {vesselImo && anomalyHistory.length > 0 && (
        <div className="mx-3 mb-2 border border-amber-500/20">
          <button
            onClick={() => toggleSection('anomalies')}
            className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
          >
            <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">ANOMALY HISTORY</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{anomalyHistory.length}</span>
              {expandedSections.anomalies
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </button>
          {expandedSections.anomalies && (
            <div className="max-h-48 overflow-y-auto">
              {anomalyHistory.map((a) => (
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
                  {a.resolvedAt && (
                    <div className="text-gray-600 mt-0.5 font-mono">
                      Resolved {format(new Date(a.resolvedAt), 'MM/dd HH:mm')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Destination Changes Section (PANL-03) */}
      {vesselImo && destChanges.length > 0 && (
        <div className="mx-3 mb-2 border border-amber-500/20">
          <button
            onClick={() => toggleSection('destinations')}
            className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
          >
            <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">DESTINATION LOG</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{destChanges.length}</span>
              {expandedSections.destinations
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </button>
          {expandedSections.destinations && (
            <div className="max-h-48 overflow-y-auto">
              {destChanges.map((dc) => (
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Track toggle */}
      <div className="px-3 py-2">
        <button
          onClick={() => setShowTrack(!showTrack)}
          className={`w-full py-1.5 font-mono text-xs uppercase tracking-widest transition-colors border
            ${
              showTrack
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
            }`}
        >
          {showTrack ? 'Hide Track' : 'Show Track History'}
        </button>
      </div>
    </div>
  );
}

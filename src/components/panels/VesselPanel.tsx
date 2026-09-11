'use client';

/**
 * Vessel dossier side panel.
 *
 * Three reading levels, top to bottom:
 *   1. the contact — name, observation age, position, and why it matters
 *   2. its evidence — a chronological trail of fixes, detector conclusions
 *      and listings; each event with a position can focus the map
 *   3. supporting metadata — identity fields, risk breakdown, sanctions
 *      references, known associates, track and export controls
 *
 * Requirements: MAP-02, MAP-04, INTL-01, ANOM-01, HIST-02, PANL-01, PANL-02, PANL-03
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { useSharedUserId } from '@/lib/hooks/useSharedUserId';
import { AlertTriangle, Eye, EyeOff, ChevronDown, ChevronRight, Shield, ExternalLink, Download, Users, Crosshair, Link2, Check } from 'lucide-react';
import { serializeInvestigation } from '@/lib/dashboard/investigation-link';
import { format } from 'date-fns';
import { AnomalyBadge } from '../ui/AnomalyBadge';
import { decodeNavStatus, isDeclaredStationary } from '@/lib/ais/nav-status';
import { compactAge } from '../ui/StatusChip';
import { observationTone } from '../ui/DataFreshness';
import { riskCategoryLabel, authorityLabel } from '@/lib/sanctions/labels';
import { buildEvidenceTrail, whyItMatters, type EvidenceEvent } from '@/lib/dossier/evidence';
import type { AnomalyType, Confidence } from '@/types/anomaly';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import type { RiskFactors } from '@/lib/db/risk-scores';

interface Associate {
  partnerImo: string;
  partnerName: string | null;
  encounterCount: string;
  lastSeenAt: string;
  minDistanceKm: number | null;
  partnerSanctioned: boolean;
}

const SOURCE_LABEL: Record<EvidenceEvent['source'], { label: string; cls: string }> = {
  observed: { label: 'OBS', cls: 'text-gray-400 border-gray-600' },
  detector: { label: 'DET', cls: 'text-orange-300 border-orange-500/60' },
  reference: { label: 'REF', cls: 'text-red-300 border-red-500/60' },
};

export function VesselPanel() {
  const {
    selectedVessel, showTrack, setShowTrack, setSelectedVessel, watchlist, addToWatchlist, removeFromWatchlist,
    trackStatus, setMapCenter, setTargetVesselImo, viewport, tankersOnly, anomalyFilter,
  } = useVesselStore();
  const [userId] = useSharedUserId();
  const [copied, setCopied] = useState(false);

  // Intelligence dossier state
  const [riskScore, setRiskScore] = useState<{ score: number; factors: RiskFactors; computedAt: string | null } | null>(null);
  const [riskError, setRiskError] = useState(false);
  const [sanctionDetail, setSanctionDetail] = useState<{
    authority: string; riskCategory: string | null; datasets: string[] | null;
    flag: string | null; aliases: string[] | null; opensanctionsUrl: string | null;
    vesselType: string | null; name: string | null; listDate: string | null;
  } | null>(null);
  const [anomalyHistory, setAnomalyHistory] = useState<Array<{
    id: number; anomalyType: string; confidence: string;
    detectedAt: string; resolvedAt: string | null; details: Record<string, unknown>;
  }>>([]);
  const [destChanges, setDestChanges] = useState<Array<{
    id: number; previousDestination: string; newDestination: string; changedAt: string;
  }>>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    evidence: true, risk: false, identity: false, associates: true,
  });
  // Observation age ticks on a timer so it never reads the clock during render.
  const [fixAge, setFixAge] = useState<{ label: string; minutes: number } | null>(null);

  // imo may be null for IMO-less vessels (position-only reports from vessel_positions)
  const vesselImo = selectedVessel ? ((selectedVessel as VesselWithSanctions).imo ?? null) : null;
  const observedAt = selectedVessel?.position?.time ? new Date(selectedVessel.position.time) : null;
  const observedMs = observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt.getTime() : null;

  useEffect(() => {
    const compute = () => {
      if (observedMs === null) { setFixAge(null); return; }
      const now = Date.now();
      setFixAge({ label: compactAge(new Date(observedMs), now), minutes: (now - observedMs) / 60000 });
    };
    compute();
    if (observedMs === null) return;
    const t = setInterval(compute, 10_000);
    return () => clearInterval(t);
  }, [observedMs]);

  // Fetch intelligence dossier data when vessel changes
  useEffect(() => {
    const fetchDossier = async () => {
      if (!vesselImo) {
        setRiskScore(null);
        setRiskError(false);
        setSanctionDetail(null);
        setAnomalyHistory([]);
        setDestChanges([]);
        setAssociates([]);
        return;
      }

      try {
        const [riskRes, historyRes, associatesRes] = await Promise.all([
          fetch(`/api/vessels/${vesselImo}/risk`),
          fetch(`/api/vessels/${vesselImo}/history`),
          fetch(`/api/vessels/${vesselImo}/associates`),
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
        if (associatesRes.ok) {
          const data = await associatesRes.json();
          setAssociates(data.associates || []);
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

  const trail = useMemo(() => buildEvidenceTrail({
    latestFix: selectedVessel?.position
      ? { time: selectedVessel.position.time, lat: selectedVessel.position.latitude, lon: selectedVessel.position.longitude }
      : null,
    anomalies: anomalyHistory,
    destinationChanges: destChanges,
    sanction: sanctionDetail ? { authority: sanctionDetail.authority, riskCategory: sanctionDetail.riskCategory, listDate: sanctionDetail.listDate } : null,
  }), [selectedVessel, anomalyHistory, destChanges, sanctionDetail]);

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

  const sv = selectedVessel as VesselWithSanctions;
  const activeAnomalies = anomalyHistory.filter((a) => !a.resolvedAt);
  const why = whyItMatters({
    isSanctioned: sv.isSanctioned === true,
    sanctionRiskCategory: sv.sanctionRiskCategory ?? sanctionDetail?.riskCategory ?? null,
    anomalyType: sv.anomalyType ?? null,
    anomalyConfidence: sv.anomalyConfidence ?? null,
    riskScore: riskScore?.score ?? null,
    activeAnomalyCount: Math.max(activeAnomalies.length, sv.anomalyType ? 1 : 0),
    associateCount: associates.length,
    sanctionedAssociateCount: associates.filter((a) => a.partnerSanctioned).length,
    fixAgeHours: fixAge ? fixAge.minutes / 60 : null,
  });

  const fixTone = fixAge ? observationTone(fixAge.minutes) : null;

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

  const focusEvent = (e: EvidenceEvent) => {
    if (!e.location) return;
    setMapCenter({ lat: e.location.lat, lon: e.location.lon, zoom: 10 });
  };

  const openAssociate = (imo: string) => {
    setTargetVesselImo(imo);
  };

  // A link that reproduces this investigation: the contact, the current map
  // view and the active filters.
  const copyLink = async () => {
    if (typeof window === 'undefined') return;
    const qs = serializeInvestigation({
      vessel: vesselImo,
      view: viewport,
      tankersOnly,
      anomaliesOnly: anomalyFilter,
    });
    const url = `${window.location.origin}/dashboard${qs}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions); fall back to prompt.
      window.prompt('Copy this investigation link', url);
    }
  };

  const riskCat = riskCategoryLabel(sv.sanctionRiskCategory || sanctionDetail?.riskCategory || null);
  const toneCls = {
    red: { box: 'bg-red-900/30 border-red-700', text: 'text-red-400', sub: 'text-red-300', chip: 'border-red-700 text-red-300' },
    purple: { box: 'bg-purple-900/30 border-purple-700', text: 'text-purple-400', sub: 'text-purple-300', chip: 'border-purple-700 text-purple-300' },
    rose: { box: 'bg-rose-900/30 border-rose-700', text: 'text-rose-400', sub: 'text-rose-300', chip: 'border-rose-700 text-rose-300' },
    amber: { box: 'bg-amber-900/30 border-amber-700', text: 'text-amber-400', sub: 'text-amber-300', chip: 'border-amber-700 text-amber-300' },
  }[riskCat.tone];

  const trackLine = (() => {
    if (!showTrack) return null;
    switch (trackStatus.state) {
      case 'loading': return { text: 'Loading track…', cls: 'text-gray-500' };
      case 'empty': return { text: `No track observations in the last ${trackStatus.hours} hours`, cls: 'text-yellow-400' };
      case 'error': return { text: 'Track history unavailable — request failed', cls: 'text-red-400' };
      case 'ready': return { text: `${trackStatus.count} fixes drawn · last ${trackStatus.hours}h`, cls: 'text-amber-500' };
      default: return null;
    }
  })();

  return (
    <div className="bg-black" data-testid="vessel-panel">
      {/* Terminal panel header */}
      <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
          Contact
        </span>
        <div className="flex items-center gap-2">
          {vesselImo && (
            <button
              type="button"
              onClick={copyLink}
              className={`p-1 ${copied ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}
              aria-label={copied ? 'Link copied' : 'Copy investigation link'}
              title={copied ? 'Copied' : 'Copy a link to this contact and map view'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleWatchlist}
            className={`p-1 ${
              isWatched ? 'text-amber-500' : 'text-gray-500 hover:text-white'
            }`}
            aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
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

      {/* Level 1 — the contact */}
      <div key={selectedVessel.mmsi} className="px-3 py-2.5 border-b border-amber-500/10 straits-acquire" data-testid="contact-header">
        <div className="font-mono text-white text-sm tracking-wide">{selectedVessel.name || `MMSI ${selectedVessel.mmsi}`}</div>
        <div className="mt-1 flex items-center gap-3 text-xs font-mono">
          <span
            data-testid="observation-age"
            className={`flex items-center gap-1 ${fixTone?.text ?? 'text-gray-500'}`}
            title={observedAt ? format(observedAt, 'yyyy-MM-dd HH:mm:ss') + ' UTC' : undefined}
          >
            <span className={`w-1.5 h-1.5 ${fixTone?.dot ?? 'bg-gray-600'}`} aria-hidden="true" />
            <span className="uppercase tracking-wider text-[10px] text-gray-500">Observed</span>
            <span>{fixAge ? (fixAge.label === 'now' ? 'just now' : `${fixAge.label} ago`) : 'no fix'}</span>
          </span>
          {selectedVessel.position && (
            <span className="text-gray-400">
              {selectedVessel.position.latitude.toFixed(3)}, {selectedVessel.position.longitude.toFixed(3)}
            </span>
          )}
        </div>
        {fixAge && fixAge.minutes > 60 && (
          <p className="mt-1 text-[10px] font-mono text-gray-500">
            Position shown is the last received fix, not a live location.
          </p>
        )}
        {why && (
          <p data-testid="why-it-matters" className="mt-2 text-xs text-amber-200/90 leading-snug border-l-2 border-amber-500/60 pl-2">
            {why}
          </p>
        )}
      </div>

      {/* Identity flag (compact) */}
      {sv.isSanctioned === true && (
        <div className={`mx-3 mt-2 px-3 py-2 border ${toneCls.box}`}>
          <div className={`flex items-center gap-2 ${toneCls.text}`}>
            <AlertTriangle className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">{riskCat.label}</span>
          </div>
          <p className={`mt-1 text-xs ${toneCls.sub}`}>{riskCat.meaning}</p>

          {sanctionDetail?.datasets && sanctionDetail.datasets.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sanctionDetail.datasets.map((d) => (
                <span key={d} className={`text-[10px] font-mono px-1.5 py-0.5 border ${toneCls.chip}`}>
                  {authorityLabel(d)}
                </span>
              ))}
            </div>
          )}

          {sanctionDetail?.flag && (
            <div className="mt-1.5 flex justify-between text-xs">
              <span className={toneCls.sub}>Sanctions flag</span>
              <span className="font-mono text-white uppercase">{sanctionDetail.flag}</span>
            </div>
          )}

          {sanctionDetail?.aliases && sanctionDetail.aliases.length > 0 && (
            <div className="mt-1.5">
              <span className={`text-xs ${toneCls.sub}`}>Also known as</span>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {sanctionDetail.aliases.map((alias: string) => (
                  <span key={alias} className="text-[11px] font-mono text-gray-300 bg-gray-800/60 px-1 py-0.5">
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {sanctionDetail?.opensanctionsUrl && (
            <a
              href={sanctionDetail.opensanctionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1.5 flex items-center gap-1 text-xs ${toneCls.sub} hover:underline`}
            >
              <ExternalLink className="w-3 h-3" />
              <span className="font-mono">OpenSanctions profile</span>
            </a>
          )}
        </div>
      )}

      {/* Active anomaly (current) */}
      {sv.anomalyType && (
        <div className="mx-3 mt-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2">
            <AnomalyBadge
              type={sv.anomalyType as AnomalyType}
              confidence={(sv.anomalyConfidence as Confidence) || 'unknown'}
              size="md"
            />
            <span className="text-orange-400 text-xs font-mono uppercase tracking-widest">Active</span>
          </div>
          <div className="mt-1.5 text-xs text-gray-300">
            {sv.anomalyType === 'going_dark' && 'AIS signal lost inside a coverage zone'}
            {sv.anomalyType === 'loitering' && 'Holding position in open water'}
            {sv.anomalyType === 'speed' && 'Unusual speed (possible drift)'}
            {sv.anomalyType === 'deviation' && 'Course inconsistent with declared destination'}
            {sv.anomalyType === 'sts_transfer' && 'Alongside another vessel at sea'}
            {sv.anomalyType === 'spoofed_position' && 'Reported position physically implausible'}
            {sv.anomalyType === 'repeat_going_dark' && 'Repeated AIS gaps'}
            {sv.anomalyDetectedAt && (
              <span className="text-gray-500"> · detected {compactAge(new Date(sv.anomalyDetectedAt))} ago</span>
            )}
          </div>
        </div>
      )}

      {/* Level 2 — evidence trail */}
      {vesselImo && (
        <div className="mx-3 mt-2 border border-amber-500/20" data-testid="evidence-trail">
          <button
            onClick={() => toggleSection('evidence')}
            aria-expanded={expandedSections.evidence}
            className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
          >
            <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">Evidence trail</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{trail.length}</span>
              {expandedSections.evidence
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </button>
          {expandedSections.evidence && (
            <div className="max-h-64 overflow-y-auto">
              {trail.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500 font-mono">No recorded events for this hull.</p>
              )}
              {trail.map((e) => {
                const src = SOURCE_LABEL[e.source];
                const row = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[9px] font-mono px-1 border ${src.cls}`} title={
                          e.source === 'observed' ? 'Observed fact from the AIS feed'
                            : e.source === 'detector' ? 'Detector conclusion — see confidence'
                            : 'External reference listing'
                        }>{src.label}</span>
                        <span className="text-gray-200 font-mono truncate">{e.title}</span>
                        {e.confidence && e.confidence !== 'unknown' && (
                          <span className={`text-[9px] font-mono uppercase ${e.confidence === 'confirmed' ? 'text-red-300' : 'text-yellow-300'}`}>
                            {e.confidence}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-500 font-mono shrink-0">{format(e.at, 'MM/dd HH:mm')}</span>
                    </div>
                    {e.detail && <div className="text-gray-400 mt-0.5 font-mono text-[11px]">{e.detail}</div>}
                    {e.resolvedAt && (
                      <div className="text-gray-600 mt-0.5 font-mono text-[10px]">Resolved {format(e.resolvedAt, 'MM/dd HH:mm')}</div>
                    )}
                  </>
                );
                return e.location ? (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => focusEvent(e)}
                    className="w-full text-left px-3 py-1.5 border-b border-gray-800/50 text-xs hover:bg-amber-500/5 focus:bg-amber-500/5"
                    title="Focus map on this event"
                  >
                    {row}
                  </button>
                ) : (
                  <div key={e.id} className="px-3 py-1.5 border-b border-gray-800/50 text-xs">{row}</div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Known associates — navigable */}
      {vesselImo && associates.length > 0 && (
        <div className="mx-3 mt-2 border border-amber-500/20" data-testid="known-associates">
          <button
            onClick={() => toggleSection('associates')}
            aria-expanded={expandedSections.associates}
            className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">Known associates</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{associates.length}</span>
              {expandedSections.associates
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </button>
          {expandedSections.associates && (
            <div className="max-h-40 overflow-y-auto">
              {associates.map((a) => (
                <button
                  key={a.partnerImo}
                  type="button"
                  onClick={() => openAssociate(a.partnerImo)}
                  className="w-full text-left px-3 py-1.5 border-b border-gray-800/50 text-xs hover:bg-amber-500/5"
                  title={`Open ${a.partnerName || a.partnerImo}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono truncate ${a.partnerSanctioned ? 'text-red-400' : 'text-gray-200'}`}>
                      {a.partnerName || `IMO ${a.partnerImo}`}
                    </span>
                    <span className="text-gray-500 font-mono shrink-0">×{a.encounterCount}</span>
                  </div>
                  <div className="text-gray-500 font-mono mt-0.5 text-[11px]">
                    IMO {a.partnerImo}
                    {a.minDistanceKm !== null && ` · ${Number(a.minDistanceKm).toFixed(2)} km`}
                    {a.partnerSanctioned && <span className="text-red-400"> · sanctioned</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk Score Section (PANL-02) */}
      {vesselImo && riskError && (
        <div className="mx-3 mt-2 border border-amber-500/20">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">Risk score unavailable</span>
          </div>
        </div>
      )}
      {vesselImo && riskScore && (
        <div className="mx-3 mt-2 border border-amber-500/20">
          <button
            onClick={() => toggleSection('risk')}
            aria-expanded={expandedSections.risk}
            className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">Risk score</span>
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
                  Computed {compactAge(new Date(riskScore.computedAt))} ago
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Level 3 — identity & kinematics */}
      <div className="mx-3 mt-2 border border-amber-500/20">
        <button
          onClick={() => toggleSection('identity')}
          aria-expanded={expandedSections.identity}
          className="w-full px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20"
        >
          <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">Identity & kinematics</span>
          {expandedSections.identity
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
        </button>
        {expandedSections.identity && (
          <div className="px-3 py-2 space-y-1.5 text-xs" role="region" aria-label="Vessel details">
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
                  {selectedVessel.position?.heading != null && '°'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Course</span>
                <span className="font-mono text-white">
                  {selectedVessel.position?.course ?? 'N/A'}
                  {selectedVessel.position?.course != null && '°'}
                </span>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-gray-500">Nav Status</span>
                <span className="font-mono text-white">
                  {decodeNavStatus(selectedVessel.position?.navStatus ?? null)}
                </span>
              </div>
              {/* Display-only contradiction flag: declared anchored/moored but moving */}
              {isDeclaredStationary(selectedVessel.position?.navStatus ?? null) &&
                (selectedVessel.position?.speed ?? 0) > 1 && (
                <div className="flex items-center gap-1 mt-1 text-amber-500">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-mono text-[10px] uppercase tracking-wide">
                    Declared stationary but moving
                  </span>
                </div>
              )}
            </div>
            <div className="border-t border-amber-500/10 pt-1.5">
              <div className="flex justify-between mb-1.5">
                <span className="text-gray-500">Destination</span>
                <span className="font-mono text-white">{selectedVessel.destination || 'Not reported'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Observed</span>
                <span className="font-mono text-white">
                  {observedAt && !Number.isNaN(observedAt.getTime()) ? format(observedAt, 'yyyy-MM-dd HH:mm') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Track toggle */}
      <div className="px-3 py-2 space-y-1.5">
        <button
          onClick={() => setShowTrack(!showTrack)}
          aria-pressed={showTrack}
          className={`w-full py-1.5 font-mono text-xs uppercase tracking-widest transition-colors border
            ${
              showTrack
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
            }`}
        >
          {showTrack ? 'Hide Track' : 'Show Track History'}
        </button>
        {trackLine && (
          <p data-testid="track-status" role="status" className={`text-[11px] font-mono ${trackLine.cls}`}>
            {trackLine.text}
          </p>
        )}
        {vesselImo && (
          <a
            href={`/api/export/vessel/${vesselImo}`}
            download
            className="w-full py-1.5 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors border border-gray-700 text-gray-500 hover:border-amber-500/40 hover:text-amber-500"
          >
            <Download className="w-3.5 h-3.5" />
            Export Dossier
          </a>
        )}
      </div>
    </div>
  );
}

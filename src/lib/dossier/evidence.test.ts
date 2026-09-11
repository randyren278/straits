import { describe, it, expect } from 'vitest';
import { buildEvidenceTrail, whyItMatters, anomalyLocation } from './evidence';

describe('buildEvidenceTrail', () => {
  it('merges fixes, anomalies, destination changes and listings newest-first', () => {
    const trail = buildEvidenceTrail({
      latestFix: { time: '2026-09-11T10:00:00Z', lat: 25.1, lon: 55.2 },
      anomalies: [
        { id: 1, anomalyType: 'going_dark', confidence: 'confirmed', detectedAt: '2026-09-09T02:00:00Z', resolvedAt: null,
          details: { gapMinutes: 200, lastPosition: { lat: 24, lon: 56 } } },
      ],
      destinationChanges: [
        { id: 7, previousDestination: 'FUJAIRAH', newDestination: 'BANDAR ABBAS', changedAt: '2026-09-10T00:00:00Z' },
      ],
      sanction: { authority: 'OFAC', riskCategory: 'mare.shadow;poi', listDate: '2026-01-05T00:00:00Z' },
    });

    expect(trail.map((e) => e.id)).toEqual(['fix', 'dest-7', 'anomaly-1', 'sanction']);
    expect(trail.map((e) => e.source)).toEqual(['observed', 'observed', 'detector', 'reference']);
    expect(trail[2].detail).toBe('gap 3h 20m');
    expect(trail[2].location).toEqual({ lat: 24, lon: 56 });
    expect(trail[2].confidence).toBe('confirmed');
    expect(trail[3].title).toBe('Shadow fleet listing');
  });

  it('skips records without a usable timestamp instead of throwing', () => {
    const trail = buildEvidenceTrail({
      latestFix: { time: null, lat: 0, lon: 0 },
      anomalies: [{ id: 1, anomalyType: 'loitering', confidence: 'suspected', detectedAt: 'garbage', resolvedAt: null, details: null }],
      destinationChanges: [],
      sanction: { authority: 'EU', riskCategory: 'sanction', listDate: null },
    });
    expect(trail).toEqual([]);
  });
});

describe('anomalyLocation', () => {
  it('reads the position field appropriate to each detector', () => {
    expect(anomalyLocation('loitering', { centroid: { lat: 1, lon: 2 } })).toEqual({ lat: 1, lon: 2 });
    expect(anomalyLocation('sts_transfer', { lat: 3, lon: 4 })).toEqual({ lat: 3, lon: 4 });
    expect(anomalyLocation('deviation', { deviationDegrees: 40 })).toBeNull();
    expect(anomalyLocation('deviation', { lastLat: 11.8, lastLon: 44.3 })).toEqual({ lat: 11.8, lon: 44.3 });
  });
});

describe('whyItMatters', () => {
  const base = {
    isSanctioned: false, sanctionRiskCategory: null, anomalyType: null, anomalyConfidence: null,
    riskScore: null, activeAnomalyCount: 0, associateCount: 0, sanctionedAssociateCount: 0, fixAgeHours: 1,
  };

  it('says nothing for an unremarkable contact', () => {
    expect(whyItMatters(base)).toBeNull();
  });

  it('leads with identity, then activity, then associations', () => {
    expect(whyItMatters({
      ...base,
      isSanctioned: true, sanctionRiskCategory: 'sanction',
      anomalyType: 'going_dark', anomalyConfidence: 'confirmed', activeAnomalyCount: 2,
      sanctionedAssociateCount: 1,
    })).toBe('Sanctioned hull · going dark · confirmed (+1 more active) · met 1 sanctioned vessel at sea');
  });

  it('mentions staleness only when there is already something to say', () => {
    expect(whyItMatters({ ...base, fixAgeHours: 80 })).toBeNull();
    expect(whyItMatters({ ...base, anomalyType: 'loitering', fixAgeHours: 80 })).toBe('Loitering · last seen 3d ago');
  });
});

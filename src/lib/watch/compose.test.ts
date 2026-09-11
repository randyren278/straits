import { describe, it, expect } from 'vitest';
import { composeWatch, pickEvent, pickTraffic, pickCoverage, type EventFact } from './compose';

const NOW = new Date('2026-09-11T12:00:00Z');
const hormuz = { chokepoint: 'hormuz', name: 'Strait of Hormuz', center: { lat: 25.25, lon: 56.5 } };
const suez = { chokepoint: 'suez', name: 'Suez Canal', center: { lat: 31, lon: 32.25 } };

function event(over: Partial<EventFact> = {}): EventFact {
  return {
    imo: '9000001', mmsi: '123', name: 'ABROS', anomalyType: 'loitering', confidence: 'suspected',
    detectedAt: new Date('2026-09-11T10:00:00Z'), isSanctioned: false, sanctionRiskCategory: null,
    riskScore: 20, lat: 25.1, lon: 56.2, ...over,
  };
}

describe('pickEvent', () => {
  it('prefers a sanctioned hull with a confirmed event over a newer unlisted one', () => {
    const item = pickEvent([
      event({ imo: '1', name: 'NEWER', detectedAt: new Date('2026-09-11T11:55:00Z') }),
      event({ imo: '2', name: 'LISTED', isSanctioned: true, sanctionRiskCategory: 'sanction', confidence: 'confirmed', anomalyType: 'going_dark',
        detectedAt: new Date('2026-09-11T06:00:00Z') }),
    ], NOW)!;
    expect(item.title).toBe('LISTED — going dark');
    expect(item.detail).toBe('Sanctioned hull · confirmed · detected 6h ago');
    expect(item.target).toEqual({ lat: 25.1, lon: 56.2, zoom: 9, imo: '2' });
    expect(item.tone).toBe('alert');
  });

  it('returns null when there are no events rather than inventing one', () => {
    expect(pickEvent([], NOW)).toBeNull();
  });
});

describe('pickTraffic', () => {
  it('reports the largest meaningful 24h change with the raw counts as evidence', () => {
    const item = pickTraffic([
      { ...hormuz, recent: 40, previous: 80, z: -2.4 },
      { ...suez, recent: 300, previous: 287, z: 0.2 },
    ], NOW)!;
    expect(item.title).toBe('Strait of Hormuz — traffic down 50%');
    expect(item.evidence).toBe('80 → 40');
    expect(item.detail).toContain('SPC z -2.4');
    expect(item.tone).toBe('alert');
    expect(item.target?.chokepoint).toBe('hormuz');
  });

  it('ignores tiny baselines and small moves', () => {
    expect(pickTraffic([{ ...hormuz, recent: 2, previous: 6, z: null }], NOW)).toBeNull();
    expect(pickTraffic([{ ...suez, recent: 290, previous: 287, z: null }], NOW)).toBeNull();
  });

  it('describes traffic from a zero baseline without inventing a percentage', () => {
    const item = pickTraffic([{ ...suez, recent: 31, previous: 0, z: null }], NOW)!;
    expect(item.title).toBe('Suez Canal — traffic emerged');
    expect(item.detail).toContain('31 vessels in the last 24h vs 0 the day before');
    expect(item.evidence).toBe('0 → 31');
  });
});

describe('pickCoverage', () => {
  it('flags the whole feed before any zone when nothing has arrived for an hour', () => {
    const item = pickCoverage([{ ...hormuz, lastFix: NOW }], new Date('2026-09-11T09:00:00Z'), NOW)!;
    expect(item.title).toBe('AIS feed silent');
    expect(item.detail).toContain('3h');
    expect(item.target).toBeNull();
  });

  it('names the stalest zone while the feed is otherwise live', () => {
    const item = pickCoverage([
      { ...hormuz, lastFix: new Date('2026-09-11T11:50:00Z') },
      { ...suez, lastFix: null },
    ], NOW, NOW)!;
    expect(item.title).toBe('Suez Canal — no recent contacts');
    expect(item.detail).toContain('"not observed"');
  });

  it('stays quiet when every zone is fresh', () => {
    expect(pickCoverage([{ ...hormuz, lastFix: NOW }], NOW, NOW)).toBeNull();
  });
});

describe('composeWatch', () => {
  it('returns event, traffic, coverage in that order and omits what is absent', () => {
    const items = composeWatch({
      now: NOW,
      events: [event()],
      traffic: [{ ...hormuz, recent: 40, previous: 80, z: null }],
      coverage: [{ ...hormuz, lastFix: NOW }],
      feedLastFix: NOW,
    });
    expect(items.map((i) => i.kind)).toEqual(['event', 'traffic']);
  });
});

import { describe, expect, it } from 'vitest';
import { buildFrame } from './frame';
import { Nowcaster } from './nowcast';
import { encodeSeries } from './codec';
import type { TrackPayload } from './types';
import type { MapVessel } from '@/lib/map/map-vessel';

const vessel = (mmsi: string, lon: number, lat: number): MapVessel => ({
  imo: null, mmsi, name: mmsi, flag: null, shipType: 80, destination: null, lastSeen: null, isSanctioned: false,
  sanctioningAuthority: null, sanctionReason: null, sanctionRiskCategory: null, anomalyType: null, anomalyConfidence: null,
  position: { time: '2026-09-30T00:00:00Z', latitude: lat, longitude: lon, speed: null, course: null, heading: null, navStatus: null, lowConfidence: false },
});
const payload = (mmsi: string, underway: boolean): TrackPayload => ({
  mmsi, tier: 0, score: 90, parts: [30, 25, 15, 15, 5], state: underway ? 'underway' : 'rest', sog: underway ? 12 : 0, cog: 90, lastRealAt: 1000,
  method: underway ? 'hybrid' : null, uncert: 0.03,
  path: underway ? encodeSeries(Array.from({ length: 61 }, (_, k) => [1000 + k * 6, 25, 57 + k * 0.02])) : null,
  trail: null, cleaning: { kept: 1, rejected: 0, inland: 0, rerouted: 0 },
});

describe('buildFrame', () => {
  it('draws underway ships as glyphs and anchored ones as glow at wide zoom', () => {
    const nc = new Nowcaster(); const ps = [payload('m', true), payload('a', false)]; nc.ingest(ps, 1000);
    const f = buildFrame({ vessels: [vessel('m', 57, 25), vessel('a', 56.4, 25.3)], nc, byMmsi: new Map(ps.map((p) => [p.mmsi, p])),
      tMin: 1030, zoom: 7.5, project: (lon, lat) => ({ x: lon * 100, y: -lat * 100 }), selected: null });
    expect(f.ships.map((s) => s.mmsi)).toEqual(['m']);
    expect(f.ships[0].estimated).toBe(true);
    expect(f.glow).toHaveLength(1);
    expect(f.glowMix).toBe(1);
    expect(f.ahead[0].pts.length).toBeGreaterThan(3);
  });

  it('fades the glow out when zoomed in', () => {
    const nc = new Nowcaster();
    const f = buildFrame({ vessels: [vessel('a', 56.4, 25.3)], nc, byMmsi: new Map(), tMin: 0, zoom: 10, project: () => ({ x: 0, y: 0 }), selected: null });
    expect(f.glowMix).toBe(0);
  });
});

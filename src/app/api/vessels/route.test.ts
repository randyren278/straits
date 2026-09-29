import { beforeEach, describe, expect, it, vi } from 'vitest';

const getVesselsWithSanctions = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db/sanctions', () => ({ getVesselsWithSanctions }));

import { GET } from './route';

const observed = new Date('2026-09-29T12:00:00Z');
const vessel = {
  imo: '9000001', mmsi: '123456789', name: 'TEST', flag: 'PA', shipType: 80,
  destination: null, lastSeen: new Date('2026-09-29T11:00:00Z'),
  isSanctioned: false, sanctioningAuthority: null, sanctionReason: null, sanctionRiskCategory: null,
  anomalyType: null, anomalyConfidence: null, anomalyDetectedAt: null,
  position: { time: observed, imo: '9000001', mmsi: '123456789', latitude: 25,
    longitude: 55, speed: 10, course: 90, heading: 90, navStatus: 0, lowConfidence: false },
};

beforeEach(() => getVesselsWithSanctions.mockReset().mockResolvedValue([vessel]));

describe('GET /api/vessels', () => {
  it('preserves the full default response and exposes server work timing', async () => {
    const response = await GET(new Request('http://localhost/api/vessels'));
    const body = await response.json();
    expect(body.vessels[0].position).toMatchObject({ imo: vessel.imo, mmsi: vessel.mmsi });
    expect(response.headers.get('Server-Timing')).toMatch(/^db;dur=\d+\.\d, serialize;dur=\d+\.\d$/);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=30');
  });

  it('sends the compact map view without dropping distinct metadata freshness', async () => {
    const response = await GET(new Request('http://localhost/api/vessels?view=map&tankersOnly=true'));
    const body = await response.json();
    expect(getVesselsWithSanctions).toHaveBeenCalledWith(true);
    expect(body.vessels[0].position).not.toHaveProperty('mmsi');
    expect(body.vessels[0].lastSeen).toBe('2026-09-29T11:00:00.000Z');
    expect(body.latestObservation).toBe(observed.toISOString());
  });
});

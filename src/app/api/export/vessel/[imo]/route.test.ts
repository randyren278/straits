/**
 * Tests for GET /api/export/vessel/[imo] — Dark-Fleet Dossier export.
 * Mocks the underlying db/lib calls (vessels, sanctions, risk, positions, pool)
 * and asserts the returned JSON contains identity, a risk factor breakdown,
 * and at least one formatted anomaly detail number.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));
vi.mock('@/lib/db/vessels', () => ({ getVessel: vi.fn() }));
vi.mock('@/lib/db/sanctions', () => ({ getSanction: vi.fn() }));
vi.mock('@/lib/db/risk-scores', () => ({ getRiskScore: vi.fn() }));
vi.mock('@/lib/db/positions', () => ({ getPositionHistory: vi.fn() }));

function makeParams(imo: string) {
  return { params: Promise.resolve({ imo }) };
}

describe('GET /api/export/vessel/[imo]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates identity, risk factors, and anomaly detail numbers into a downloadable dossier', async () => {
    const { getVessel } = await import('@/lib/db/vessels');
    const { getSanction } = await import('@/lib/db/sanctions');
    const { getRiskScore } = await import('@/lib/db/risk-scores');
    const { getPositionHistory } = await import('@/lib/db/positions');
    const { pool } = await import('@/lib/db');

    vi.mocked(getVessel).mockResolvedValue({
      imo: '9999999',
      mmsi: '123456789',
      name: 'SILVER TRIUMPH',
      flag: 'PA',
      shipType: 80,
      destination: 'FUJAIRAH',
      lastSeen: new Date('2026-07-20T00:00:00Z'),
    } as any);

    vi.mocked(getSanction).mockResolvedValue({
      sanctioningAuthority: 'OFAC',
      riskCategory: 'sanction',
      datasets: ['us_ofac_sdn'],
      flag: 'PA',
      aliases: ['OLD NAME'],
      opensanctionsUrl: 'https://opensanctions.org/x',
      vesselType: 'tanker',
    } as any);

    vi.mocked(getRiskScore).mockResolvedValue({
      score: 82,
      factors: { goingDark: 40, flagRisk: 15, sanctions: 25, loitering: 0, sts: 2, rendezvous: 0 },
      computedAt: '2026-07-21T00:00:00Z',
    });

    vi.mocked(getPositionHistory).mockResolvedValue([
      { time: new Date(), mmsi: '123456789', imo: '9999999', latitude: 25.1, longitude: 56.3, speed: 0, course: 0, heading: 0, navStatus: 1, lowConfidence: false } as any,
    ]);

    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          id: 1,
          imo: '9999999',
          anomalyType: 'deviation',
          confidence: 'suspected',
          detectedAt: new Date('2026-07-19T00:00:00Z'),
          resolvedAt: null,
          details: { expectedHeading: 90, actualHeading: 132, deviationDegrees: 42, destination: 'FUJAIRAH' },
        },
      ],
    } as any);

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/export/vessel/9999999'), makeParams('9999999'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('dossier-9999999');

    const data = await response.json();

    // Identity
    expect(data.identity.imo).toBe('9999999');
    expect(data.identity.name).toBe('SILVER TRIUMPH');

    // Risk factor breakdown
    expect(data.risk.score).toBe(82);
    expect(data.risk.factors.goingDark).toBe(40);
    expect(data.risk.factors.sanctions).toBe(25);

    // Sanctions
    expect(data.sanctions.sanctioningAuthority).toBe('OFAC');

    // Anomaly with formatted detail number
    expect(data.anomalies).toHaveLength(1);
    expect(data.anomalies[0].type).toBe('deviation');
    expect(data.anomalies[0].summary).toContain('42');
    expect(data.anomalies[0].details.deviationDegrees).toBe(42);

    // Track
    expect(data.track).toHaveLength(1);
  });

  it('returns 500 when the underlying query fails', async () => {
    const { getVessel } = await import('@/lib/db/vessels');
    vi.mocked(getVessel).mockRejectedValue(new Error('db down'));

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/export/vessel/9999999'), makeParams('9999999'));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

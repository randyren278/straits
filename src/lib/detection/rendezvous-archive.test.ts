/**
 * Rendezvous Archive Tests
 *
 * Verifies that sustained proximity encounters are archived into vessel_rendezvous
 * BEFORE the stale rows are deleted from vessel_proximity_events, and that sanctions
 * status is stamped at archive time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool
vi.mock('@/lib/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock anomaly upsert — not under test here
vi.mock('@/lib/db/anomalies', () => ({
  upsertAnomaly: vi.fn(),
}));

describe('detectStsTransfers — rendezvous archival', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives into vessel_rendezvous BEFORE deleting stale proximity events', async () => {
    const { pool } = await import('@/lib/db');

    // First query = proximity search (one close pair). Subsequent queries return empty.
    vi.mocked(pool.query).mockImplementation(async () => ({ rows: [] }) as never);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          imo_a: '9111111',
          name_a: 'ALPHA',
          lat_a: 26.0,
          lon_a: 56.0,
          imo_b: '9222222',
          name_b: 'BETA',
          lat_b: 26.001,
          lon_b: 56.001,
          distance_km: 0.15,
        },
      ],
    } as never);

    const { detectStsTransfers } = await import('./sts-transfer');
    await detectStsTransfers();

    const sqls = vi.mocked(pool.query).mock.calls.map((c) => String(c[0]));

    const insertIdx = sqls.findIndex((s) => s.includes('INSERT INTO vessel_rendezvous'));
    const deleteIdx = sqls.findIndex((s) => s.includes('DELETE FROM vessel_proximity_events'));

    expect(insertIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    // Archive must happen before the delete
    expect(insertIdx).toBeLessThan(deleteIdx);
  });

  it('joins vessel_sanctions to stamp sanctioned status at archive time', async () => {
    const { pool } = await import('@/lib/db');
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

    const { detectStsTransfers } = await import('./sts-transfer');
    await detectStsTransfers();

    const archiveSql = vi
      .mocked(pool.query)
      .mock.calls.map((c) => String(c[0]))
      .find((s) => s.includes('INSERT INTO vessel_rendezvous'));

    expect(archiveSql).toBeDefined();
    expect(archiveSql).toContain('vessel_sanctions');
    expect(archiveSql).toContain('a_sanctioned');
    expect(archiveSql).toContain('b_sanctioned');
  });
});

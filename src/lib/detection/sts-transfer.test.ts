/**
 * Ship-to-Ship Transfer Detection Tests
 *
 * Tests for STS proximity-pair batching: both the vessel_proximity_events
 * upsert (Step A) and the vessel_anomalies upsert (Step D) should be issued
 * as chunked multi-row queries, not one round-trip per pair/vessel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../db/anomalies', () => ({
  upsertAnomaliesBatch: vi.fn(),
}));

import { pool } from '../db';
import { upsertAnomaliesBatch } from '../db/anomalies';
import { detectStsTransfers } from './sts-transfer';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaliesBatch = upsertAnomaliesBatch as ReturnType<typeof vi.fn>;

/**
 * Wires up the 5 sequential pool.query calls detectStsTransfers makes:
 * 1. close-pairs select, 2. proximity-events upsert, 3. rendezvous archive,
 * 4. stale-event delete, 5. sustained-pairs select.
 */
function mockRunSequence(closePairs: unknown[], sustainedPairs: unknown[]) {
  mockQuery.mockResolvedValueOnce({ rows: closePairs }); // 1. close pairs
  mockQuery.mockResolvedValueOnce({ rows: [] });          // 2. proximity upsert
  mockQuery.mockResolvedValueOnce({ rows: [] });          // 3. rendezvous archive
  mockQuery.mockResolvedValueOnce({ rows: [] });          // 4. stale delete
  mockQuery.mockResolvedValueOnce({ rows: sustainedPairs }); // 5. sustained select
}

const makePair = (imoA: string, imoB: string) => ({
  imo_a: imoA, name_a: `VESSEL_${imoA}`, lat_a: 25.0, lon_a: 56.0,
  imo_b: imoB, name_b: `VESSEL_${imoB}`, lat_b: 25.01, lon_b: 56.01,
  distance_km: 0.5,
});

describe('detectStsTransfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a single chunked upsert for proximity events regardless of pair count', async () => {
    const pairs = [makePair('1111111', '2222222'), makePair('3333333', '4444444')];
    mockRunSequence(pairs, []);

    await detectStsTransfers();

    // Step A upsert is the 2nd pool.query call; assert it's one multi-row
    // statement (not one call per pair).
    const proximityCall = mockQuery.mock.calls[1];
    expect(proximityCall[0]).toContain('INSERT INTO vessel_proximity_events');
    expect(proximityCall[1]).toHaveLength(pairs.length * 3); // 3 params/row
  });

  it('returns 0 and upserts an empty batch when no pairs are sustained', async () => {
    mockRunSequence([makePair('1111111', '2222222')], []);

    const count = await detectStsTransfers();

    expect(count).toBe(0);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('batches both anomaly rows for a sustained pair into one upsertAnomaliesBatch call', async () => {
    const pair = makePair('1111111', '2222222');
    mockRunSequence([pair], [{ imo_a: '1111111', imo_b: '2222222' }]);

    const count = await detectStsTransfers();

    expect(count).toBe(2); // 2 anomalies for 1 sustained pair
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    const batch = mockUpsertAnomaliesBatch.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(batch).toEqual([
      expect.objectContaining({ imo: '1111111', anomalyType: 'sts_transfer' }),
      expect.objectContaining({ imo: '2222222', anomalyType: 'sts_transfer' }),
    ]);
  });

  it('batches anomalies for multiple sustained pairs into a single call, not one per pair', async () => {
    const pairs = [makePair('1111111', '2222222'), makePair('3333333', '4444444')];
    const sustained = [
      { imo_a: '1111111', imo_b: '2222222' },
      { imo_a: '3333333', imo_b: '4444444' },
    ];
    mockRunSequence(pairs, sustained);

    const count = await detectStsTransfers();

    expect(count).toBe(4); // 2 pairs * 2 anomalies
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    expect(mockUpsertAnomaliesBatch.mock.calls[0][0]).toHaveLength(4);
  });
});

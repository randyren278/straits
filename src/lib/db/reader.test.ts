/**
 * The heavy harvester reads go through readerPool(), and only ever touch
 * tables the local mirror holds. A query that joins anything else must stay
 * on `pool`, or the mirror would answer it from tables it does not have.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./index', () => ({ pool: { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } }));
vi.mock('./anomalies', () => ({
  upsertAnomaliesBatch: vi.fn(async () => 0),
  resolveAnomaliesBatch: vi.fn(async () => 0),
}));

import { pool } from './index';
import { setReaderPool } from './reader';
import { loadEngineVessels } from './tracks';
import { loadSuezTracks } from './crossings';
import { detectLoitering } from '../detection/loitering';
import { detectSpeedAnomaly, detectDeviation } from '../detection/deviation';
import { detectSpoofedPositions } from '../detection/teleport';
import { detectGoingDark } from '../detection/going-dark';

const MIRRORED = new Set(['vessel_positions', 'vessels', 'vessel_fallback_metadata']);
const poolQuery = pool.query as unknown as ReturnType<typeof vi.fn>;
const reader = { query: vi.fn(async (_text: string) => ({ rows: [], rowCount: 0 })) };

/** Tables named after FROM/JOIN, minus CTE names. */
function tablesIn(sql: string): string[] {
  const ctes = new Set([...sql.matchAll(/\b(\w+)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
  return [...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((t) => t !== 'lateral' && !ctes.has(t));
}

function readerSql(): string[] {
  return reader.query.mock.calls.map((c) => c[0] as string);
}

beforeEach(() => {
  reader.query.mockClear();
  poolQuery.mockClear();
  setReaderPool(reader as never);
});
afterEach(() => setReaderPool(null));

describe.each([
  ['loadEngineVessels', () => loadEngineVessels()],
  ['loadSuezTracks', () => loadSuezTracks(new Date('2026-10-03T00:00:00Z'), new Date('2026-10-07T00:00:00Z'))],
  ['detectLoitering', () => detectLoitering()],
  ['detectSpeedAnomaly', () => detectSpeedAnomaly()],
  ['detectDeviation', () => detectDeviation()],
  ['detectSpoofedPositions', () => detectSpoofedPositions()],
  ['detectGoingDark', () => detectGoingDark()],
])('%s', (_name, run) => {
  it('reads through readerPool, touching only mirrored tables', async () => {
    await run();
    const sql = readerSql();
    expect(sql.length).toBeGreaterThan(0);
    for (const text of sql) {
      const tables = tablesIn(text);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables.filter((t) => !MIRRORED.has(t))).toEqual([]);
    }
  });

  it('sends no read of vessel_positions to the Supabase pool', async () => {
    await run();
    const poolSql = poolQuery.mock.calls.map((c) => String(c[0]));
    expect(poolSql.filter((t) => /\bFROM\s+vessel_positions\b|\bJOIN\s+vessel_positions\b/i.test(t) && /^\s*(WITH|SELECT)/i.test(t))).toEqual([]);
  });
});

describe('tablesIn', () => {
  it('ignores CTE names, LATERAL and expressions like EXTRACT(EPOCH FROM ...)', () => {
    const sql = `WITH recent AS (SELECT DISTINCT mmsi FROM vessel_positions)
      SELECT EXTRACT(EPOCH FROM (NOW() - v.last_seen)) FROM vessel_positions p JOIN recent USING (mmsi)
      LEFT JOIN LATERAL (SELECT name FROM vessels WHERE mmsi = p.mmsi) v ON true
      LEFT JOIN vessel_anomalies a ON a.imo = v.imo`;
    expect(tablesIn(sql)).toEqual(['vessel_positions', 'vessel_positions', 'vessels', 'vessel_anomalies']);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../db/index';
import type { SanctionEntry } from '../external/opensanctions';
import {
  SanctionsSnapshotRejectedError,
  validateSanctionsSnapshot,
} from './snapshot-guard';

vi.mock('../db/index', () => ({
  pool: { query: vi.fn() },
}));

const originalRatio = process.env.SANCTIONS_MIN_RETAIN_RATIO;
const mockQuery = vi.mocked(pool.query);

function entry(imo: string): SanctionEntry {
  return {
    imo,
    name: `VESSEL ${imo}`,
    vesselType: 'VESSEL',
    riskCategory: 'sanction',
    datasets: ['test'],
    flag: '',
    mmsi: '',
    aliases: [],
    opensanctionsUrl: '',
    countries: [],
    authority: 'OFAC',
    listDate: null,
    reason: 'sanction',
    sourceUrl: 'https://example.test',
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  delete process.env.SANCTIONS_MIN_RETAIN_RATIO;
});

afterEach(() => {
  if (originalRatio === undefined) delete process.env.SANCTIONS_MIN_RETAIN_RATIO;
  else process.env.SANCTIONS_MIN_RETAIN_RATIO = originalRatio;
});

describe('validateSanctionsSnapshot', () => {
  it('allows bootstrap snapshots without historical coverage', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 0 }] } as never);
    await expect(validateSanctionsSnapshot([entry('1111111')])).resolves.toMatchObject({
      incomingUnique: 1,
      currentCount: 0,
      retainRatio: 1,
    });
  });

  it('allows a healthy snapshot above the default 50% retention floor', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 1000 }] } as never);
    const entries = Array.from({ length: 700 }, (_, i) => entry(String(1000000 + i)));
    const result = await validateSanctionsSnapshot(entries);
    expect(result.retainRatio).toBeCloseTo(0.7);
  });

  it('rejects a suspiciously truncated snapshot before reconciliation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 1000 }] } as never);
    const entries = Array.from({ length: 100 }, (_, i) => entry(String(1000000 + i)));
    await expect(validateSanctionsSnapshot(entries)).rejects.toBeInstanceOf(
      SanctionsSnapshotRejectedError
    );
  });

  it('counts duplicate IMOs only once', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 100 }] } as never);
    await expect(
      validateSanctionsSnapshot([entry('1111111'), entry('1111111'), entry('2222222')])
    ).rejects.toThrow(/2 incoming unique IMOs/);
  });

  it('honors a stricter configured retention ratio', async () => {
    process.env.SANCTIONS_MIN_RETAIN_RATIO = '0.9';
    mockQuery.mockResolvedValue({ rows: [{ count: 100 }] } as never);
    const entries = Array.from({ length: 80 }, (_, i) => entry(String(1000000 + i)));
    await expect(validateSanctionsSnapshot(entries)).rejects.toThrow(/required 0.900/);
  });

  it('falls back to the safe default when configuration is invalid', async () => {
    process.env.SANCTIONS_MIN_RETAIN_RATIO = 'banana';
    mockQuery.mockResolvedValue({ rows: [{ count: 100 }] } as never);
    const entries = Array.from({ length: 60 }, (_, i) => entry(String(1000000 + i)));
    await expect(validateSanctionsSnapshot(entries)).resolves.toMatchObject({ retainRatio: 0.6 });
  });

  it('always rejects empty snapshots', async () => {
    await expect(validateSanctionsSnapshot([])).rejects.toThrow(/empty sanctions snapshot/);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

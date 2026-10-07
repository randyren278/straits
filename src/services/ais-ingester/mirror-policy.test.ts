import { describe, it, expect, vi } from 'vitest';
import { runMirrorSyncStep, degradedHeavyReadAllowed, attributeEgress } from './mirror-policy';
import type { MirrorSyncResult } from '../../lib/db/mirror';

const verified: MirrorSyncResult = { ready: true, reason: null, bucketsChecked: 168, bucketsRepaired: 0, bucketsPending: 0, rowsPulled: 380, bytesPulled: 41_000 };
const notReady: MirrorSyncResult = { ...verified, ready: false, reason: 'mirror unavailable: connect ECONNREFUSED 127.0.0.1:5433' };

/** A step() stand-in: runs fn, reports whether it "finished in budget". */
const stepThat = (finished: boolean) => vi.fn(async (_name: string, _budget: number, fn: () => Promise<void>) => {
  await fn();
  return finished;
});

function deps(over: Partial<Parameters<typeof runMirrorSyncStep>[0]> = {}) {
  return {
    enabled: true,
    step: stepThat(true),
    sync: vi.fn(async () => verified),
    enableMirrorReads: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    ...over,
  };
}

describe('runMirrorSyncStep', () => {
  it('moves heavy reads to the mirror only when the sync finished and verified it', async () => {
    const d = deps();
    const out = await runMirrorSyncStep(d);
    expect(out.serveReads).toBe(true);
    expect(d.enableMirrorReads).toHaveBeenCalledTimes(1);
    expect(out.status).toEqual({ ready: true, reason: null, bucketsRepaired: 0, bucketsPending: 0, rowsPulled: 380, bytesPulled: 41_000, servedReads: true });
    expect(d.warn).not.toHaveBeenCalled();
  });

  it('keeps reads on Supabase and warns when the mirror is not verified', async () => {
    const d = deps({ sync: vi.fn(async () => notReady) });
    const out = await runMirrorSyncStep(d);
    expect(out.serveReads).toBe(false);
    expect(d.enableMirrorReads).not.toHaveBeenCalled();
    expect(out.status.servedReads).toBe(false);
    expect(d.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('never switches readers when the step ran out of budget, even if the sync later verifies', async () => {
    const d = deps({ step: stepThat(false) });
    const out = await runMirrorSyncStep(d);
    expect(out.serveReads).toBe(false);
    expect(d.enableMirrorReads).not.toHaveBeenCalled();
    expect(out.status.reason).toMatch(/did not finish/);
  });

  it('reports a disabled mirror without running a sync', async () => {
    const d = deps({ enabled: false });
    const out = await runMirrorSyncStep(d);
    expect(out.serveReads).toBe(false);
    expect(d.sync).not.toHaveBeenCalled();
    expect(d.step).not.toHaveBeenCalled();
    expect(out.status.reason).toMatch(/disabled/);
  });
});

describe('degradedHeavyReadAllowed', () => {
  const base = {
    stepName: 'Track engine',
    mirrorReady: false,
    egress24hBytes: () => 20e6,
    budgetBytes: 100e6,
    lastRunAt: vi.fn(async () => new Date('2026-10-07T10:00:00Z') as Date | null),
    now: Date.parse('2026-10-07T11:30:00Z'),
    minIntervalMs: 3_600_000,
    warn: vi.fn(),
    log: vi.fn(),
  };

  it('always runs when the mirror serves reads, without touching Supabase', async () => {
    const lastRunAt = vi.fn(async () => null);
    expect(await degradedHeavyReadAllowed({ ...base, mirrorReady: true, egress24hBytes: () => 999e6, lastRunAt })).toBe(true);
    expect(lastRunAt).not.toHaveBeenCalled();
  });

  it('runs when the last run is older than the interval and the budget lasts', async () => {
    expect(await degradedHeavyReadAllowed(base)).toBe(true);
  });

  it('skips when it ran within the interval', async () => {
    const log = vi.fn();
    expect(await degradedHeavyReadAllowed({ ...base, lastRunAt: async () => new Date('2026-10-07T11:00:00Z'), log })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ran within 60m'));
  });

  it('stops, with a warning, once the 24h egress budget is spent', async () => {
    const warn = vi.fn();
    const lastRunAt = vi.fn(async () => null);
    expect(await degradedHeavyReadAllowed({ ...base, egress24hBytes: () => 100e6, lastRunAt, warn })).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Track engine skipped .* 100\.0 MB/));
    expect(lastRunAt).not.toHaveBeenCalled();
  });

  it('runs when it has never run or the last-run lookup fails', async () => {
    expect(await degradedHeavyReadAllowed({ ...base, lastRunAt: async () => null })).toBe(true);
    expect(await degradedHeavyReadAllowed({ ...base, lastRunAt: async () => { throw new Error('timeout'); } })).toBe(true);
  });
});

describe('attributeEgress', () => {
  it('puts whatever no phase claimed under "other"', () => {
    expect(attributeEgress({ core: 6_000, detectors: 60_000, other: 5 }, 70_000)).toEqual({ core: 6_000, detectors: 60_000, other: 4_000 });
  });

  it('never reports negative "other"', () => {
    expect(attributeEgress({ core: 10 }, 5)).toEqual({ core: 10, other: 0 });
  });
});

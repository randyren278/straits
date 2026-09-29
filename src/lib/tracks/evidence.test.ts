import { describe, expect, it } from 'vitest';
import { scoreEvidence } from './evidence';

const id = { name: true, type: true, flag: true, imoOrDest: true };

describe('scoreEvidence', () => {
  it('scores a regularly reporting, clean, identified ship as well tracked', () => {
    const now = 10_000, fixTimes = Array.from({ length: 144 }, (_, k) => now - 1430 + k * 10);
    const e = scoreEvidence({ fixTimes, now, rejected: 0, moves: 40, identity: id });
    expect(e.score).toBe(100);
    expect(e.tier).toBe(0);
  });

  it('scores a stale, sparse, anonymous ship as sparse', () => {
    const now = 10_000;
    const e = scoreEvidence({ fixTimes: [now - 600, now - 400], now, rejected: 3, moves: 1, identity: { name: false, type: false, flag: false, imoOrDest: false } });
    expect(e.tier).toBe(2);
    expect(e.parts[1]).toBe(0);           // no recency credit after 3 h
  });
});

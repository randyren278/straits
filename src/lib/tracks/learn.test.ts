import { describe, expect, it } from 'vitest';
import { CANDIDATES, CONTEXTS, chooseCandidate, emptyLearnState, medianError, normalizeLearnState, record, truthUpdates, type Candidate } from './learn';

const errs = (best: Candidate) => Object.fromEntries(CANDIDATES.map((c) => [c, c === best ? 1 : 3])) as Record<Candidate, number>;

describe('learning', () => {
  it('starts from measured priors: slow with τ120 on a recent fix, τ30 once silent over an hour', () => {
    const ls = emptyLearnState();
    expect(CONTEXTS).toHaveLength(12);
    expect(chooseCandidate(ls, 0)).toBe('damped:120');
    expect(chooseCandidate(ls, 1)).toBe('damped:30');
  });

  it('switches to the evidence once every candidate has 8 scored predictions', () => {
    const ls = emptyLearnState();
    for (let k = 0; k < 7; k++) record(ls, 2, errs('sea'), 0.03);
    expect(chooseCandidate(ls, 2)).toBe('damped:120');
    record(ls, 2, errs('sea'), 0.03);
    expect(chooseCandidate(ls, 2)).toBe('sea');
  });

  it('discards learning state stored by an older engine version', () => {
    const old = { stats: [{ hybrid: [1], sea: [1], damped: [1] }], tauErr: {}, rateErr: [0.1], lastRunAt: 5 };
    const ls = normalizeLearnState(old);
    expect(ls.stats).toHaveLength(12);
    expect(ls.lastRunAt).toBe(5);
  });

  it('scores against real position changes at midpoint report times', () => {
    const runs = [{ t0: 0, t1: 20, x: 0, y: 0, n: 3 }, { t0: 30, t1: 30, x: 2, y: 0, n: 1 }, { t0: 40, t1: 40, x: 2.05, y: 0, n: 1 }];
    const truth = truthUpdates(runs, 10);
    expect(truth).toEqual([{ t: 25, x: 2, y: 0 }]);
    expect(medianError([{ t: 0, x: 0, y: 0 }, { t: 30, x: 3, y: 0 }], truth)).toBeCloseTo(0.5, 5);
  });
});

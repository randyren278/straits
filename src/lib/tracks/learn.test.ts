import { describe, expect, it } from 'vitest';
import { chooseMethod, chooseTau, emptyLearnState, medianError, record, truthUpdates } from './learn';

describe('learning', () => {
  it('keeps straight-rerouted until every candidate has 8 scored predictions', () => {
    const ls = emptyLearnState();
    for (let k = 0; k < 7; k++) record(ls, 1, { hybrid: 3, sea: 2, damped: 1 }, { 60: 1 }, 0.03);
    expect(chooseMethod(ls, 1)).toBe('hybrid');
    record(ls, 1, { hybrid: 3, sea: 2, damped: 1 }, { 60: 1 }, 0.03);
    expect(chooseMethod(ls, 1)).toBe('damped');
  });

  it('picks the time constant with the lowest recent error', () => {
    const ls = emptyLearnState();
    for (let k = 0; k < 10; k++) record(ls, 0, { hybrid: 1, sea: 1, damped: 1 }, { 30: 3, 60: 1, 120: 2, 240: 4 }, 0.03);
    expect(chooseTau(ls)).toBe(60);
  });

  it('scores against real position changes at midpoint report times', () => {
    const runs = [{ t0: 0, t1: 20, x: 0, y: 0, n: 3 }, { t0: 30, t1: 30, x: 2, y: 0, n: 1 }, { t0: 40, t1: 40, x: 2.05, y: 0, n: 1 }];
    const truth = truthUpdates(runs, 10);
    expect(truth).toEqual([{ t: 25, x: 2, y: 0 }]);           // the 0.05 nm wiggle is jitter, not an update
    expect(medianError([{ t: 0, x: 0, y: 0 }, { t: 30, x: 3, y: 0 }], truth)).toBeCloseTo(0.5, 5);
  });
});

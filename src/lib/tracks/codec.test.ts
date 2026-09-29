import { describe, expect, it } from 'vitest';
import { decodeSeries, encodeSeries } from './codec';

describe('codec', () => {
  it('round-trips a series at 1e-4° and whole minutes', () => {
    const pts: [number, number, number][] = [[29_000_000, 25.1234, 56.5678], [29_000_006, 25.1301, 56.5712]];
    expect(decodeSeries(encodeSeries(pts))).toEqual(pts);
  });
});

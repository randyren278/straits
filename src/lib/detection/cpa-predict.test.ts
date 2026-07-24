/**
 * Tests for the STS CPA predictor.
 *
 * Covers: two converging tracks decelerating into the STS band with a
 * sanctioned party → a predicted rendezvous; two diverging tracks → none;
 * the backtest precision/recall shape; and that the live-alert flag defaults
 * to FALSE (no alert is fired).
 */
import { describe, it, expect } from 'vitest';
import {
  predictPairCpa,
  predictAllPairs,
  backtestAgainstRendezvous,
  STS_PREDICTION_ALERT_ENABLED,
  type VesselTrack,
} from './cpa-predict';

const T0 = new Date('2026-07-24T00:00:00Z');
/** Build a Date offset by `min` minutes from T0. */
function at(min: number): Date {
  return new Date(T0.getTime() + min * 60000);
}

describe('cpa-predict', () => {
  it('predicts a rendezvous for two converging tracks decelerating into the STS band with a sanctioned party', () => {
    // A approaches from the west, slowing; B approaches from the east, slowing.
    // They are ~0.06° apart in longitude (~6 km) at 25°N and closing.
    const a: VesselTrack = {
      imo: '9000001',
      name: 'ALPHA',
      sanctioned: true,
      track: [
        { time: at(-20), lat: 25.0, lon: 55.90, sog: 6 },
        { time: at(-10), lat: 25.0, lon: 55.94, sog: 4 },
        { time: at(0), lat: 25.0, lon: 55.97, sog: 3 },
      ],
    };
    const b: VesselTrack = {
      imo: '9000002',
      name: 'BETA',
      sanctioned: false,
      track: [
        { time: at(-20), lat: 25.0, lon: 56.10, sog: 6 },
        { time: at(-10), lat: 25.0, lon: 56.06, sog: 4 },
        { time: at(0), lat: 25.0, lon: 56.03, sog: 3 },
      ],
    };

    const pred = predictPairCpa(a, b);
    expect(pred).not.toBeNull();
    expect(pred!.cpaDistanceKm).toBeLessThan(2);
    expect(pred!.timeToCpaMinutes).toBeGreaterThanOrEqual(0);
    expect(pred!.timeToCpaMinutes).toBeLessThanOrEqual(60);
    expect(pred!.sanctionedParty).toBe(true);
    expect(pred!.closingSpeedKnots).toBeGreaterThan(0);
  });

  it('does not predict a rendezvous for two diverging tracks', () => {
    const a: VesselTrack = {
      imo: '9000001',
      name: 'ALPHA',
      sanctioned: true,
      track: [
        { time: at(-20), lat: 25.0, lon: 56.00, sog: 3 },
        { time: at(-10), lat: 25.0, lon: 55.96, sog: 3 },
        { time: at(0), lat: 25.0, lon: 55.92, sog: 3 },
      ],
    };
    const b: VesselTrack = {
      imo: '9000002',
      name: 'BETA',
      sanctioned: true,
      track: [
        { time: at(-20), lat: 25.0, lon: 56.02, sog: 3 },
        { time: at(-10), lat: 25.0, lon: 56.06, sog: 3 },
        { time: at(0), lat: 25.0, lon: 56.10, sog: 3 },
      ],
    };

    expect(predictPairCpa(a, b)).toBeNull();
  });

  it('does not predict when neither party is sanctioned', () => {
    const a: VesselTrack = {
      imo: '9000001', name: 'ALPHA', sanctioned: false,
      track: [
        { time: at(-10), lat: 25.0, lon: 55.94, sog: 4 },
        { time: at(0), lat: 25.0, lon: 55.97, sog: 3 },
      ],
    };
    const b: VesselTrack = {
      imo: '9000002', name: 'BETA', sanctioned: false,
      track: [
        { time: at(-10), lat: 25.0, lon: 56.06, sog: 4 },
        { time: at(0), lat: 25.0, lon: 56.03, sog: 3 },
      ],
    };
    expect(predictPairCpa(a, b)).toBeNull();
  });

  it('does not predict when vessels are accelerating (not decelerating into the band)', () => {
    const a: VesselTrack = {
      imo: '9000001', name: 'ALPHA', sanctioned: true,
      track: [
        { time: at(-10), lat: 25.0, lon: 55.94, sog: 8 },
        { time: at(0), lat: 25.0, lon: 55.97, sog: 12 },
      ],
    };
    const b: VesselTrack = {
      imo: '9000002', name: 'BETA', sanctioned: true,
      track: [
        { time: at(-10), lat: 25.0, lon: 56.06, sog: 8 },
        { time: at(0), lat: 25.0, lon: 56.03, sog: 12 },
      ],
    };
    expect(predictPairCpa(a, b)).toBeNull();
  });

  it('the live sts_predicted alert flag defaults to false (no alert fired)', () => {
    expect(STS_PREDICTION_ALERT_ENABLED).toBe(false);
  });

  it('backtests predictions against the rendezvous ledger with precision/recall', () => {
    const a: VesselTrack = {
      imo: '9000001', name: 'ALPHA', sanctioned: true,
      track: [
        { time: at(-20), lat: 25.0, lon: 55.90, sog: 6 },
        { time: at(-10), lat: 25.0, lon: 55.94, sog: 4 },
        { time: at(0), lat: 25.0, lon: 55.97, sog: 3 },
      ],
    };
    const b: VesselTrack = {
      imo: '9000002', name: 'BETA', sanctioned: true,
      track: [
        { time: at(-20), lat: 25.0, lon: 56.10, sog: 6 },
        { time: at(-10), lat: 25.0, lon: 56.06, sog: 4 },
        { time: at(0), lat: 25.0, lon: 56.03, sog: 3 },
      ],
    };

    const predictions = predictAllPairs([a, b]);
    expect(predictions).toHaveLength(1);

    // Ground truth confirms this pair (order-independent) → 1 true positive.
    const score = backtestAgainstRendezvous(predictions, [{ imoA: '9000002', imoB: '9000001' }]);
    expect(score.predicted).toBe(1);
    expect(score.actual).toBe(1);
    expect(score.truePositives).toBe(1);
    expect(score.falsePositives).toBe(0);
    expect(score.falseNegatives).toBe(0);
    expect(score.precision).toBe(1);
    expect(score.recall).toBe(1);

    // A prediction with no matching ground truth → false positive, precision drops.
    const missScore = backtestAgainstRendezvous(predictions, [{ imoA: '8888888', imoB: '7777777' }]);
    expect(missScore.truePositives).toBe(0);
    expect(missScore.falsePositives).toBe(1);
    expect(missScore.falseNegatives).toBe(1);
    expect(missScore.precision).toBe(0);
    expect(missScore.recall).toBe(0);
  });
});

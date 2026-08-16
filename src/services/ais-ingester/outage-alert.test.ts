import { describe, it, expect } from 'vitest';
import { computeSustainedAlert } from './outage-alert';

const THRESHOLD = 3;
const HOUR = 60 * 60 * 1000;
const RENOTIFY_MS = 6 * HOUR;
const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);

const run = (
  failing: boolean,
  prevCount: number,
  prevAlertSent: boolean,
  now: number = T0,
  prevNotifiedAt: number | null = null,
  renotifyIntervalMs: number = RENOTIFY_MS
) => computeSustainedAlert({ failing, prevCount, prevAlertSent, threshold: THRESHOLD, now, prevNotifiedAt, renotifyIntervalMs });

describe('computeSustainedAlert', () => {
  it('counts consecutive failing runs without alerting below the threshold', () => {
    expect(run(true, 0, false)).toEqual({ count: 1, alertSent: false, shouldNotify: false, notifiedAt: null });
    expect(run(true, 1, false)).toEqual({ count: 2, alertSent: false, shouldNotify: false, notifiedAt: null });
  });

  it('notifies on the run that reaches the threshold', () => {
    expect(run(true, 2, false, T0)).toEqual({ count: 3, alertSent: true, shouldNotify: true, notifiedAt: T0 });
  });

  it('stays silent for further runs of the same incident before the re-notify interval elapses', () => {
    // The 30+ hour August outage would otherwise have fired ~180 notifications
    // at a ~10-minute cadence.
    const firstNotify = T0;
    expect(run(true, 3, true, T0 + 10 * 60_000, firstNotify)).toEqual({
      count: 4, alertSent: true, shouldNotify: false, notifiedAt: firstNotify,
    });
    expect(run(true, 99, true, T0 + 5 * HOUR, firstNotify)).toEqual({
      count: 100, alertSent: true, shouldNotify: false, notifiedAt: firstNotify,
    });
  });

  it('re-notifies once the re-notify interval has elapsed since the last notification', () => {
    const firstNotify = T0;
    const dueAt = T0 + RENOTIFY_MS;
    expect(run(true, 40, true, dueAt, firstNotify)).toEqual({
      count: 41, alertSent: true, shouldNotify: true, notifiedAt: dueAt,
    });
    // and stays silent again until the NEXT interval boundary
    expect(run(true, 41, true, dueAt + 10 * 60_000, dueAt)).toEqual({
      count: 42, alertSent: true, shouldNotify: false, notifiedAt: dueAt,
    });
  });

  it('resets the streak when the run succeeds', () => {
    expect(run(false, 42, true, T0, T0 - HOUR)).toEqual({ count: 0, alertSent: false, shouldNotify: false, notifiedAt: null });
  });

  it('re-arms so a later incident notifies again from the threshold', () => {
    const recovered = run(false, 5, true, T0, T0 - HOUR);
    const next = run(true, recovered.count, recovered.alertSent, T0 + 10 * 60_000, recovered.notifiedAt);
    expect(next).toEqual({ count: 1, alertSent: false, shouldNotify: false, notifiedAt: null });
  });

  it('notifies at threshold, heartbeats at the interval, and stays quiet the rest of a full incident-and-recovery cycle', () => {
    // Drive 8 failing runs 10 minutes apart (threshold=3, renotify=6h — never
    // reached within 8*10min so exactly one notification), then a recovery,
    // then 4 more failing runs — the operator should be interrupted twice.
    let state: { count: number; alertSent: boolean; notifiedAt: number | null } = { count: 0, alertSent: false, notifiedAt: null };
    let now = T0;
    let notifications = 0;
    const runs = [...Array(8).fill(true), false, ...Array(4).fill(true)];

    for (const failing of runs) {
      const result = run(failing, state.count, state.alertSent, now, state.notifiedAt);
      if (result.shouldNotify) notifications++;
      state = { count: result.count, alertSent: result.alertSent, notifiedAt: result.notifiedAt };
      now += 10 * 60_000;
    }

    expect(notifications).toBe(2);
  });

  it('honours a threshold of 1 by notifying on the first failing run', () => {
    expect(computeSustainedAlert({
      failing: true, prevCount: 0, prevAlertSent: false, threshold: 1,
      now: T0, prevNotifiedAt: null, renotifyIntervalMs: RENOTIFY_MS,
    })).toEqual({ count: 1, alertSent: true, shouldNotify: true, notifiedAt: T0 });
  });
});

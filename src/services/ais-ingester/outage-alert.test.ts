import { describe, it, expect } from 'vitest';
import { computeOutageAlert } from './outage-alert';

const THRESHOLD = 3;
const run = (emptyWindow: boolean, prevCount: number, prevAlertSent: boolean) =>
  computeOutageAlert({ emptyWindow, prevCount, prevAlertSent, threshold: THRESHOLD });

describe('computeOutageAlert', () => {
  it('counts consecutive empty windows without alerting below the threshold', () => {
    expect(run(true, 0, false)).toEqual({ count: 1, alertSent: false, shouldNotify: false });
    expect(run(true, 1, false)).toEqual({ count: 2, alertSent: false, shouldNotify: false });
  });

  it('notifies on the window that reaches the threshold', () => {
    expect(run(true, 2, false)).toEqual({ count: 3, alertSent: true, shouldNotify: true });
  });

  it('stays silent for every further window of the same outage', () => {
    // The 30+ hour August outage would otherwise have fired ~180 notifications.
    expect(run(true, 3, true)).toEqual({ count: 4, alertSent: true, shouldNotify: false });
    expect(run(true, 99, true)).toEqual({ count: 100, alertSent: true, shouldNotify: false });
  });

  it('resets the streak when positions come back', () => {
    expect(run(false, 42, true)).toEqual({ count: 0, alertSent: false, shouldNotify: false });
  });

  it('re-arms so a later outage alerts again', () => {
    const recovered = run(false, 5, true);
    const next = run(true, recovered.count, recovered.alertSent);
    expect(next).toEqual({ count: 1, alertSent: false, shouldNotify: false });
  });

  it('notifies exactly once across a full outage-and-recovery cycle', () => {
    // Drive 8 empty windows, then a recovery, then 4 more empty windows —
    // the operator should be interrupted twice, not twelve times.
    let state = { count: 0, alertSent: false };
    let notifications = 0;
    const windows = [...Array(8).fill(true), false, ...Array(4).fill(true)];

    for (const emptyWindow of windows) {
      const result = run(emptyWindow, state.count, state.alertSent);
      if (result.shouldNotify) notifications++;
      state = { count: result.count, alertSent: result.alertSent };
    }

    expect(notifications).toBe(2);
  });

  it('honours a threshold of 1 by alerting on the first empty window', () => {
    expect(computeOutageAlert({ emptyWindow: true, prevCount: 0, prevAlertSent: false, threshold: 1 }))
      .toEqual({ count: 1, alertSent: true, shouldNotify: true });
  });
});

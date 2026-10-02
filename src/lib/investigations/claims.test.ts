import { describe, expect, it } from 'vitest';
import { evaluateClaim, parseClaim, type ActivityWindow, type PassageWindow } from './claims';

const activity: ActivityWindow = {
  contacts: 14, fixes: 220, latestFix: '2026-10-01T12:00:00.000Z',
  startsAt: '2026-09-30T12:00:00.000Z', endsAt: '2026-10-01T12:00:00.000Z', label: 'last 24 hours',
  observedDays: null, expectedDays: null,
};
const passage: PassageWindow = {
  completed: 28, incomplete: 2, waiting: 1, daysWithData: 7, daysExpected: 7,
  latestComputedAt: '2026-10-01T12:00:00.000Z', label: 'last 7 complete UTC days',
  startsAt: '2026-09-24', endsAt: '2026-10-01',
};

describe('investigation claims', () => {
  it('recognizes only the curated Hormuz and Suez prompts', () => {
    expect(parseClaim('Hormuz traffic stopped').id).toBe('hormuz-stopped');
    expect(parseClaim('Suez disruption').id).toBe('suez-disruption');
    expect(parseClaim('Are vessels being observed?').id).toBe('regional-activity');
    expect(parseClaim('Why did traffic stop?').supported).toBe(false);
  });

  it('keeps observed contacts from refuting a closure claim because they may be anchored', () => {
    const claim = parseClaim('Hormuz traffic stopped');
    const result = evaluateClaim(claim, activity, activity, 'recent');
    expect(result.status).toBe('insufficient');
    expect(result.headline).toContain('passage status is unverified');
    expect(result.basis).toContain('anchored');
  });

  it('keeps a zero-contact sample from becoming a closure verdict', () => {
    const empty = { ...activity, contacts: 0, fixes: 0 };
    const result = evaluateClaim(parseClaim('Hormuz traffic stopped'), empty, activity, 'recent');
    expect(result.status).toBe('insufficient');
    expect(result.headline).toContain('closure status is unverified');
  });

  it('reports regional observation presence without claiming a passage', () => {
    const result = evaluateClaim(parseClaim('Are vessels being observed?'), activity, activity, 'recent');
    expect(result.status).toBe('activity_observed');
    expect(result.observedQuantity).toContain('14 distinct vessel contacts');
    expect(result.basis).toContain('does not count completed passages');
  });

  it('requires every Suez day, nonzero baseline, and historical collection evidence before comparing counts', () => {
    const claim = parseClaim('Suez disruption');
    const sparse = { ...passage, daysWithData: 6 };
    const result = evaluateClaim(claim, activity, activity, 'recent', { current: sparse, previous: passage }, { currentDays: 7, previousDays: 7, expectedDays: 7 });
    expect(result.status).toBe('insufficient');
    expect(result.observedQuantity).toContain('28 completed passages');
  });

  it('does not compute a relative Suez reduction from a zero baseline', () => {
    const claim = parseClaim('Suez disruption');
    const zeroBaseline = { ...passage, completed: 0 };
    const result = evaluateClaim(claim, activity, activity, 'recent', { current: passage, previous: zeroBaseline }, { currentDays: 7, previousDays: 7, expectedDays: 7 });
    expect(result.status).toBe('insufficient');
  });

  it('reports a measured reduction without calling it a confirmed disruption', () => {
    const claim = parseClaim('Suez disruption');
    const reduced = { ...passage, completed: 14 };
    const result = evaluateClaim(claim, activity, activity, 'recent', { current: reduced, previous: passage }, { currentDays: 7, previousDays: 7, expectedDays: 7 });
    expect(result.status).toBe('reduction_observed');
    expect(result.observedQuantity).toContain('down 50%');
    expect(result.headline).not.toContain('confirmed');
  });

  it('labels a measured decrease below the signal threshold instead of implying no change', () => {
    const claim = parseClaim('Suez disruption');
    const slightlyReduced = { ...passage, completed: 20 };
    const result = evaluateClaim(claim, activity, activity, 'recent', { current: slightlyReduced, previous: passage }, { currentDays: 7, previousDays: 7, expectedDays: 7 });
    expect(result.status).toBe('no_clear_reduction');
    expect(result.headline).toContain('below the 40% signal threshold');
    expect(result.observedQuantity).toContain('8 fewer, 29% reduction');
  });
});

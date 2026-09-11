import { describe, it, expect, beforeEach } from 'vitest';
import { countSince, rememberVisit } from './useSinceLastVisit';

describe('countSince', () => {
  it('counts only events after the previous visit, and those on watched hulls', () => {
    const since = new Date('2026-09-10T00:00:00Z');
    const r = countSince([
      { imo: '1', detectedAt: '2026-09-09T23:00:00Z' },
      { imo: '2', detectedAt: '2026-09-10T01:00:00Z' },
      { imo: '3', detectedAt: '2026-09-11T01:00:00Z' },
      { imo: '4', detectedAt: 'garbage' },
    ], since, new Set(['3']));
    expect(r).toEqual({ newEvents: 2, onWatched: 1 });
  });
});

describe('rememberVisit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('returns null on the first ever visit and stamps it', () => {
    expect(rememberVisit(new Date('2026-09-11T10:00:00Z'))).toBeNull();
    expect(window.localStorage.getItem('straits:lastVisit')).toBe('2026-09-11T10:00:00.000Z');
    // React Strict Mode may remount effects in the same session. That must not
    // turn the timestamp just written above into a fictional previous visit.
    expect(rememberVisit(new Date('2026-09-11T10:01:00Z'))).toBeNull();
  });

  it('returns the previous visit on the next session and does not advance within a session', () => {
    rememberVisit(new Date('2026-09-10T10:00:00Z'));
    window.sessionStorage.clear(); // new session
    expect(rememberVisit(new Date('2026-09-11T10:00:00Z'))?.toISOString()).toBe('2026-09-10T10:00:00.000Z');
    // same session, re-mount
    rememberVisit(new Date('2026-09-11T12:00:00Z'));
    expect(window.localStorage.getItem('straits:lastVisit')).toBe('2026-09-11T10:00:00.000Z');
  });
});

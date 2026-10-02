import { describe, expect, it } from 'vitest';
import {
  compareFollowBaseline,
  getFollowBaseline,
  followKey,
  parseFollowList,
  parseStoryRequest,
  StoryRequestError,
} from './story-model';
import type { InvestigationStorySnapshot } from './story-model';

const snapshot = (overrides: Partial<InvestigationStorySnapshot> = {}): InvestigationStorySnapshot => ({
  version: 1,
  region: 'hormuz',
  window: '24h',
  claim: { id: 'hormuz-stopped', text: 'Hormuz traffic stopped', normalized: 'Hormuz traffic stopped', description: 'Bounded check.' },
  annotation: '',
  evaluation: { status: 'activity_observed', headline: 'Activity observed', basis: 'Vessels observed.', observedQuantity: '20 contacts.' },
  evidence: {
    generatedAt: '2026-10-01T12:00:00.000Z', region: 'hormuz', window: '24h',
    activity: {
      current: { contacts: 20, fixes: 120, latestFix: null, startsAt: '', endsAt: '', label: 'last 24 hours', observedDays: null, expectedDays: null },
      previous: { contacts: 18, fixes: 100, latestFix: null, startsAt: '', endsAt: '', label: 'previous 24 hours', observedDays: null, expectedDays: null },
    },
    coverage: { quality: 'recent', latestFix: null, latestFixAgeMinutes: 0, nonEmptyHoursOfSix: 6, historicalDays: null },
    cohorts: [], vessels: [], passages: null, context: null, limitations: [],
  },
  sources: [],
  ...overrides,
});

describe('investigation story requests and revisit comparisons', () => {
  it('accepts bounded question input only and normalizes the supported claim', () => {
    expect(parseStoryRequest({ region: 'hormuz', window: '24h', claim: ' Hormuz   traffic stopped ', annotation: 'Watch changes' })).toEqual({
      region: 'hormuz', window: '24h', claimText: 'Hormuz traffic stopped', annotation: 'Watch changes',
    });
  });

  it('rejects client-supplied evidence and unsupported region/claim combinations', () => {
    expect(() => parseStoryRequest({ region: 'hormuz', window: '24h', claim: 'Hormuz traffic stopped', snapshot: {} })).toThrow(StoryRequestError);
    expect(() => parseStoryRequest({ region: 'suez', window: '24h', claim: 'Hormuz traffic stopped' })).toThrow(StoryRequestError);
  });

  it('enforces the annotation storage bound', () => {
    expect(() => parseStoryRequest({ region: 'hormuz', window: '24h', claim: 'Hormuz traffic stopped', annotation: 'x'.repeat(501) })).toThrow(/500 characters/);
    expect(parseStoryRequest({ region: 'hormuz', window: '24h', claim: 'Hormuz traffic stopped', annotation: 'x'.repeat(500) }).annotation).toHaveLength(500);
  });

  it('saves a baseline and flags material verdict, coverage, or count changes', () => {
    const baseline = getFollowBaseline(snapshot());
    const unchanged = compareFollowBaseline(baseline, snapshot({
      evidence: { ...snapshot().evidence, activity: { ...snapshot().evidence.activity, current: { ...snapshot().evidence.activity.current, contacts: 24 } } },
    }));
    const changed = compareFollowBaseline(baseline, snapshot({
      evaluation: { ...snapshot().evaluation, status: 'insufficient' },
      evidence: { ...snapshot().evidence, coverage: { ...snapshot().evidence.coverage, quality: 'intermittent' }, activity: { ...snapshot().evidence.activity, current: { ...snapshot().evidence.activity.current, contacts: 28 } } },
    }));
    expect(unchanged.material).toBe(false);
    expect(changed.material).toBe(true);
    expect(changed.reasons).toHaveLength(3);
  });

  it('loads only bounded, structurally valid local follow entries', () => {
    const entry = {
      key: followKey('hormuz', '24h', 'Hormuz traffic stopped'),
      region: 'hormuz' as const,
      window: '24h' as const,
      claimText: 'Hormuz traffic stopped',
      baseline: getFollowBaseline(snapshot()),
      savedAt: '2026-10-01T12:00:00.000Z',
    };
    expect(parseFollowList(JSON.stringify([entry, { ...entry, key: 'invalid' }]))).toEqual([entry]);
    expect(parseFollowList('not json')).toEqual([]);
    const many = Array.from({ length: 55 }, (_, index) => {
      const claimText = `Question ${index}`;
      return { ...entry, key: followKey('hormuz', '24h', claimText), claimText };
    });
    expect(parseFollowList(JSON.stringify(many))).toHaveLength(50);
  });
});

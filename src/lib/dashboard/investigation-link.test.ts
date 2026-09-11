import { describe, it, expect } from 'vitest';
import { parseInvestigation, serializeInvestigation } from './investigation-link';

describe('investigation links', () => {
  it('round-trips vessel, chokepoint, view and filters', () => {
    const state = { vessel: '9000001', chokepoint: 'hormuz', view: { lat: 25.1234, lon: 56.5678, zoom: 9 }, tankersOnly: true, anomaliesOnly: true };
    const qs = serializeInvestigation(state);
    expect(qs).toBe('?vessel=9000001&cp=hormuz&lat=25.1234&lon=56.5678&z=9.0&tankers=1&anomalies=1');
    expect(parseInvestigation(qs)).toEqual(state);
  });

  it('drops malformed values instead of trusting the URL', () => {
    expect(parseInvestigation('?vessel=abc&cp=atlantis&lat=999&lon=10&z=5')).toEqual({});
  });

  it('serialises nothing for an empty investigation', () => {
    expect(serializeInvestigation({})).toBe('');
  });
});

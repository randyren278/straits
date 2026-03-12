import { describe, it, expect } from 'vitest';
import { classifyRoute, REGION_KEYWORDS } from './routes';

describe('classifyRoute', () => {
  it('classifies China as east_asia', () => {
    expect(classifyRoute('CHINA')).toBe('east_asia');
  });

  it('classifies ROTTERDAM as europe', () => {
    expect(classifyRoute('ROTTERDAM')).toBe('europe');
  });

  it('classifies HOUSTON as americas', () => {
    expect(classifyRoute('HOUSTON')).toBe('americas');
  });

  it('returns unknown for null destination', () => {
    expect(classifyRoute(null)).toBe('unknown');
  });

  it('returns unknown for unmatched destination', () => {
    expect(classifyRoute('RANDOM PORT XYZ')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(classifyRoute('china')).toBe('east_asia');
    expect(classifyRoute('Rotterdam')).toBe('europe');
  });

  it('matches substrings', () => {
    expect(classifyRoute('PORT OF SINGAPORE')).toBe('east_asia');
    expect(classifyRoute('HOUSTON TX')).toBe('americas');
  });
});

describe('REGION_KEYWORDS', () => {
  it('has keywords for all regions except unknown', () => {
    expect(REGION_KEYWORDS.east_asia.length).toBeGreaterThan(0);
    expect(REGION_KEYWORDS.europe.length).toBeGreaterThan(0);
    expect(REGION_KEYWORDS.americas.length).toBeGreaterThan(0);
    expect(REGION_KEYWORDS.unknown).toEqual([]);
  });
});

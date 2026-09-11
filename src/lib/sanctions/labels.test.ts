import { describe, it, expect } from 'vitest';
import { riskCategoryLabel, authorityLabel } from './labels';

describe('riskCategoryLabel', () => {
  it('translates dataset codes into readable labels', () => {
    expect(riskCategoryLabel('mare.shadow;poi').label).toBe('Shadow fleet');
    expect(riskCategoryLabel('sanction').label).toBe('Sanctioned');
    expect(riskCategoryLabel('mare.detained;reg.warn').label).toBe('Detained · reg. warning');
  });

  it('never returns a raw code with semicolons for a known category', () => {
    for (const code of ['sanction', 'mare.shadow;poi', 'mare.detained', 'mare.detained;reg.warn', 'poi', 'reg.warn']) {
      expect(riskCategoryLabel(code).label).not.toMatch(/[;]/);
    }
  });

  it('falls back to "Listed" for empty and to a spaced form for unknown codes', () => {
    expect(riskCategoryLabel(null).label).toBe('Listed');
    expect(riskCategoryLabel('').label).toBe('Listed');
    expect(riskCategoryLabel('mare.new;thing').label).toBe('mare · new · thing');
  });
});

describe('authorityLabel', () => {
  it('maps known datasets and humanises unknown ones', () => {
    expect(authorityLabel('us_ofac_sdn')).toBe('OFAC SDN');
    expect(authorityLabel('xx_some_list')).toBe('xx some list');
  });
});

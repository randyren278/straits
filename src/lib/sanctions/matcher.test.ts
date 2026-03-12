import { describe, it, expect } from 'vitest';

describe('Sanctions Matcher', () => {
  describe('normalizeIMO', () => {
    it.todo('removes IMO prefix from IMO number');
    it.todo('pads IMO to 7 digits with leading zeros');
    it.todo('handles null/undefined input');
  });

  describe('matchVesselSanctions', () => {
    it.todo('returns sanction data when IMO matches OFAC list');
    it.todo('returns sanction data when IMO matches EU list');
    it.todo('returns null when IMO not found in any list');
    it.todo('returns highest confidence match when multiple sources');
  });
});

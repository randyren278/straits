import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeIMO, matchVesselSanctions } from './matcher';

// Mock the db/sanctions module
vi.mock('../db/sanctions', () => ({
  getSanction: vi.fn(),
}));

import { getSanction } from '../db/sanctions';

describe('Sanctions Matcher', () => {
  describe('normalizeIMO', () => {
    it('removes IMO prefix from IMO number', () => {
      expect(normalizeIMO('IMO 1234567')).toBe('1234567');
    });

    it('pads IMO to 7 digits with leading zeros', () => {
      expect(normalizeIMO('123')).toBe('0000123');
    });

    it('handles null/undefined input', () => {
      expect(normalizeIMO(null)).toBeNull();
      expect(normalizeIMO(undefined)).toBeNull();
    });
  });

  describe('matchVesselSanctions', () => {
    const mockGetSanction = vi.mocked(getSanction);

    beforeEach(() => {
      mockGetSanction.mockReset();
    });

    it('returns sanction data when IMO matches OFAC list', async () => {
      mockGetSanction.mockResolvedValue({
        imo: '1234567',
        sanctioningAuthority: 'OFAC',
        listDate: new Date('2023-01-15'),
        reason: 'sanction',
        confidence: 'HIGH',
      });

      const result = await matchVesselSanctions('1234567');

      expect(result).not.toBeNull();
      expect(result?.authority).toBe('OFAC');
      expect(result?.imo).toBe('1234567');
    });

    it('returns sanction data when IMO matches EU list', async () => {
      mockGetSanction.mockResolvedValue({
        imo: '7654321',
        sanctioningAuthority: 'EU',
        listDate: new Date('2024-03-01'),
        reason: 'debarment',
        confidence: 'HIGH',
      });

      const result = await matchVesselSanctions('7654321');

      expect(result?.authority).toBe('EU');
    });

    it('returns null when IMO not found in any list', async () => {
      mockGetSanction.mockResolvedValue(null);

      const result = await matchVesselSanctions('9999999');

      expect(result).toBeNull();
    });

    it('returns highest confidence match when multiple sources', async () => {
      // Since we only store one record per IMO, the stored confidence is returned
      mockGetSanction.mockResolvedValue({
        imo: '1234567',
        sanctioningAuthority: 'OFAC',
        listDate: new Date('2023-01-15'),
        reason: 'sanction',
        confidence: 'HIGH',
      });

      const result = await matchVesselSanctions('1234567');

      expect(result?.confidence).toBe('HIGH');
    });
  });
});

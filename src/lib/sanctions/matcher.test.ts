/**
 * Tests for Sanctions Matcher.
 * M005-S01: Updated for enriched sanction records.
 */
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

    it('returns enriched sanction data when IMO matches', async () => {
      mockGetSanction.mockResolvedValue({
        imo: '1234567',
        sanctioningAuthority: 'OFAC',
        listDate: null,
        reason: 'sanction',
        confidence: 'HIGH',
        riskCategory: 'sanction',
        datasets: ['us_ofac_sdn', 'us_trade_csl'],
        flag: 'ir',
        mmsi: '572469210',
        aliases: ['ALPHA', 'ARTAVIL'],
        opensanctionsUrl: 'https://www.opensanctions.org/entities/ofac-15036',
        vesselType: 'VESSEL',
      });

      const result = await matchVesselSanctions('1234567');

      expect(result).not.toBeNull();
      expect(result?.authority).toBe('OFAC');
      expect(result?.imo).toBe('1234567');
      expect(result?.riskCategory).toBe('sanction');
      expect(result?.datasets).toEqual(['us_ofac_sdn', 'us_trade_csl']);
      expect(result?.aliases).toEqual(['ALPHA', 'ARTAVIL']);
      expect(result?.opensanctionsUrl).toBe('https://www.opensanctions.org/entities/ofac-15036');
      expect(result?.flag).toBe('ir');
    });

    it('returns null when IMO not found in any list', async () => {
      mockGetSanction.mockResolvedValue(null);

      const result = await matchVesselSanctions('9999999');
      expect(result).toBeNull();
    });

    it('returns highest confidence match when stored', async () => {
      mockGetSanction.mockResolvedValue({
        imo: '1234567',
        sanctioningAuthority: 'EU',
        listDate: null,
        reason: 'sanction',
        confidence: 'HIGH',
        riskCategory: 'sanction',
        datasets: ['eu_fsf'],
        flag: 'ir',
        mmsi: null,
        aliases: null,
        opensanctionsUrl: null,
        vesselType: 'VESSEL',
      });

      const result = await matchVesselSanctions('1234567');
      expect(result?.confidence).toBe('HIGH');
      expect(result?.authority).toBe('EU');
    });
  });
});

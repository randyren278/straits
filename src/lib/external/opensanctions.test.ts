/**
 * Tests for OpenSanctions CSV fetcher and parser.
 * INTL-01: Sanctions matching
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeIMO, parseSanctionsCSV, fetchSanctionsList } from './opensanctions';

describe('OpenSanctions', () => {
  describe('normalizeIMO', () => {
    it('removes IMO prefix and returns 7-digit number', () => {
      expect(normalizeIMO('IMO 1234567')).toBe('1234567');
    });

    it('removes lowercase imo prefix', () => {
      expect(normalizeIMO('imo1234567')).toBe('1234567');
    });

    it('handles IMO with extra spaces', () => {
      expect(normalizeIMO('IMO   1234567')).toBe('1234567');
    });

    it('pads short IMO numbers to 7 digits', () => {
      expect(normalizeIMO('123')).toBe('0000123');
    });

    it('pads 6-digit IMO to 7 digits', () => {
      expect(normalizeIMO('123456')).toBe('0123456');
    });

    it('returns null for null input', () => {
      expect(normalizeIMO(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeIMO(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeIMO('')).toBeNull();
    });

    it('returns null for non-numeric input after prefix removal', () => {
      expect(normalizeIMO('IMO ABC123')).toBeNull();
    });

    it('returns null for whitespace-only input', () => {
      expect(normalizeIMO('   ')).toBeNull();
    });
  });

  describe('parseSanctionsCSV', () => {
    const sampleCSV = `id,name,datasets,first_seen,imo_number,topics,source_url
q-123,TANKER VESSEL,us_ofac_sdn,2023-01-15,1234567,sanction,https://ofac.gov
q-456,CARGO SHIP,eu_fsf,2023-06-20,IMO 7654321,debarment,https://europa.eu
q-789,UNKNOWN ENTITY,un_sc,,,,
q-012,BAD VESSEL,us_ofac_sdn,2024-03-01,123,crime,https://ofac.gov`;

    it('parses CSV rows into SanctionEntry objects', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      expect(entries.length).toBe(3); // Only entries with valid IMO
    });

    it('normalizes IMO numbers in parsed entries', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const tanker = entries.find(e => e.name === 'TANKER VESSEL');
      expect(tanker?.imo).toBe('1234567');
    });

    it('normalizes IMO with prefix', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const cargo = entries.find(e => e.name === 'CARGO SHIP');
      expect(cargo?.imo).toBe('7654321');
    });

    it('pads short IMO numbers', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const bad = entries.find(e => e.name === 'BAD VESSEL');
      expect(bad?.imo).toBe('0000123');
    });

    it('maps OFAC dataset to OFAC authority', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const tanker = entries.find(e => e.name === 'TANKER VESSEL');
      expect(tanker?.authority).toBe('OFAC');
    });

    it('maps EU dataset to EU authority', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const cargo = entries.find(e => e.name === 'CARGO SHIP');
      expect(cargo?.authority).toBe('EU');
    });

    it('parses first_seen as Date', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const tanker = entries.find(e => e.name === 'TANKER VESSEL');
      expect(tanker?.listDate).toEqual(new Date('2023-01-15'));
    });

    it('returns null for missing first_seen', () => {
      const csvWithoutDate = `id,name,datasets,first_seen,imo_number,topics,source_url
q-123,NO DATE VESSEL,us_ofac_sdn,,9999999,sanction,https://ofac.gov`;
      const entries = parseSanctionsCSV(csvWithoutDate);
      expect(entries[0].listDate).toBeNull();
    });

    it('filters out entries without IMO numbers', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const unknown = entries.find(e => e.name === 'UNKNOWN ENTITY');
      expect(unknown).toBeUndefined();
    });

    it('extracts reason from topics field', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const tanker = entries.find(e => e.name === 'TANKER VESSEL');
      expect(tanker?.reason).toBe('sanction');
    });

    it('extracts sourceUrl field', () => {
      const entries = parseSanctionsCSV(sampleCSV);
      const tanker = entries.find(e => e.name === 'TANKER VESSEL');
      expect(tanker?.sourceUrl).toBe('https://ofac.gov');
    });
  });

  describe('fetchSanctionsList', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetches from OpenSanctions URL', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`id,name,datasets,first_seen,imo_number,topics,source_url
q-123,TEST VESSEL,us_ofac_sdn,2023-01-15,1234567,sanction,https://ofac.gov`),
      } as Response);

      await fetchSanctionsList();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://data.opensanctions.org/datasets/latest/default/targets.simple.csv'
      );
    });

    it('returns parsed SanctionEntry array', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`id,name,datasets,first_seen,imo_number,topics,source_url
q-123,TEST VESSEL,us_ofac_sdn,2023-01-15,1234567,sanction,https://ofac.gov`),
      } as Response);

      const entries = await fetchSanctionsList();

      expect(entries).toHaveLength(1);
      expect(entries[0].imo).toBe('1234567');
      expect(entries[0].authority).toBe('OFAC');
    });

    it('throws error on non-OK response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchSanctionsList()).rejects.toThrow('Failed to fetch sanctions: 404');
    });

    it('throws error on network failure', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchSanctionsList()).rejects.toThrow('Network error');
    });
  });
});

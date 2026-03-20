/**
 * Tests for OpenSanctions maritime CSV fetcher and parser.
 * M005-S01: Updated for maritime-specific CSV format.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeIMO, parseMaritimeCSV, parseSanctionsCSV, fetchSanctionsList } from './opensanctions';

describe('OpenSanctions Maritime', () => {
  describe('normalizeIMO', () => {
    it('removes IMO prefix and returns 7-digit number', () => {
      expect(normalizeIMO('IMO 1234567')).toBe('1234567');
    });

    it('removes IMO prefix without space', () => {
      expect(normalizeIMO('IMO9187629')).toBe('9187629');
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

  describe('parseMaritimeCSV', () => {
    const sampleCSV = `"type","caption","imo","risk","countries","flag","mmsi","id","url","datasets","aliases"
"VESSEL","ABADAN","IMO9187629","sanction","ir;mt;tv;tz","ir","572469210","ofac-15036","https://www.opensanctions.org/entities/ofac-15036","us_ofac_sdn;us_trade_csl","ALPHA;ARTAVIL;SHONA"
"VESSEL","ARK III","IMO9187655","sanction","ir","ir","","ofac-15037","https://www.opensanctions.org/entities/ofac-15037","us_ofac_sdn;us_trade_csl","ABADEH;Ark;CRYSTAL;SUNDIAL"
"VESSEL","BOUDREAUX TIDE","IMO9427366","mare.detained","vu","vu","","abuja-mou-det-123","https://www.opensanctions.org/entities/abuja-mou-det-123","abuja_mou_detention",""
"VESSEL","DMITRY POKROVSKY","IMO9683726","mare.shadow;poi","ru","ru","273332580","ua-ws-vessel-1003","https://www.opensanctions.org/entities/ua-ws-vessel-1003","ua_war_sanctions",""
"ORGANIZATION","SOME COMPANY","IMO6495856","poi","cn;hk","","","org-123","https://www.opensanctions.org/entities/org-123","us_ofac_sdn",""
"VESSEL","NO IMO VESSEL","","sanction","ir","ir","","ofac-99999","https://www.opensanctions.org/entities/ofac-99999","us_ofac_sdn",""`;

    it('parses maritime CSV rows into SanctionEntry objects', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      // 5 with valid IMO (one vessel has no IMO)
      expect(entries.length).toBe(5);
    });

    it('normalizes IMO numbers with prefix', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.imo).toBe('9187629');
    });

    it('extracts vessel type', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.vesselType).toBe('VESSEL');
      const org = entries.find(e => e.name === 'SOME COMPANY');
      expect(org?.vesselType).toBe('ORGANIZATION');
    });

    it('extracts risk category', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.riskCategory).toBe('sanction');
      const detained = entries.find(e => e.name === 'BOUDREAUX TIDE');
      expect(detained?.riskCategory).toBe('mare.detained');
      const shadow = entries.find(e => e.name === 'DMITRY POKROVSKY');
      expect(shadow?.riskCategory).toBe('mare.shadow;poi');
    });

    it('parses datasets into array', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.datasets).toEqual(['us_ofac_sdn', 'us_trade_csl']);
    });

    it('extracts flag state', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.flag).toBe('ir');
    });

    it('extracts MMSI when available', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.mmsi).toBe('572469210');
      const ark = entries.find(e => e.name === 'ARK III');
      expect(ark?.mmsi).toBe('');
    });

    it('parses aliases into array', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.aliases).toEqual(['ALPHA', 'ARTAVIL', 'SHONA']);
    });

    it('handles empty aliases', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const detained = entries.find(e => e.name === 'BOUDREAUX TIDE');
      expect(detained?.aliases).toEqual([]);
    });

    it('extracts OpenSanctions URL', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.opensanctionsUrl).toBe('https://www.opensanctions.org/entities/ofac-15036');
    });

    it('parses countries into array', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.countries).toEqual(['ir', 'mt', 'tv', 'tz']);
    });

    it('derives OFAC authority from datasets', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.authority).toBe('OFAC');
    });

    it('derives UA authority from war sanctions dataset', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const shadow = entries.find(e => e.name === 'DMITRY POKROVSKY');
      expect(shadow?.authority).toBe('UA');
    });

    it('derives PSC authority from MoU detention dataset', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const detained = entries.find(e => e.name === 'BOUDREAUX TIDE');
      expect(detained?.authority).toBe('PSC');
    });

    it('filters out entries without IMO numbers', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const noImo = entries.find(e => e.name === 'NO IMO VESSEL');
      expect(noImo).toBeUndefined();
    });

    it('sets listDate to null (not available in maritime CSV)', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      expect(entries[0].listDate).toBeNull();
    });

    it('uses risk category as reason for backward compatibility', () => {
      const entries = parseMaritimeCSV(sampleCSV);
      const abadan = entries.find(e => e.name === 'ABADAN');
      expect(abadan?.reason).toBe('sanction');
    });

    it('throws on missing required columns', () => {
      const badCSV = `"id","name","wrong_column"\n"1","test","value"`;
      expect(() => parseMaritimeCSV(badCSV)).toThrow('Maritime CSV schema mismatch');
    });

    it('parseSanctionsCSV is backward-compatible alias', () => {
      expect(parseSanctionsCSV).toBe(parseMaritimeCSV);
    });
  });

  describe('fetchSanctionsList', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetches from maritime CSV URL', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`"type","caption","imo","risk","countries","flag","mmsi","id","url","datasets","aliases"
"VESSEL","TEST","IMO1234567","sanction","us","us","","test-1","https://opensanctions.org/test","us_ofac_sdn",""`)
      } as Response);

      await fetchSanctionsList();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://data.opensanctions.org/datasets/latest/maritime/maritime.csv'
      );
    });

    it('returns parsed SanctionEntry array', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`"type","caption","imo","risk","countries","flag","mmsi","id","url","datasets","aliases"
"VESSEL","TEST VESSEL","IMO1234567","sanction","us","us","123456789","test-1","https://opensanctions.org/test","us_ofac_sdn;us_trade_csl","ALIAS1;ALIAS2"`)
      } as Response);

      const entries = await fetchSanctionsList();

      expect(entries).toHaveLength(1);
      expect(entries[0].imo).toBe('1234567');
      expect(entries[0].authority).toBe('OFAC');
      expect(entries[0].riskCategory).toBe('sanction');
      expect(entries[0].datasets).toEqual(['us_ofac_sdn', 'us_trade_csl']);
      expect(entries[0].aliases).toEqual(['ALIAS1', 'ALIAS2']);
    });

    it('throws error on non-OK response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchSanctionsList()).rejects.toThrow('Failed to fetch maritime sanctions: 404');
    });

    it('throws error on network failure', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchSanctionsList()).rejects.toThrow('Network error');
    });
  });
});

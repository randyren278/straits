/**
 * Tests for sanctions database CRUD operations.
 * M005-S01: Updated for enriched schema with batch upsert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  upsertSanction,
  batchUpsertSanctions,
  getSanction,
  getVesselsWithSanctions,
  migrateSanctionsSchema,
} from './sanctions';
import type { SanctionEntry } from '../external/opensanctions';

// Mock the pool from db/index
vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';

describe('Sanctions CRUD', () => {
  const mockQuery = vi.mocked(pool.query);

  beforeEach(() => {
    mockQuery.mockReset();
  });

  const makeSanctionEntry = (overrides?: Partial<SanctionEntry>): SanctionEntry => ({
    imo: '1234567',
    name: 'TEST VESSEL',
    vesselType: 'VESSEL',
    riskCategory: 'sanction',
    datasets: ['us_ofac_sdn', 'us_trade_csl'],
    flag: 'ir',
    mmsi: '572469210',
    aliases: ['ALPHA', 'ARTAVIL'],
    opensanctionsUrl: 'https://www.opensanctions.org/entities/ofac-15036',
    countries: ['ir', 'mt'],
    authority: 'OFAC',
    listDate: null,
    reason: 'sanction',
    sourceUrl: 'https://www.opensanctions.org/entities/ofac-15036',
    ...overrides,
  });

  describe('migrateSanctionsSchema', () => {
    it('runs ALTER TABLE ADD COLUMN statements', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await migrateSanctionsSchema();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS risk_category');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS datasets');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS aliases');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS opensanctions_url');
    });
  });

  describe('upsertSanction', () => {
    it('inserts sanction entry with enriched columns', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      await upsertSanction(makeSanctionEntry());

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO vessel_sanctions');
      expect(sql).toContain('risk_category');
      expect(sql).toContain('datasets');
      expect(sql).toContain('aliases');
      expect(sql).toContain('opensanctions_url');
      expect(params).toContain('1234567');
      expect(params).toContain('OFAC');
    });

    it('updates existing entry on conflict', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      await upsertSanction(makeSanctionEntry({ authority: 'EU' }));

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (imo) DO UPDATE SET');
      expect(sql).toContain('risk_category = EXCLUDED.risk_category');
    });
  });

  describe('batchUpsertSanctions', () => {
    it('batch inserts entries using unnest', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never) // batch insert
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // stale cleanup

      const entries = [
        makeSanctionEntry({ imo: '1111111' }),
        makeSanctionEntry({ imo: '2222222' }),
      ];

      const result = await batchUpsertSanctions(entries);

      expect(result.upserted).toBe(2);
      expect(result.deleted).toBe(0);
      // First call: batch insert, second call: stale delete
      expect(mockQuery).toHaveBeenCalledTimes(2);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('unnest');
    });

    it('deletes stale entries not in current fetch', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // batch insert
        .mockResolvedValueOnce({ rows: [], rowCount: 3 } as never); // stale cleanup

      const result = await batchUpsertSanctions([makeSanctionEntry()]);

      expect(result.deleted).toBe(3);
      const [deleteSql] = mockQuery.mock.calls[1];
      expect(deleteSql).toContain('DELETE FROM vessel_sanctions');
      expect(deleteSql).toContain('WHERE imo != ALL');
    });

    it('returns zero counts for empty input', async () => {
      const result = await batchUpsertSanctions([]);
      expect(result).toEqual({ upserted: 0, deleted: 0 });
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('batches large inputs in chunks of 500', async () => {
      // Create 1200 entries
      const entries = Array.from({ length: 1200 }, (_, i) =>
        makeSanctionEntry({ imo: String(i).padStart(7, '0') })
      );

      // 3 batch inserts + 1 stale delete = 4 calls
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 500 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 500 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 200 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const result = await batchUpsertSanctions(entries);

      expect(result.upserted).toBe(1200);
      expect(mockQuery).toHaveBeenCalledTimes(4); // 3 batches + 1 delete
    });
  });

  describe('getSanction', () => {
    it('returns enriched sanction record when IMO matches', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
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
          },
        ],
      } as never);

      const result = await getSanction('1234567');

      expect(result).not.toBeNull();
      expect(result?.imo).toBe('1234567');
      expect(result?.sanctioningAuthority).toBe('OFAC');
      expect(result?.riskCategory).toBe('sanction');
      expect(result?.datasets).toEqual(['us_ofac_sdn', 'us_trade_csl']);
      expect(result?.aliases).toEqual(['ALPHA', 'ARTAVIL']);
      expect(result?.opensanctionsUrl).toBe('https://www.opensanctions.org/entities/ofac-15036');
    });

    it('returns null when IMO not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      const result = await getSanction('9999999');
      expect(result).toBeNull();
    });
  });

  describe('getVesselsWithSanctions', () => {
    const mockVesselRows = [
      {
        imo: '1234567',
        mmsi: '123456789',
        name: 'TANKER ONE',
        flag: 'PA',
        shipType: 80,
        destination: 'FUJAIRAH',
        lastSeen: new Date('2024-03-01'),
        latitude: 25.5,
        longitude: 54.5,
        speed: 10.5,
        course: 180,
        heading: 182,
        navStatus: 0,
        lowConfidence: false,
        time: new Date('2024-03-01T12:00:00Z'),
        isSanctioned: true,
        sanctioningAuthority: 'OFAC',
        sanctionReason: 'sanction',
        sanctionRiskCategory: 'sanction',
        anomalyType: null,
        anomalyConfidence: null,
        anomalyDetectedAt: null,
      },
      {
        imo: '7654321',
        mmsi: '987654321',
        name: 'TANKER TWO',
        flag: 'LR',
        shipType: 81,
        destination: 'JEBEL ALI',
        lastSeen: new Date('2024-03-01'),
        latitude: 26.0,
        longitude: 55.0,
        speed: 12.0,
        course: 90,
        heading: 92,
        navStatus: 0,
        lowConfidence: false,
        time: new Date('2024-03-01T12:00:00Z'),
        isSanctioned: false,
        sanctioningAuthority: null,
        sanctionReason: null,
        sanctionRiskCategory: null,
        anomalyType: null,
        anomalyConfidence: null,
        anomalyDetectedAt: null,
      },
    ];

    it('returns vessels with isSanctioned boolean from LEFT JOIN', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels).toHaveLength(2);
      expect(vessels[0].isSanctioned).toBe(true);
      expect(vessels[1].isSanctioned).toBe(false);
    });

    it('includes sanctionRiskCategory field', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels[0].sanctionRiskCategory).toBe('sanction');
      expect(vessels[1].sanctionRiskCategory).toBeNull();
    });

    it('uses LEFT JOIN to vessel_sanctions table', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await getVesselsWithSanctions(false);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('LEFT JOIN vessel_sanctions');
    });

    it('selects risk_category from vessel_sanctions', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await getVesselsWithSanctions(false);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('risk_category');
    });

    it('returns nested position object', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels[0].position).toBeDefined();
      expect(vessels[0].position.latitude).toBe(25.5);
      expect(vessels[0].position.longitude).toBe(54.5);
    });
  });
});

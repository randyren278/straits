/**
 * Tests for sanctions database CRUD operations.
 * INTL-01: Sanctions matching with vessel data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  upsertSanction,
  getSanction,
  getVesselsWithSanctions,
  type VesselWithSanctions,
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

  describe('upsertSanction', () => {
    it('inserts sanction entry into vessel_sanctions table', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      const entry: SanctionEntry = {
        imo: '1234567',
        name: 'TEST VESSEL',
        authority: 'OFAC',
        listDate: new Date('2023-01-15'),
        reason: 'sanction',
        sourceUrl: 'https://ofac.gov',
      };

      await upsertSanction(entry);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO vessel_sanctions');
      expect(sql).toContain('ON CONFLICT (imo) DO UPDATE');
      expect(params).toContain('1234567');
      expect(params).toContain('OFAC');
    });

    it('updates existing entry on conflict', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      const entry: SanctionEntry = {
        imo: '1234567',
        name: 'TEST VESSEL',
        authority: 'EU',
        listDate: new Date('2024-03-01'),
        reason: 'updated reason',
        sourceUrl: 'https://europa.eu',
      };

      await upsertSanction(entry);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (imo) DO UPDATE SET');
      expect(sql).toContain('sanctioning_authority = EXCLUDED.sanctioning_authority');
    });

    it('handles null listDate', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      const entry: SanctionEntry = {
        imo: '7654321',
        name: 'NO DATE VESSEL',
        authority: 'UN',
        listDate: null,
        reason: null,
        sourceUrl: '',
      };

      await upsertSanction(entry);

      const [, params] = mockQuery.mock.calls[0];
      expect(params).toContain(null); // listDate
    });
  });

  describe('getSanction', () => {
    it('returns sanction record when IMO matches', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            imo: '1234567',
            sanctioningAuthority: 'OFAC',
            listDate: new Date('2023-01-15'),
            reason: 'sanction',
            confidence: 'HIGH',
          },
        ],
      } as never);

      const result = await getSanction('1234567');

      expect(result).not.toBeNull();
      expect(result?.imo).toBe('1234567');
      expect(result?.sanctioningAuthority).toBe('OFAC');
    });

    it('returns null when IMO not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      const result = await getSanction('9999999');

      expect(result).toBeNull();
    });

    it('queries with correct IMO parameter', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await getSanction('7654321');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE imo = $1');
      expect(params).toEqual(['7654321']);
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
      },
    ];

    it('returns vessels with isSanctioned boolean from LEFT JOIN', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels).toHaveLength(2);
      expect(vessels[0].isSanctioned).toBe(true);
      expect(vessels[1].isSanctioned).toBe(false);
    });

    it('includes sanctioningAuthority field', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels[0].sanctioningAuthority).toBe('OFAC');
      expect(vessels[1].sanctioningAuthority).toBeNull();
    });

    it('includes sanctionReason field', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels[0].sanctionReason).toBe('sanction');
      expect(vessels[1].sanctionReason).toBeNull();
    });

    it('filters to tankers only when tankersOnly is true', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await getVesselsWithSanctions(true);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE v.ship_type BETWEEN 80 AND 89');
    });

    it('does not filter ship type when tankersOnly is false', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await getVesselsWithSanctions(false);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('WHERE v.ship_type BETWEEN 80 AND 89');
    });

    it('uses LEFT JOIN to vessel_sanctions table', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await getVesselsWithSanctions(false);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('LEFT JOIN vessel_sanctions');
    });

    it('returns nested position object', async () => {
      mockQuery.mockResolvedValue({ rows: mockVesselRows } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels[0].position).toBeDefined();
      expect(vessels[0].position?.latitude).toBe(25.5);
      expect(vessels[0].position?.longitude).toBe(54.5);
      expect(vessels[0].position?.speed).toBe(10.5);
    });

    it('returns null position when no coordinates', async () => {
      const rowsWithoutPosition = [
        {
          ...mockVesselRows[0],
          latitude: null,
          longitude: null,
        },
      ];
      mockQuery.mockResolvedValue({ rows: rowsWithoutPosition } as never);

      const vessels = await getVesselsWithSanctions(false);

      expect(vessels[0].position).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Vessel } from '@/types/vessel';

// Create mock query function
const mockQuery = vi.fn();

// Create mock pool class
class MockPool {
  query = mockQuery;
  constructor(public config: Record<string, unknown>) {}
}

// Mock pg module
vi.mock('pg', () => ({
  Pool: MockPool,
}));

describe('Vessel CRUD Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('upsertVessel', () => {
    it('creates new vessel or updates existing by IMO', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { upsertVessel } = await import('./vessels');

      const vessel: Omit<Vessel, 'lastSeen'> = {
        imo: '1234567',
        mmsi: '123456789',
        name: 'Test Vessel',
        flag: 'PA',
        shipType: 80,
        destination: 'FUJAIRAH',
      };

      await upsertVessel(vessel);

      expect(mockQuery).toHaveBeenCalled();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO vessels');
      expect(params).toContain(vessel.imo);
      expect(params).toContain(vessel.mmsi);
      expect(params).toContain(vessel.name);
    });

    it('uses ON CONFLICT DO UPDATE pattern', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { upsertVessel } = await import('./vessels');

      await upsertVessel({
        imo: '1234567',
        mmsi: '123456789',
        name: 'Test Vessel',
        flag: 'PA',
        shipType: 80,
        destination: null,
      });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE');
    });
  });

  describe('getVessel', () => {
    it('retrieves single vessel by IMO', async () => {
      const mockVessel: Vessel = {
        imo: '1234567',
        mmsi: '123456789',
        name: 'Test Vessel',
        flag: 'PA',
        shipType: 80,
        destination: 'FUJAIRAH',
        lastSeen: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [mockVessel] });

      const { getVessel } = await import('./vessels');
      const result = await getVessel('1234567');

      expect(result).toEqual(mockVessel);
      expect(mockQuery).toHaveBeenCalled();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('FROM vessels');
      expect(sql).toContain('WHERE imo = $1');
      expect(params[0]).toBe('1234567');
    });

    it('returns null when vessel not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { getVessel } = await import('./vessels');
      const result = await getVessel('9999999');

      expect(result).toBeNull();
    });
  });

  describe('getAllVessels', () => {
    it('retrieves all vessels', async () => {
      const mockVessels: Vessel[] = [
        {
          imo: '1234567',
          mmsi: '123456789',
          name: 'Vessel 1',
          flag: 'PA',
          shipType: 80,
          destination: null,
          lastSeen: new Date(),
        },
        {
          imo: '7654321',
          mmsi: '987654321',
          name: 'Vessel 2',
          flag: 'LR',
          shipType: 70,
          destination: null,
          lastSeen: new Date(),
        },
      ];
      mockQuery.mockResolvedValue({ rows: mockVessels });

      const { getAllVessels } = await import('./vessels');
      const result = await getAllVessels(false);

      expect(result).toEqual(mockVessels);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('filters to tankers only (ship_type 80-89) when tankersOnly is true', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { getAllVessels } = await import('./vessels');
      await getAllVessels(true);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ship_type BETWEEN 80 AND 89');
    });

    it('returns all vessels when tankersOnly is false', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { getAllVessels } = await import('./vessels');
      await getAllVessels(false);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('ship_type BETWEEN');
    });
  });
});

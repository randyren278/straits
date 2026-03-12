import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { searchVessels } from './search';
import { pool } from './index';

describe('searchVessels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for empty query', async () => {
    const results = await searchVessels('');
    expect(results).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns empty array for single character query', async () => {
    const results = await searchVessels('a');
    expect(results).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', async () => {
    const results = await searchVessels('   ');
    expect(results).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('searches by IMO, MMSI, and name', async () => {
    const mockVessel = {
      imo: '1234567',
      mmsi: '123456789',
      name: 'Test Tanker',
      flag: 'PA',
      shipType: 80,
      latitude: 26.5,
      longitude: 56.0,
    };
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [mockVessel] });

    const results = await searchVessels('test');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(mockVessel);
  });

  it('trims whitespace from query before searching', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await searchVessels('  tanker  ');
    expect(pool.query).toHaveBeenCalled();
    const callArgs = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toContain('tanker');
  });

  it('passes query parameter for ILIKE matching', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await searchVessels('tanker');
    const callArgs = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toContain('%tanker%');
  });

  it('returns results with position data (latitude/longitude)', async () => {
    const mockVessel = {
      imo: '9876543',
      mmsi: '987654321',
      name: 'Oil Carrier',
      flag: 'LR',
      shipType: 81,
      latitude: 12.5,
      longitude: 43.3,
    };
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [mockVessel] });

    const results = await searchVessels('carrier');
    expect(results[0].latitude).toBe(12.5);
    expect(results[0].longitude).toBe(43.3);
  });
});

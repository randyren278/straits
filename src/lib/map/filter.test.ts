/**
 * Tests for vessel filtering.
 * Requirements: MAP-03
 */
import { describe, it, expect } from 'vitest';
import { filterTankers } from './filter';
import type { VesselWithPosition } from '@/types/vessel';

describe('Vessel Filtering', () => {
  const createVessel = (shipType: number, name: string): VesselWithPosition => ({
    imo: `IMO${shipType}`,
    mmsi: `MMSI${shipType}`,
    name,
    flag: 'PA',
    shipType,
    destination: null,
    lastSeen: new Date(),
    position: {
      time: new Date(),
      mmsi: `MMSI${shipType}`,
      imo: `IMO${shipType}`,
      latitude: 25.0,
      longitude: 55.0,
      speed: 10,
      course: 90,
      heading: 90,
      navStatus: 0,
      lowConfidence: false,
    },
  });

  const tanker80 = createVessel(80, 'LNG Tanker');
  const tanker85 = createVessel(85, 'Oil Tanker');
  const tanker89 = createVessel(89, 'Tanker Not Specified');
  const cargo70 = createVessel(70, 'Cargo Ship');
  const passenger60 = createVessel(60, 'Passenger Ship');

  describe('filterTankers', () => {
    it('filterTankers returns only ship types 80-89', () => {
      const vessels = [tanker80, cargo70, tanker85, passenger60];
      const result = filterTankers(vessels, true);
      expect(result).toHaveLength(2);
      expect(result.map((v) => v.name)).toContain('LNG Tanker');
      expect(result.map((v) => v.name)).toContain('Oil Tanker');
    });

    it('excludes ship types outside 80-89 range', () => {
      const vessels = [tanker80, cargo70, passenger60];
      const result = filterTankers(vessels, true);
      expect(result.map((v) => v.name)).not.toContain('Cargo Ship');
      expect(result.map((v) => v.name)).not.toContain('Passenger Ship');
    });

    it('filterTankers with showAll returns all vessels', () => {
      const vessels = [tanker80, cargo70, passenger60];
      const result = filterTankers(vessels, false);
      expect(result).toHaveLength(3);
    });
  });

  describe('ship type classification', () => {
    it('ship type 80 is tanker (LNG)', () => {
      const result = filterTankers([tanker80], true);
      expect(result).toHaveLength(1);
    });

    it('ship type 81-84 are tankers', () => {
      const vessels = [81, 82, 83, 84].map((t) => createVessel(t, `Tanker${t}`));
      const result = filterTankers(vessels, true);
      expect(result).toHaveLength(4);
    });

    it('ship type 89 is tanker (not specified)', () => {
      const result = filterTankers([tanker89], true);
      expect(result).toHaveLength(1);
    });

    it('ship type 70 is not a tanker (cargo)', () => {
      const result = filterTankers([cargo70], true);
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty vessel array', () => {
      const result = filterTankers([], true);
      expect(result).toHaveLength(0);
    });

    it('handles vessels at boundary (79 and 90)', () => {
      const vessel79 = createVessel(79, 'Not Tanker 79');
      const vessel90 = createVessel(90, 'Not Tanker 90');
      const result = filterTankers([vessel79, vessel90], true);
      expect(result).toHaveLength(0);
    });
  });
});

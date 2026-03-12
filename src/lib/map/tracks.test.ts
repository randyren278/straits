/**
 * Tests for vessel track building.
 * Requirements: MAP-04
 */
import { describe, it, expect } from 'vitest';
import { buildTrackLine } from './tracks';
import type { VesselPosition } from '@/types/vessel';

describe('Track Building', () => {
  const createPosition = (
    time: Date,
    lat: number,
    lng: number
  ): VesselPosition => ({
    time,
    mmsi: '123456789',
    imo: '1234567',
    latitude: lat,
    longitude: lng,
    speed: 10,
    course: 90,
    heading: 90,
    navStatus: 0,
    lowConfidence: false,
  });

  describe('buildTrackLine', () => {
    it('builds LineString from position history', () => {
      const positions = [
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
        createPosition(new Date('2026-03-11T11:00:00Z'), 25.1, 55.1),
        createPosition(new Date('2026-03-11T12:00:00Z'), 25.2, 55.2),
      ];
      const result = buildTrackLine(positions);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('Feature');
      expect(result?.geometry.type).toBe('LineString');
      expect(result?.geometry.coordinates).toHaveLength(3);
    });

    it('orders coordinates chronologically', () => {
      // Pass positions out of order to verify sorting
      const positions = [
        createPosition(new Date('2026-03-11T12:00:00Z'), 25.2, 55.2),
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
        createPosition(new Date('2026-03-11T11:00:00Z'), 25.1, 55.1),
      ];
      const result = buildTrackLine(positions);
      expect(result?.geometry.coordinates[0]).toEqual([55.0, 25.0]); // earliest
      expect(result?.geometry.coordinates[2]).toEqual([55.2, 25.2]); // latest
    });

    it('returns null for single position (no line)', () => {
      const positions = [
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
      ];
      const result = buildTrackLine(positions);
      expect(result).toBeNull();
    });
  });

  describe('track properties', () => {
    it('includes mmsi in properties', () => {
      const positions = [
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
        createPosition(new Date('2026-03-11T11:00:00Z'), 25.1, 55.1),
      ];
      const result = buildTrackLine(positions);
      expect(result?.properties?.mmsi).toBe('123456789');
    });

    it('includes startTime and endTime in properties', () => {
      const positions = [
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
        createPosition(new Date('2026-03-11T12:00:00Z'), 25.2, 55.2),
      ];
      const result = buildTrackLine(positions);
      expect(result?.properties?.startTime).toEqual(
        new Date('2026-03-11T10:00:00Z')
      );
      expect(result?.properties?.endTime).toEqual(
        new Date('2026-03-11T12:00:00Z')
      );
    });

    it('includes pointCount in properties', () => {
      const positions = [
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
        createPosition(new Date('2026-03-11T11:00:00Z'), 25.1, 55.1),
        createPosition(new Date('2026-03-11T12:00:00Z'), 25.2, 55.2),
      ];
      const result = buildTrackLine(positions);
      expect(result?.properties?.pointCount).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('handles empty position history', () => {
      const result = buildTrackLine([]);
      expect(result).toBeNull();
    });

    it('uses [longitude, latitude] order for GeoJSON', () => {
      const positions = [
        createPosition(new Date('2026-03-11T10:00:00Z'), 25.0, 55.0),
        createPosition(new Date('2026-03-11T11:00:00Z'), 25.1, 55.1),
      ];
      const result = buildTrackLine(positions);
      // First coordinate should be [lng, lat]
      expect(result?.geometry.coordinates[0]).toEqual([55.0, 25.0]);
    });
  });
});

/**
 * Tests for GeoJSON conversion.
 * Requirements: MAP-01
 */
import { describe, it, expect } from 'vitest';
import { vesselsToGeoJSON } from './geojson';
import type { VesselWithPosition } from '@/types/vessel';

describe('GeoJSON Conversion', () => {
  const mockVesselWithPosition: VesselWithPosition = {
    imo: '1234567',
    mmsi: '123456789',
    name: 'Test Tanker',
    flag: 'PA',
    shipType: 80,
    destination: 'FUJAIRAH',
    lastSeen: new Date('2026-03-11T12:00:00Z'),
    position: {
      time: new Date('2026-03-11T12:00:00Z'),
      mmsi: '123456789',
      imo: '1234567',
      latitude: 25.5,
      longitude: 55.5,
      speed: 12.5,
      course: 180,
      heading: 175,
      navStatus: 0,
      lowConfidence: false,
    },
  };

  describe('vesselsToGeoJSON', () => {
    it('converts vessel array to FeatureCollection', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
    });

    it('creates Point feature for each vessel', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      const feature = result.features[0];
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Point');
    });

    it('includes all required properties in features', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      const props = result.features[0].properties;
      expect(props).toHaveProperty('mmsi', '123456789');
      expect(props).toHaveProperty('imo', '1234567');
      expect(props).toHaveProperty('name', 'Test Tanker');
      expect(props).toHaveProperty('shipType', 80);
      expect(props).toHaveProperty('flag', 'PA');
      expect(props).toHaveProperty('destination', 'FUJAIRAH');
    });
  });

  describe('feature properties', () => {
    it('includes vessel IMO as id', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      expect(result.features[0].id).toBe('1234567');
    });

    it('includes MMSI, name, flag, shipType', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      const props = result.features[0].properties;
      expect(props?.mmsi).toBe('123456789');
      expect(props?.name).toBe('Test Tanker');
      expect(props?.flag).toBe('PA');
      expect(props?.shipType).toBe(80);
    });

    it('includes speed, course, heading from position', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      const props = result.features[0].properties;
      expect(props?.speed).toBe(12.5);
      expect(props?.course).toBe(180);
      expect(props?.heading).toBe(175);
    });

    it('includes lowConfidence flag', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      const props = result.features[0].properties;
      expect(props?.lowConfidence).toBe(false);
    });
  });

  describe('coordinate handling', () => {
    it('uses [longitude, latitude] order for GeoJSON', () => {
      const result = vesselsToGeoJSON([mockVesselWithPosition]);
      const coords = (result.features[0].geometry as GeoJSON.Point).coordinates;
      expect(coords).toEqual([55.5, 25.5]); // [lng, lat]
    });

    it('skips vessels with null position', () => {
      const vesselNoPosition: VesselWithPosition = {
        ...mockVesselWithPosition,
        position: null,
      };
      const result = vesselsToGeoJSON([vesselNoPosition, mockVesselWithPosition]);
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties?.imo).toBe('1234567');
    });

    it('handles empty array', () => {
      const result = vesselsToGeoJSON([]);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
    });
  });
});

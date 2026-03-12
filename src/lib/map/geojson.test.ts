/**
 * Test scaffolds for GeoJSON conversion.
 * Requirements: MAP-01
 */
import { describe, it } from 'vitest';

describe('GeoJSON Conversion', () => {
  describe('vesselsToGeoJSON', () => {
    it.todo('converts vessel array to FeatureCollection');
    it.todo('creates Point feature for each vessel');
    it.todo('includes all required properties in features');
  });

  describe('feature properties', () => {
    it.todo('includes vessel IMO as id');
    it.todo('includes MMSI, name, flag, shipType');
    it.todo('includes speed, course, heading from position');
    it.todo('includes lowConfidence flag');
  });

  describe('coordinate handling', () => {
    it.todo('uses [longitude, latitude] order for GeoJSON');
    it.todo('handles null position gracefully');
  });
});

import { describe, it, expect } from 'vitest';
import type {
  AISMessage,
  PositionReport,
  ShipStaticData,
  AISMetaData,
} from '../ais';
import type { Vessel, VesselPosition, VesselWithPosition } from '../vessel';

describe('Type definitions', () => {
  describe('Vessel types', () => {
    it('Vessel type has correct structure', () => {
      const vessel: Vessel = {
        imo: '1234567',
        mmsi: '123456789',
        name: 'Test Vessel',
        flag: 'PA',
        shipType: 80,
        destination: 'FUJAIRAH',
        lastSeen: new Date(),
      };

      expect(vessel.imo).toBe('1234567');
      expect(vessel.mmsi).toBe('123456789');
      expect(vessel.name).toBe('Test Vessel');
      expect(vessel.flag).toBe('PA');
      expect(vessel.shipType).toBe(80);
      expect(vessel.destination).toBe('FUJAIRAH');
      expect(vessel.lastSeen).toBeInstanceOf(Date);
    });

    it('VesselPosition type has correct structure', () => {
      const position: VesselPosition = {
        time: new Date(),
        mmsi: '123456789',
        imo: '1234567',
        latitude: 26.0,
        longitude: 56.0,
        speed: 12.5,
        course: 180,
        heading: 175,
        navStatus: 0,
        lowConfidence: false,
      };

      expect(position.latitude).toBe(26.0);
      expect(position.longitude).toBe(56.0);
      expect(position.speed).toBe(12.5);
      expect(position.lowConfidence).toBe(false);
    });

    it('VesselWithPosition combines vessel and position', () => {
      const vesselWithPosition: VesselWithPosition = {
        imo: '1234567',
        mmsi: '123456789',
        name: 'Test Vessel',
        flag: 'PA',
        shipType: 80,
        destination: null,
        lastSeen: new Date(),
        position: {
          time: new Date(),
          mmsi: '123456789',
          imo: '1234567',
          latitude: 26.0,
          longitude: 56.0,
          speed: null,
          course: null,
          heading: null,
          navStatus: null,
          lowConfidence: false,
        },
      };

      expect(vesselWithPosition.position).not.toBeNull();
      expect(vesselWithPosition.position?.latitude).toBe(26.0);
    });
  });

  describe('AIS message types', () => {
    it('AISMetaData has correct structure', () => {
      const metadata: AISMetaData = {
        MMSI: '123456789',
        time_utc: '2025-01-01T00:00:00Z',
        ShipName: 'Test Vessel',
      };

      expect(metadata.MMSI).toBe('123456789');
      expect(metadata.time_utc).toBe('2025-01-01T00:00:00Z');
    });

    it('PositionReport type matches AISStream.io format', () => {
      const positionReport: PositionReport = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.0,
          Longitude: 56.0,
          Sog: 12.5,
          Cog: 180,
          TrueHeading: 175,
          NavigationalStatus: 0,
        },
        MetaData: {
          MMSI: '123456789',
          time_utc: '2025-01-01T00:00:00Z',
        },
      };

      expect(positionReport.MessageType).toBe('PositionReport');
      expect(positionReport.Message.Latitude).toBe(26.0);
      expect(positionReport.Message.Sog).toBe(12.5);
    });

    it('ShipStaticData type matches AISStream.io format', () => {
      const staticData: ShipStaticData = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 1234567,
          ShipName: 'TEST VESSEL',
          ShipType: 80,
          Destination: 'FUJAIRAH',
        },
        MetaData: {
          MMSI: '123456789',
          time_utc: '2025-01-01T00:00:00Z',
        },
      };

      expect(staticData.MessageType).toBe('ShipStaticData');
      expect(staticData.Message.ImoNumber).toBe(1234567);
      expect(staticData.Message.ShipType).toBe(80);
    });

    it('AISMessage discriminated union distinguishes message types', () => {
      const positionReport: AISMessage = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.0,
          Longitude: 56.0,
          Sog: 12.5,
          Cog: 180,
          TrueHeading: 175,
          NavigationalStatus: 0,
        },
        MetaData: {
          MMSI: '123456789',
          time_utc: '2025-01-01T00:00:00Z',
        },
      };

      const staticData: AISMessage = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 1234567,
          ShipName: 'TEST VESSEL',
          ShipType: 80,
          Destination: 'FUJAIRAH',
        },
        MetaData: {
          MMSI: '123456789',
          time_utc: '2025-01-01T00:00:00Z',
        },
      };

      // Type narrowing should work with discriminated union
      if (positionReport.MessageType === 'PositionReport') {
        expect(positionReport.Message.Latitude).toBe(26.0);
      }
      if (staticData.MessageType === 'ShipStaticData') {
        expect(staticData.Message.ImoNumber).toBe(1234567);
      }
    });
  });
});

/**
 * Tests for AIS message parser.
 * Requirements: DATA-01, DATA-03
 */
import { describe, it, expect } from 'vitest';
import { parseAISMessage, parsePositionReport, parseShipStaticData } from './parser';

describe('AIS parser', () => {
  describe('parsePositionReport', () => {
    it('extracts position data correctly', () => {
      const raw = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.123,
          Longitude: 56.789,
          Sog: 12.5,
          Cog: 45.0,
          TrueHeading: 44,
          NavigationalStatus: 0,
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parsePositionReport(raw as any);
      expect(result.latitude).toBe(26.123);
      expect(result.longitude).toBe(56.789);
      expect(result.speed).toBe(12.5);
      expect(result.mmsi).toBe('123456789');
    });

    it('handles missing optional fields gracefully', () => {
      const raw = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.0,
          Longitude: 56.0,
          // Missing Sog, Cog, TrueHeading, NavigationalStatus
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parsePositionReport(raw as any);
      expect(result.speed).toBeNull();
      expect(result.course).toBeNull();
      expect(result.heading).toBeNull();
      expect(result.navStatus).toBeNull();
    });

    it('sets imo to null (comes from ShipStaticData)', () => {
      const raw = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.0,
          Longitude: 56.0,
          Sog: 10,
          Cog: 90,
          TrueHeading: 90,
          NavigationalStatus: 0,
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parsePositionReport(raw as any);
      expect(result.imo).toBeNull();
    });

    it('initializes lowConfidence to false', () => {
      const raw = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.0,
          Longitude: 56.0,
          Sog: 10,
          Cog: 90,
          TrueHeading: 90,
          NavigationalStatus: 0,
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parsePositionReport(raw as any);
      expect(result.lowConfidence).toBe(false);
    });
  });

  describe('parseShipStaticData', () => {
    it('extracts IMO and vessel metadata', () => {
      const raw = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 9876543,
          ShipName: 'TANKER ONE',
          ShipType: 80,
          Destination: 'SINGAPORE',
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseShipStaticData(raw as any);
      expect(result.imo).toBe('9876543');
      expect(result.name).toBe('TANKER ONE');
      expect(result.shipType).toBe(80);
    });

    it('converts IMO number to string', () => {
      const raw = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 1234567,
          ShipName: 'TEST',
          ShipType: 80,
          Destination: '',
        },
        MetaData: { MMSI: '999888777', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseShipStaticData(raw as any);
      expect(result.imo).toBe('1234567');
    });

    it('trims whitespace from ship name and destination', () => {
      const raw = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 9876543,
          ShipName: '  TANKER TWO  ',
          ShipType: 80,
          Destination: '  PORT  ',
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseShipStaticData(raw as any);
      expect(result.name).toBe('TANKER TWO');
      expect(result.destination).toBe('PORT');
    });

    it('defaults empty ship name to UNKNOWN', () => {
      const raw = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 9876543,
          ShipName: '',
          ShipType: 80,
          Destination: 'SINGAPORE',
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseShipStaticData(raw as any);
      expect(result.name).toBe('UNKNOWN');
    });

    it('sets null destination for empty string', () => {
      const raw = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 9876543,
          ShipName: 'TANKER',
          ShipType: 80,
          Destination: '   ',
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseShipStaticData(raw as any);
      expect(result.destination).toBeNull();
    });
  });

  describe('parseAISMessage', () => {
    it('returns null for unsupported message types', () => {
      const raw = { MessageType: 'Unknown', Message: {}, MetaData: {} };
      expect(parseAISMessage(raw as any)).toBeNull();
    });

    it('dispatches PositionReport to parsePositionReport', () => {
      const raw = {
        MessageType: 'PositionReport',
        Message: {
          Latitude: 26.123,
          Longitude: 56.789,
          Sog: 12.5,
          Cog: 45.0,
          TrueHeading: 44,
          NavigationalStatus: 0,
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseAISMessage(raw as any);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('position');
      expect(result!.data).toHaveProperty('latitude', 26.123);
    });

    it('dispatches ShipStaticData to parseShipStaticData', () => {
      const raw = {
        MessageType: 'ShipStaticData',
        Message: {
          ImoNumber: 9876543,
          ShipName: 'TANKER ONE',
          ShipType: 80,
          Destination: 'SINGAPORE',
        },
        MetaData: { MMSI: '123456789', time_utc: '2026-03-11T10:00:00Z' },
      };
      const result = parseAISMessage(raw as any);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('static');
      expect(result!.data).toHaveProperty('imo', '9876543');
    });
  });
});

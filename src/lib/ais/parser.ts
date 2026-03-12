/**
 * AIS message parser for AISStream.io format.
 * Parses PositionReport and ShipStaticData messages into typed objects.
 * Requirements: DATA-01, DATA-03
 */
import type { VesselPosition, Vessel } from '@/types/vessel';
import type { PositionReport, ShipStaticData, AISMessage } from '@/types/ais';

/**
 * Parse a PositionReport message into a VesselPosition object.
 * Handles missing/null fields gracefully (AIS data is often incomplete).
 */
export function parsePositionReport(msg: PositionReport): VesselPosition {
  return {
    time: new Date(msg.MetaData.time_utc),
    mmsi: msg.MetaData.MMSI,
    imo: null, // IMO comes from ShipStaticData, not PositionReport
    latitude: msg.Message.Latitude,
    longitude: msg.Message.Longitude,
    speed: msg.Message.Sog ?? null,
    course: msg.Message.Cog ?? null,
    heading: msg.Message.TrueHeading ?? null,
    navStatus: msg.Message.NavigationalStatus ?? null,
    lowConfidence: false,
  };
}

/**
 * Parse a ShipStaticData message into vessel metadata.
 * Extracts IMO number, name, type, and destination.
 */
export function parseShipStaticData(msg: ShipStaticData): Omit<Vessel, 'lastSeen'> {
  const name = msg.Message.ShipName?.trim();
  const destination = msg.Message.Destination?.trim();

  return {
    imo: String(msg.Message.ImoNumber),
    mmsi: msg.MetaData.MMSI,
    name: name || 'UNKNOWN',
    flag: '', // Flag not in ShipStaticData, derive from MMSI MID if needed
    shipType: msg.Message.ShipType,
    destination: destination || null,
  };
}

/**
 * Result type for parseAISMessage.
 * Discriminated union allowing type-safe handling of different message types.
 */
export type ParseResult =
  | { type: 'position'; data: VesselPosition }
  | { type: 'static'; data: Omit<Vessel, 'lastSeen'> }
  | null;

/**
 * Parse an AIS message and dispatch to the appropriate parser.
 * Returns null for unsupported message types.
 */
export function parseAISMessage(msg: AISMessage): ParseResult {
  if (msg.MessageType === 'PositionReport') {
    return { type: 'position', data: parsePositionReport(msg as PositionReport) };
  }
  if (msg.MessageType === 'ShipStaticData') {
    return { type: 'static', data: parseShipStaticData(msg as ShipStaticData) };
  }
  return null;
}

/**
 * AIS message parser for AISStream.io format.
 * Parses PositionReport and ShipStaticData messages into typed objects.
 *
 * IMPORTANT: AISStream.io wraps the payload one level deeper than the top-level MessageType
 * suggests. Field paths are:
 *   msg.Message.PositionReport.Latitude  (not msg.Message.Latitude)
 *   msg.Message.ShipStaticData.Name      (not msg.Message.ShipName)
 *   msg.MetaData.MMSI is a number        — coerce via String(...)
 *
 * Requirements: DATA-01, DATA-03
 */
import type { VesselPosition, Vessel } from '@/types/vessel';
import type { PositionReport, ShipStaticData, AISMessage } from '@/types/ais';

/**
 * Parse a PositionReport message into a VesselPosition object.
 * Handles missing/null fields gracefully (AIS data is often incomplete).
 */
export function parsePositionReport(msg: PositionReport): VesselPosition {
  const m = msg.Message.PositionReport;
  return {
    time: new Date(msg.MetaData.time_utc),
    mmsi: String(msg.MetaData.MMSI),
    imo: null, // IMO comes from ShipStaticData, not PositionReport
    latitude: m.Latitude,
    longitude: m.Longitude,
    speed: m.Sog ?? null,
    course: m.Cog ?? null,
    heading: m.TrueHeading ?? null,
    navStatus: m.NavigationalStatus ?? null,
    lowConfidence: false,
  };
}

/**
 * Parse a ShipStaticData message into vessel metadata.
 * Extracts IMO number, name, type, and destination.
 * Note: inside ShipStaticData body, the field is "Name" (not "ShipName")
 * and "Type" (not "ShipType").
 */
export function parseShipStaticData(msg: ShipStaticData): Omit<Vessel, 'lastSeen'> {
  const m = msg.Message.ShipStaticData;
  const name = m.Name?.trim();
  const destination = m.Destination?.trim();

  return {
    imo: String(m.ImoNumber),
    mmsi: String(msg.MetaData.MMSI),
    name: name || 'UNKNOWN',
    flag: '', // Flag not in ShipStaticData, derive from MMSI MID if needed
    shipType: m.Type,
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

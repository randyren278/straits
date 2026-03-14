/**
 * AIS message type definitions matching AISStream.io wire format.
 * These types represent the WebSocket messages received from AISStream.io API.
 *
 * Reference: https://aisstream.io/documentation
 *
 * IMPORTANT: The API wraps payload data one level deeper than a naive reading suggests.
 * The message body lives at msg.Message.PositionReport (not msg.Message) for PositionReport,
 * and at msg.Message.ShipStaticData (not msg.Message) for ShipStaticData.
 * MetaData.MMSI arrives as a number — coerce to string at every read site.
 */

/**
 * Common metadata present in all AIS messages.
 * MMSI arrives as a number from the API — callers must coerce via String(mmsi).
 */
export interface AISMetaData {
  /** Maritime Mobile Service Identity (sent as number by API) */
  MMSI: number;
  /** UTC timestamp of the message */
  time_utc: string;
  /** Ship name (present in MetaData for position reports) */
  ShipName?: string;
  /** Latitude from MetaData (mirrors Message payload) */
  latitude?: number;
  /** Longitude from MetaData (mirrors Message payload) */
  longitude?: number;
}

/**
 * Position report message body.
 * Contains dynamic vessel information (position, speed, course).
 * Access via msg.Message.PositionReport.
 */
export interface PositionReportBody {
  /** Latitude in decimal degrees (-90 to 90) */
  Latitude: number;
  /** Longitude in decimal degrees (-180 to 180) */
  Longitude: number;
  /** Speed Over Ground in knots (0-102.2, 102.3 = not available) */
  Sog: number;
  /** Course Over Ground in degrees (0-360, 360 = not available) */
  Cog: number;
  /** True heading in degrees (0-360, 511 = not available) */
  TrueHeading: number;
  /** AIS navigational status code (0-15) */
  NavigationalStatus: number;
  /** MMSI as numeric UserID */
  UserID: number;
  /** Whether the message is valid */
  Valid: boolean;
}

/**
 * Position report AIS message (Message Types 1, 2, 3, 18, 19).
 * The payload is nested: Message.PositionReport contains the actual data.
 *
 * @example
 * const body = msg.Message.PositionReport;
 * console.log(body.Latitude, body.Longitude);
 * const mmsi = String(msg.MetaData.MMSI);
 */
export interface PositionReport {
  /** Message type discriminator */
  MessageType: 'PositionReport';
  /** Nested message object — actual data is at Message.PositionReport */
  Message: { PositionReport: PositionReportBody };
  /** Message metadata including MMSI (as number) and timestamp */
  MetaData: AISMetaData;
}

/**
 * Ship static data message body.
 * Contains vessel identification and voyage information.
 * Access via msg.Message.ShipStaticData.
 * Note: field names differ from MetaData — use Name (not ShipName) and Type (not ShipType).
 */
export interface ShipStaticDataBody {
  /** IMO number (unique vessel identifier) */
  ImoNumber: number;
  /** Vessel name — NOTE: "Name" not "ShipName" */
  Name: string;
  /** AIS ship type code (80-89 for tankers) — NOTE: "Type" not "ShipType" */
  Type: number;
  /** Voyage destination */
  Destination: string;
  /** Radio call sign */
  CallSign?: string;
  /** MMSI as numeric UserID */
  UserID: number;
  /** Whether the message is valid */
  Valid: boolean;
}

/**
 * Ship static data AIS message (Message Type 5, 24).
 * The payload is nested: Message.ShipStaticData contains the actual data.
 *
 * @example
 * const body = msg.Message.ShipStaticData;
 * console.log(body.Name, body.Type);
 * const mmsi = String(msg.MetaData.MMSI);
 */
export interface ShipStaticData {
  /** Message type discriminator */
  MessageType: 'ShipStaticData';
  /** Nested message object — actual data is at Message.ShipStaticData */
  Message: { ShipStaticData: ShipStaticDataBody };
  /** Message metadata including MMSI (as number) and timestamp */
  MetaData: AISMetaData;
}

/**
 * Discriminated union of AIS message types.
 * Use MessageType to narrow the type in conditional logic.
 *
 * @example
 * if (message.MessageType === 'PositionReport') {
 *   const body = message.Message.PositionReport;
 *   console.log(body.Latitude, String(message.MetaData.MMSI));
 * } else if (message.MessageType === 'ShipStaticData') {
 *   const body = message.Message.ShipStaticData;
 *   console.log(body.Name, body.ImoNumber);
 * }
 */
export type AISMessage = PositionReport | ShipStaticData;

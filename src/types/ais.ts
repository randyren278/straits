/**
 * AIS message type definitions matching AISStream.io format.
 * These types represent the WebSocket messages received from AISStream.io API.
 *
 * Reference: https://aisstream.io/documentation
 */

/**
 * Common metadata present in all AIS messages.
 */
export interface AISMetaData {
  /** Maritime Mobile Service Identity */
  MMSI: string;
  /** UTC timestamp of the message */
  time_utc: string;
  /** Ship name (when available) */
  ShipName?: string;
}

/**
 * Position report message content.
 * Contains dynamic vessel information (position, speed, course).
 */
export interface PositionReportMessage {
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
}

/**
 * Position report AIS message (Message Types 1, 2, 3, 18, 19).
 * Contains vessel position and movement data.
 */
export interface PositionReport {
  /** Message type discriminator */
  MessageType: 'PositionReport';
  /** Position and movement data */
  Message: PositionReportMessage;
  /** Message metadata including MMSI and timestamp */
  MetaData: AISMetaData;
}

/**
 * Static data message content.
 * Contains vessel identification and voyage information.
 */
export interface ShipStaticDataMessage {
  /** IMO number (unique vessel identifier) */
  ImoNumber: number;
  /** Vessel name */
  ShipName: string;
  /** AIS ship type code (80-89 for tankers) */
  ShipType: number;
  /** Voyage destination */
  Destination: string;
}

/**
 * Ship static data AIS message (Message Type 5, 24).
 * Contains vessel identification and voyage information.
 */
export interface ShipStaticData {
  /** Message type discriminator */
  MessageType: 'ShipStaticData';
  /** Static vessel data */
  Message: ShipStaticDataMessage;
  /** Message metadata including MMSI and timestamp */
  MetaData: AISMetaData;
}

/**
 * Discriminated union of AIS message types.
 * Use MessageType to narrow the type in conditional logic.
 *
 * @example
 * if (message.MessageType === 'PositionReport') {
 *   console.log(message.Message.Latitude);
 * } else if (message.MessageType === 'ShipStaticData') {
 *   console.log(message.Message.ImoNumber);
 * }
 */
export type AISMessage = PositionReport | ShipStaticData;

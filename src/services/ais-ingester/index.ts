/**
 * Standalone AIS Ingestion Service
 *
 * This is a SEPARATE Node.js service that runs on Railway/Render (not Vercel).
 * It maintains a persistent WebSocket connection to AISStream.io.
 *
 * Vercel cannot maintain persistent WebSocket connections (per research pitfall #3),
 * so this service runs independently alongside the Next.js app.
 *
 * DEPLOYMENT:
 * 1. Create Railway/Render project
 * 2. Point to src/services/ais-ingester directory
 * 3. Set environment variables: DATABASE_URL, AISSTREAM_API_KEY
 * 4. Platform auto-detects package.json and runs `npm start`
 *
 * Requirements: DATA-01, DATA-02, DATA-03, DATA-04
 */
import WebSocket from 'ws';
import { Pool } from 'pg';
import 'dotenv/config';
import { startDetectionJobs } from './detection-jobs';
import { startRefreshJobs } from './refresh-jobs';

// ============================================================================
// Types (standalone - doesn't import from main project to avoid bundling issues)
// ============================================================================

interface VesselPosition {
  time: Date;
  mmsi: string;
  imo: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  course: number | null;
  heading: number | null;
  navStatus: number | null;
  lowConfidence: boolean;
}

interface VesselMetadata {
  imo: string;
  mmsi: string;
  name: string;
  shipType: number;
  destination: string | null;
}

// ============================================================================
// Database Connection
// ============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// GPS Filter Constants
// ============================================================================

const MAX_SPEED_KNOTS = 50;

const JAMMING_ZONES = [
  // Persian Gulf (heavy Iranian jamming)
  { minLat: 24, maxLat: 30, minLon: 48, maxLon: 57 },
  // Red Sea / Bab el-Mandeb (Houthi activity)
  { minLat: 12, maxLat: 20, minLon: 38, maxLon: 45 },
];

function isInJammingZone(lat: number, lon: number): boolean {
  return JAMMING_ZONES.some(
    (z) => lat >= z.minLat && lat <= z.maxLat && lon >= z.minLon && lon <= z.maxLon
  );
}

// ============================================================================
// AISStream.io Subscription
// ============================================================================

// Middle East + major export routes bounding box
const subscription = {
  APIKey: process.env.AISSTREAM_API_KEY,
  BoundingBoxes: [
    [[10, 30], [35, 80]], // Middle East + Indian Ocean routes
  ],
  FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
};

// ============================================================================
// Database Operations
// ============================================================================

async function insertPosition(pos: VesselPosition): Promise<void> {
  await pool.query(
    `INSERT INTO vessel_positions
     (time, mmsi, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      pos.time,
      pos.mmsi,
      pos.imo,
      pos.latitude,
      pos.longitude,
      pos.speed,
      pos.course,
      pos.heading,
      pos.navStatus,
      pos.lowConfidence,
    ]
  );
}

async function upsertVessel(v: VesselMetadata): Promise<void> {
  await pool.query(
    `INSERT INTO vessels (imo, mmsi, name, ship_type, destination, last_seen)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (imo) DO UPDATE SET
       mmsi = EXCLUDED.mmsi,
       name = EXCLUDED.name,
       ship_type = COALESCE(EXCLUDED.ship_type, vessels.ship_type),
       destination = COALESCE(EXCLUDED.destination, vessels.destination),
       last_seen = NOW()`,
    [v.imo, v.mmsi, v.name, v.shipType, v.destination]
  );
}

// ============================================================================
// Message Processing
// ============================================================================

let messageCount = 0;
let lastLogTime = Date.now();

function processPositionReport(msg: any): void {
  const m = msg.Message;
  const speed = m.Sog ?? null;

  // Filter invalid speeds (DATA-04)
  if (speed !== null && speed > MAX_SPEED_KNOTS) {
    return;
  }

  const position: VesselPosition = {
    time: new Date(msg.MetaData.time_utc),
    mmsi: msg.MetaData.MMSI,
    imo: null,
    latitude: m.Latitude,
    longitude: m.Longitude,
    speed,
    course: m.Cog ?? null,
    heading: m.TrueHeading ?? null,
    navStatus: m.NavigationalStatus ?? null,
    lowConfidence: isInJammingZone(m.Latitude, m.Longitude),
  };

  insertPosition(position).catch((err) => {
    console.error('Failed to insert position:', err.message);
  });
}

function processShipStaticData(msg: any): void {
  const m = msg.Message;

  // Only upsert if we have an IMO number (DATA-03)
  if (!m.ImoNumber) {
    return;
  }

  const vessel: VesselMetadata = {
    imo: String(m.ImoNumber),
    mmsi: msg.MetaData.MMSI,
    name: m.ShipName?.trim() || 'UNKNOWN',
    shipType: m.ShipType,
    destination: m.Destination?.trim() || null,
  };

  upsertVessel(vessel).catch((err) => {
    console.error('Failed to upsert vessel:', err.message);
  });
}

// ============================================================================
// WebSocket Connection
// ============================================================================

function connect(): void {
  console.log('Connecting to AISStream.io...');
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  ws.on('open', () => {
    console.log('Connected. Sending subscription...');
    ws.send(JSON.stringify(subscription));
    console.log('Subscription sent. Waiting for messages...');

    // Start detection and refresh cron jobs after successful connection
    startDetectionJobs();
    startRefreshJobs();
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      messageCount++;

      // Log throughput every 60 seconds
      const now = Date.now();
      if (now - lastLogTime >= 60000) {
        console.log(`Processed ${messageCount} messages in the last minute`);
        messageCount = 0;
        lastLogTime = now;
      }

      if (msg.MessageType === 'PositionReport') {
        processPositionReport(msg);
      } else if (msg.MessageType === 'ShipStaticData') {
        processShipStaticData(msg);
      }
    } catch (err) {
      console.error('Message processing error:', err);
    }
  });

  ws.on('close', (code: number, reason: Buffer) => {
    console.log(`Connection closed (code: ${code}, reason: ${reason.toString()}). Reconnecting in 5s...`);
    setTimeout(connect, 5000);
  });

  ws.on('error', (err: Error) => {
    console.error('WebSocket error:', err.message);
  });
}

// ============================================================================
// Startup
// ============================================================================

console.log('='.repeat(60));
console.log('AIS Ingester Service');
console.log('='.repeat(60));
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database URL: ${process.env.DATABASE_URL ? '(configured)' : '(missing!)'}`);
console.log(`AISStream API Key: ${process.env.AISSTREAM_API_KEY ? '(configured)' : '(missing!)'}`);
console.log('='.repeat(60));

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!process.env.AISSTREAM_API_KEY) {
  console.error('ERROR: AISSTREAM_API_KEY environment variable is required');
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Start the service
connect();

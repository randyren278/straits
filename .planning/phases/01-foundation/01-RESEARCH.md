# Phase 1: Foundation - Research

**Researched:** 2026-03-11
**Domain:** AIS data pipeline, real-time map visualization, session authentication
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational architecture for real-time vessel tracking: WebSocket-based AIS data ingestion, time-series storage in TimescaleDB, WebGL map rendering with Mapbox GL JS, and simple password-based authentication. The tech stack is mature and well-documented with clear integration patterns.

The primary challenge is the WebSocket architecture constraint on Vercel - since Vercel functions are stateless and don't support persistent WebSocket connections from browsers, the AIS WebSocket connection must run on a separate backend service (Railway, Render, or self-hosted) that bridges AIS data to the frontend via polling or Server-Sent Events. This is a critical architectural decision that affects deployment topology.

**Primary recommendation:** Use Next.js 16 with App Router for frontend, a separate Node.js service on Railway for AIS WebSocket ingestion, Neon PostgreSQL with TimescaleDB extension for storage, and Mapbox GL JS with GeoJSON layers for efficient vessel rendering. Use HTTP-only cookie sessions with bcrypt password hashing for auth.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Frontend:** Next.js 14+ with App Router - SSR for initial load, client components for real-time updates
- **Map:** Mapbox GL JS (WebGL) - proven for maritime, handles millions of points, free tier sufficient for personal use
- **Backend:** Next.js API routes + WebSocket handler - single deployment, no separate server
- **Database:** TimescaleDB (PostgreSQL extension) - time-series optimized, hypertables for position data, automatic compression
- **Hosting:** Vercel (frontend) + Railway/Supabase (TimescaleDB) - low-cost, managed
- **AIS Source:** AISStream.io WebSocket API - free tier allows 1 connection, covers Middle East
- **Region filter:** Bounding box for Middle East + Suez + Bab el-Mandeb + major export route waypoints
- **Vessel filter:** Ship type codes 80-89 (tankers) primarily, option to show all
- **Position table:** `vessel_positions` hypertable - mmsi, imo, lat, lon, speed, heading, timestamp, raw_message
- **Vessel metadata:** `vessels` table - imo (PK), mmsi, name, flag, ship_type, destination, last_seen
- **Authentication:** Single shared password stored as bcrypt hash in environment variable
- **Session:** HTTP-only cookie, 7-day expiry
- **UI:** Dark theme, Bloomberg-terminal-meets-command-center, high information density

### Claude's Discretion
- Exact color palette beyond dark theme base
- Loading states and skeleton screens
- Error toast styling
- Map control placement (zoom, compass)
- Exact panel animation timing

### Deferred Ideas (OUT OF SCOPE)
- Sanctions flags on vessels - Phase 2
- Oil price overlay - Phase 2
- News feed integration - Phase 2
- Vessel search - Phase 2
- Chokepoint monitoring widgets - Phase 2
- AIS gap detection - Phase 3
- Route anomaly detection - Phase 3
- Historical analytics charts - Phase 4
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | System ingests AIS vessel positions via WebSocket stream for Middle East + major export routes | AISStream.io WebSocket API documented; subscription message format with BoundingBoxes filter; PositionReport message type |
| DATA-02 | System stores all vessel positions in TimescaleDB from first run | TimescaleDB hypertable pattern; Neon PostgreSQL with TimescaleDB extension; pg library for Node.js |
| DATA-03 | System uses IMO number as primary vessel identity key | AIS ShipStaticData message contains IMO; vessels table uses imo as PK |
| DATA-04 | System filters GPS jamming artifacts and impossible speed jumps from position data | Filter logic: speed > 50 knots, distance/time > 100 knots; flag low_confidence for known jamming zones |
| AUTH-01 | User must enter password to access the dashboard | bcrypt for password hashing; Next.js proxy.ts (middleware) for route protection; jose for JWT/session cookies |
| MAP-01 | User can view interactive map showing live tanker positions with WebGL rendering | Mapbox GL JS 3.19.1 with GeoJSON sources and symbol/circle layers for efficient rendering |
| MAP-02 | User can click a vessel to see identity panel (name, flag, speed, heading, destination, IMO) | Mapbox GL JS click interaction with queryRenderedFeatures; popup or side panel pattern |
| MAP-03 | User can filter vessels by type (tankers only vs all) | Frontend filter on ship_type codes 80-89; update GeoJSON source data |
| MAP-04 | User can view vessel track history as polyline on map | LineLayer with GeoJSON LineString; time-gradient styling via line-gradient property |
| MAP-05 | User can see data freshness indicator showing last update time | Client-side timestamp comparison; green/yellow/red color coding |
| MAP-08 | User can use the dashboard on mobile devices via responsive layout | CSS media queries; bottom sheet pattern for vessel panel on mobile |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | React framework with SSR and API routes | Industry standard for React apps; App Router is stable |
| mapbox-gl | 3.19.1 | WebGL map rendering | Best-in-class for maritime; handles 100k+ points at 60fps |
| pg | 8.x | PostgreSQL client for Node.js | Standard Node.js PostgreSQL driver; connection pooling |
| bcrypt | 5.x | Password hashing | Industry standard for password security |
| jose | 5.x | JWT signing and verification | Modern, zero-dependency JWT library |
| ws | 8.x | WebSocket client for Node.js | For connecting to AISStream.io from backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-map-gl | 7.x | React wrapper for Mapbox GL JS | Optional - can use mapbox-gl directly in useEffect |
| zustand | 4.x | State management | For vessel selection state, filter state |
| date-fns | 3.x | Date formatting | Data freshness display, timestamp formatting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mapbox GL JS | MapLibre GL JS | MapLibre is fully open-source but Mapbox has better satellite imagery and maritime data |
| bcrypt | argon2 | Argon2 is newer but bcrypt is battle-tested and sufficient for single-password auth |
| jose | jsonwebtoken | jose is modern ESM, zero-dep; jsonwebtoken is older but works fine |
| Neon | Railway PostgreSQL | Both support TimescaleDB; Neon has better autoscaling and free tier |

**Installation:**
```bash
npm install next@latest react react-dom mapbox-gl pg bcrypt jose ws
npm install -D typescript @types/node @types/react @types/react-dom @types/pg @types/bcrypt
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   │   ├── auth/          # Login endpoint
│   │   ├── vessels/       # Vessel data endpoints
│   │   └── positions/     # Position history endpoints
│   ├── (protected)/       # Route group requiring auth
│   │   └── dashboard/     # Main dashboard page
│   ├── login/             # Login page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Redirect to dashboard
├── components/            # React components
│   ├── map/               # Map-related components
│   ├── panels/            # Side panels
│   └── ui/                # Reusable UI components
├── lib/                   # Shared utilities
│   ├── db.ts              # Database connection pool
│   ├── auth.ts            # Auth utilities
│   └── ais/               # AIS message parsing
├── services/              # Backend services
│   └── ais-ingester/      # Standalone AIS WebSocket service
└── types/                 # TypeScript types
```

### Pattern 1: AIS WebSocket Ingestion Service
**What:** A separate Node.js service that maintains the WebSocket connection to AISStream.io, parses messages, filters invalid data, and writes to the database.
**When to use:** Always - Vercel functions cannot maintain persistent WebSocket connections.
**Example:**
```typescript
// Source: AISStream.io documentation
import WebSocket from 'ws';

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

ws.on('open', () => {
  ws.send(JSON.stringify({
    APIKey: process.env.AISSTREAM_API_KEY,
    BoundingBoxes: [
      [[10, 30], [35, 80]]  // Middle East + export routes
    ],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
  }));
});

ws.on('message', async (data) => {
  const message = JSON.parse(data.toString());
  // Filter and store position data
});
```

### Pattern 2: TimescaleDB Hypertable for Positions
**What:** Convert regular PostgreSQL table to a time-series optimized hypertable with automatic chunking.
**When to use:** For the vessel_positions table that will grow continuously.
**Example:**
```sql
-- Source: TimescaleDB documentation pattern
CREATE TABLE vessel_positions (
  time TIMESTAMPTZ NOT NULL,
  mmsi BIGINT NOT NULL,
  imo BIGINT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed REAL,
  course REAL,
  heading REAL,
  nav_status INTEGER,
  low_confidence BOOLEAN DEFAULT FALSE,
  raw_message JSONB
);

-- Convert to hypertable with 1-day chunks
SELECT create_hypertable('vessel_positions', 'time', chunk_time_interval => INTERVAL '1 day');

-- Add compression policy (compress after 7 days)
ALTER TABLE vessel_positions SET (timescaledb.compress);
SELECT add_compression_policy('vessel_positions', INTERVAL '7 days');
```

### Pattern 3: Next.js Proxy (Middleware) for Auth
**What:** Use proxy.ts to intercept requests and verify session cookies before allowing access to protected routes.
**When to use:** All protected routes including API endpoints.
**Example:**
```typescript
// Source: Next.js 16 documentation (proxy.ts replaces middleware.ts)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(session, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/vessels/:path*', '/api/positions/:path*']
};
```

### Pattern 4: GeoJSON Source for Efficient Map Rendering
**What:** Use Mapbox GL JS GeoJSON sources with symbol/circle layers instead of individual markers for 500+ vessels.
**When to use:** Always for vessel positions - individual Marker objects don't scale.
**Example:**
```typescript
// Source: Mapbox GL JS documentation
map.on('load', () => {
  map.addSource('vessels', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []  // Updated dynamically
    }
  });

  map.addLayer({
    id: 'vessel-circles',
    type: 'circle',
    source: 'vessels',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 8],
      'circle-color': ['case',
        ['>=', ['get', 'ship_type'], 80],  // Tanker
        '#f59e0b',  // Amber
        '#6b7280'   // Gray
      ]
    }
  });

  map.on('click', 'vessel-circles', (e) => {
    const vessel = e.features[0].properties;
    // Show vessel panel
  });
});
```

### Anti-Patterns to Avoid
- **Individual Marker objects:** Don't create `new mapboxgl.Marker()` for each vessel - use GeoJSON layers
- **Polling AISStream from frontend:** The AIS API doesn't support browser CORS; must use backend proxy
- **Storing passwords in plaintext:** Always hash with bcrypt before storing
- **Synchronous bcrypt:** Use async `bcrypt.hash()` and `bcrypt.compare()` to avoid blocking event loop
- **Direct WebSocket from Vercel functions:** Functions are stateless and timeout; use separate persistent service

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hashing algorithm | bcrypt | Cryptographic security is hard; bcrypt handles salting and timing attacks |
| JWT handling | Manual token parsing | jose library | Edge cases around expiration, algorithm validation, signature verification |
| WebGL map rendering | Canvas-based rendering | Mapbox GL JS | GPU-accelerated; handles projection, tiling, interaction |
| Time-series storage | Manual partitioning | TimescaleDB hypertables | Automatic chunking, compression, efficient time-range queries |
| WebSocket reconnection | Manual reconnect logic | ws library with reconnect wrapper | Exponential backoff, connection state management |
| GPS coordinate validation | Custom validation | PostGIS ST_IsValid or manual bounds check | Edge cases around antimeridian, poles, precision |

**Key insight:** The AIS/maritime domain has solved problems around data quality, coordinate systems, and vessel identity that aren't obvious to newcomers. Trust established libraries over custom solutions.

## Common Pitfalls

### Pitfall 1: MMSI vs IMO Identity Confusion
**What goes wrong:** Using MMSI as the primary vessel identifier, then losing track of vessels that change MMSI.
**Why it happens:** MMSI appears in every AIS message; IMO only in ShipStaticData. Easy to use MMSI as key.
**How to avoid:** Use IMO as primary key in vessels table. Join positions by MMSI but maintain MMSI-to-IMO mapping.
**Warning signs:** Vessel history appears fragmented; same vessel appears as multiple entries.

### Pitfall 2: GPS Jamming False Positives
**What goes wrong:** Filtering out legitimate positions in GPS jamming zones (Persian Gulf, Red Sea).
**Why it happens:** Blanket rejection of positions with speed anomalies.
**How to avoid:** Flag positions as `low_confidence` instead of discarding. Display with visual indicator.
**Warning signs:** Vessels disappear in certain regions, then reappear with no gap detection alert.

### Pitfall 3: Vercel WebSocket Assumption
**What goes wrong:** Assuming Next.js API routes can maintain persistent WebSocket connections.
**Why it happens:** Documentation says "WebSocket handler" but Vercel functions are stateless with 10-30 second timeouts.
**How to avoid:** Run AIS ingestion on Railway/Render/Fly.io with persistent process. Frontend polls or uses SSE.
**Warning signs:** AIS connection drops after function timeout; data stops updating.

### Pitfall 4: GeoJSON Source Re-creation
**What goes wrong:** Calling `map.addSource()` on every data update instead of updating existing source.
**Why it happens:** Copy-paste from examples that only show initial setup.
**How to avoid:** Use `map.getSource('vessels').setData(newGeoJSON)` to update data.
**Warning signs:** Map slows down over time; memory usage increases; "Source already exists" errors.

### Pitfall 5: Blocking Event Loop with bcrypt
**What goes wrong:** Using `bcrypt.hashSync()` or `bcrypt.compareSync()` in API routes.
**Why it happens:** Simpler code without async/await.
**How to avoid:** Always use async versions: `await bcrypt.hash()`, `await bcrypt.compare()`.
**Warning signs:** API latency spikes during login; other requests queue up.

## Code Examples

Verified patterns from official sources:

### AISStream WebSocket Connection
```typescript
// Source: AISStream.io documentation
import WebSocket from 'ws';

interface AISSubscription {
  APIKey: string;
  BoundingBoxes: number[][][];  // [[[minLat, minLon], [maxLat, maxLon]]]
  FilterMessageTypes?: string[];
  FiltersShipMMSI?: string[];
}

const subscription: AISSubscription = {
  APIKey: process.env.AISSTREAM_API_KEY!,
  BoundingBoxes: [
    [[10, 30], [35, 80]]  // Middle East coverage
  ],
  FilterMessageTypes: ['PositionReport', 'ShipStaticData']
};

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

ws.on('open', () => {
  ws.send(JSON.stringify(subscription));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  // message.MessageType: 'PositionReport' | 'ShipStaticData' | etc.
  // message.Message: actual AIS data
  // message.MetaData: { MMSI, ShipName, time_utc, ... }
});
```

### Password Hashing with bcrypt
```typescript
// Source: bcrypt npm documentation
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Hash password for storage (one-time setup)
async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

// Verify password on login
async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

### JWT Session Management with jose
```typescript
// Source: jose GitHub documentation
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function createSession(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
```

### Database Connection Pool
```typescript
// Source: node-postgres documentation
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Parameterized query to prevent SQL injection
async function insertPosition(position: VesselPosition) {
  await pool.query(
    `INSERT INTO vessel_positions (time, mmsi, imo, latitude, longitude, speed, course, heading)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [position.time, position.mmsi, position.imo, position.lat, position.lon,
     position.speed, position.course, position.heading]
  );
}
```

### Mapbox GL JS Click Interaction
```typescript
// Source: Mapbox GL JS documentation
map.on('click', 'vessel-circles', (e) => {
  if (!e.features?.length) return;

  const vessel = e.features[0];
  const coordinates = (vessel.geometry as GeoJSON.Point).coordinates;
  const properties = vessel.properties;

  // Update selected vessel state
  setSelectedVessel({
    mmsi: properties.mmsi,
    imo: properties.imo,
    name: properties.name,
    speed: properties.speed,
    heading: properties.heading,
    destination: properties.destination
  });
});

// Change cursor on hover
map.on('mouseenter', 'vessel-circles', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'vessel-circles', () => {
  map.getCanvas().style.cursor = '';
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js middleware.ts | proxy.ts | Next.js 16.0.0 | File renamed; functionality identical |
| Pages Router | App Router | Next.js 13+ (stable in 14+) | Server Components, nested layouts, streaming |
| Individual map markers | GeoJSON sources + layers | Always for 100+ points | Order of magnitude performance improvement |
| REST API polling for AIS | WebSocket + real-time updates | Standard practice | Lower latency, less server load |
| Raw PostgreSQL for time-series | TimescaleDB hypertables | When storing continuous time-series data | 10-100x query performance for time-range queries |

**Deprecated/outdated:**
- `middleware.ts`: Renamed to `proxy.ts` in Next.js 16 (codemod available: `npx @next/codemod middleware-to-proxy .`)
- `getServerSideProps`: Use Server Components with async data fetching in App Router
- Mapbox GL JS v2: v3 is current (3.19.1 as of research date)

## Open Questions

1. **AIS Ingestion Hosting Decision**
   - What we know: Vercel cannot run persistent WebSocket connections; Railway and Render both support long-running Node.js services
   - What's unclear: Exact pricing for Railway at expected message volume (~300 msg/sec for global, less for regional filter)
   - Recommendation: Start with Railway free tier; monitor usage; upgrade if needed

2. **TimescaleDB Extension Availability**
   - What we know: Neon PostgreSQL supports TimescaleDB extension
   - What's unclear: Whether TimescaleDB compression policies work on Neon free tier or require paid plan
   - Recommendation: Create hypertable without compression initially; add compression policy if Neon supports it

3. **Ship Type Code Accuracy**
   - What we know: AIS ship type codes 80-89 are tankers (crude oil, chemical, LPG, etc.)
   - What's unclear: How reliably vessels broadcast correct ship type; some may broadcast incorrect codes
   - Recommendation: Filter by type codes but allow "show all" toggle for verification

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (compatible with Vite/Next.js) |
| Config file | none - see Wave 0 |
| Quick run command | `npm run test` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | AIS WebSocket ingestion parses messages | unit | `npm run test -- src/lib/ais/parser.test.ts` | Wave 0 |
| DATA-02 | Position inserted to database | integration | `npm run test -- src/lib/db/positions.test.ts` | Wave 0 |
| DATA-03 | IMO extracted from ShipStaticData | unit | `npm run test -- src/lib/ais/parser.test.ts` | Wave 0 |
| DATA-04 | Invalid positions filtered (speed >50kt) | unit | `npm run test -- src/lib/ais/filter.test.ts` | Wave 0 |
| AUTH-01 | Password verification works | unit | `npm run test -- src/lib/auth.test.ts` | Wave 0 |
| MAP-01 | GeoJSON generated from vessel data | unit | `npm run test -- src/lib/map/geojson.test.ts` | Wave 0 |
| MAP-02 | Vessel click returns correct properties | e2e | Playwright - manual verification initially | Wave 0 |
| MAP-03 | Filter excludes non-tankers | unit | `npm run test -- src/lib/map/filter.test.ts` | Wave 0 |
| MAP-04 | Track history returns LineString | unit | `npm run test -- src/lib/map/tracks.test.ts` | Wave 0 |
| MAP-05 | Data freshness calculated correctly | unit | `npm run test -- src/components/freshness.test.ts` | Wave 0 |
| MAP-08 | Mobile layout renders correctly | e2e | Playwright viewport test - manual initially | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** Full suite + manual map interaction verification
- **Phase gate:** Full suite green + manual e2e verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` - Vitest configuration
- [ ] `tests/setup.ts` - Test environment setup (mocks, database)
- [ ] `src/lib/ais/parser.test.ts` - AIS message parsing tests
- [ ] `src/lib/auth.test.ts` - Auth utility tests
- [ ] `playwright.config.ts` - E2E test configuration (if needed)
- [ ] Framework install: `npm install -D vitest @testing-library/react happy-dom`

## Sources

### Primary (HIGH confidence)
- AISStream.io documentation - WebSocket API, subscription format, message types
- Next.js 16.1.6 documentation - Route handlers, proxy.ts (middleware), cookies API
- Mapbox GL JS 3.19.1 documentation - GeoJSON sources, layers, click interactions
- node-postgres documentation - Pool, parameterized queries
- bcrypt npm documentation - Hash, compare, salt rounds
- jose GitHub documentation - JWT signing, verification

### Secondary (MEDIUM confidence)
- Neon PostgreSQL pricing page - Free tier, TimescaleDB support, connection pooling
- Vitest documentation - Configuration, React testing
- deck.gl documentation - ScatterplotLayer for high-volume point rendering (alternative approach)

### Tertiary (LOW confidence)
- TimescaleDB documentation (via redirect) - Hypertable creation syntax, compression policies (needs direct verification on Neon)
- Railway PostgreSQL pricing - Needs direct verification for long-running service costs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are mature, well-documented, widely used
- Architecture: HIGH - Patterns verified from official documentation
- Pitfalls: HIGH - Common issues documented in multiple sources
- Validation: MEDIUM - Test framework recommendations standard but untested on this specific stack

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable technologies)

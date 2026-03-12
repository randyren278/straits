# Phase 3: Anomaly Detection - Research

**Researched:** 2026-03-11
**Domain:** AIS Gap Detection, Route Anomaly Analysis, Vessel Watchlisting, Alert Systems
**Confidence:** HIGH

## Summary

This phase implements the "something's wrong" detection layer: identifying vessels that disable AIS transponders (going dark), vessels exhibiting suspicious patterns (loitering, deviation), and allowing users to monitor specific vessels via watchlist with in-app alerts. The core technical challenges are: (1) defining AIS coverage zones to distinguish genuine signal loss from intentional transponder disabling, (2) implementing efficient scheduled detection jobs that analyze position history patterns, and (3) creating a session-based watchlist system with real-time alert generation.

The existing codebase provides solid foundations: TimescaleDB hypertables for efficient time-range queries on positions, the chokepoints.ts bounding box pattern for geographic zone checks, the node-cron dependency already installed, and the Zustand store pattern for UI state management. The anomaly detection logic is pure geometry and time-series analysis - no ML required. Detection runs as scheduled cron jobs in the AIS ingester service (which already maintains persistent state on Railway/Render).

**Primary recommendation:** Extend the AIS ingester service with node-cron jobs for going-dark (15-min) and route anomaly (30-min) detection. Store anomalies in a `vessel_anomalies` table with JSONB details. Implement watchlist as session-based (localStorage user_id) with `watchlist` and `alerts` tables. UI extends existing patterns: badges on markers, sections in VesselPanel, notification bell in Header, watchlist sidebar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Going Dark Detection (ANOM-01):**
  - Definition: No position update for >2 hours in terrestrial AIS coverage zone
  - Confidence levels: Confirmed (>4h), Suspected (2-4h), Unknown (outside coverage)
  - Coverage zones: Persian Gulf, Red Sea shipping lanes, Suez approaches
  - Detection: Scheduled job checks `vessels.last_seen` against coverage zone polygons
  - Storage: `vessel_anomalies` table with imo, anomaly_type, detected_at, confidence, resolved_at, details (JSONB)
  - Display: Yellow (suspected) or red (confirmed) "DARK" badge on vessel marker and panel

- **Route Anomaly Detection (ANOM-02):**
  - Loitering: Stays within 5nm radius for >6 hours outside port/anchorage
  - Deviation: Heading differs >45 degrees from expected route to destination for >2 hours
  - Speed anomaly: Tanker <3 knots outside port/anchorage (drifting/disabled)
  - Known anchorages: Predefined list (Fujairah, Kharg Island, Ras Tanura, etc.)
  - Display: Orange badge with anomaly type, details in vessel panel

- **Watchlist & Alerts (HIST-02):**
  - Storage: `watchlist` table with user_id (session-based), imo, added_at, notes
  - Alert triggers: Watched vessel triggers anomaly OR enters/exits chokepoint
  - Alert delivery: In-app notification panel (bell icon), no email/push for v1
  - Alert storage: `alerts` table with id, imo, alert_type, triggered_at, read_at, details
  - UI: "Add to watchlist" button in vessel panel, watchlist sidebar, notification bell with unread count

- **Detection Scheduling:**
  - Going dark check: Every 15 minutes (cron)
  - Route anomaly check: Every 30 minutes (cron)
  - Alert generation: On anomaly detection, check if vessel is in any watchlist

- **UI Integration:**
  - Anomaly badges on vessel markers (color-coded)
  - Anomaly section in vessel panel with timestamps
  - Watchlist panel: collapsible sidebar
  - Notification bell: header, unread count, dropdown
  - Anomaly filter toggle in header

- **Carrying Forward:**
  - Dark theme (#1a1a2e background)
  - Bloomberg-terminal information density
  - Vessel panel pattern (right side, 320px)
  - Badge pattern from sanctions (red dot on markers)
  - Zustand store pattern for UI state
  - API route pattern with pool.query

### Claude's Discretion
- Exact anomaly badge styling and icons
- Notification dropdown design
- Watchlist panel layout details
- Alert sound/animation (if any)
- Exact timing thresholds (can tune based on real data)

### Deferred Ideas (OUT OF SCOPE)
- Historical analytics charts - Phase 4
- Oil price correlation with traffic - Phase 4
- Ship-to-ship transfer detection (proximity analysis) - v2
- Dark fleet identification (flag-hopping patterns) - v2
- Email/push notifications - v2

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANOM-01 | System detects and flags vessels that disable AIS transponders (going dark) | Coverage zone polygons for terrestrial AIS; `vessel_anomalies` table; 15-min cron job comparing `last_seen` against coverage zones; confidence levels based on duration |
| ANOM-02 | System detects route anomalies including loitering and unusual deviations | Position history analysis with Haversine distance; anchorage polygon definitions; 30-min cron job; heading deviation calculation from destination bearing |
| HIST-02 | User can create vessel watchlist and receive alerts on watched vessels | Session-based user_id via localStorage; `watchlist` and `alerts` tables; alert generation on anomaly detection; notification bell UI component |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^4.2.1 (existing) | Schedule detection jobs | Already installed, built-in TypeScript types, handles cron expressions |
| pg | ^8.20.0 (existing) | Database queries | Already used throughout project |
| zustand | ^5.0.11 (existing) | UI state for watchlist/alerts | Extends existing store pattern |
| lucide-react | ^0.577.0 (existing) | Icons (bell, eye, alert) | Already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 (existing) | Format alert timestamps, relative times | Already installed |
| uuid | ^9.x | Generate session user_id | For watchlist user identification |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple bounds check | PostGIS ST_Contains | PostGIS more precise but overkill for rectangular zones; bounds check is 10x simpler and sufficient |
| localStorage user_id | Full session auth | Full auth adds complexity; localStorage is sufficient for personal project with shared password |
| node-cron | pg_cron | pg_cron runs in database but harder to debug; node-cron keeps logic in TypeScript codebase |
| JSONB details column | Normalized columns | JSONB allows flexible anomaly details without schema changes per type |

**Installation:**
```bash
npm install uuid
npm install -D @types/uuid
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       ├── anomalies/
│       │   └── route.ts           # NEW: Get anomalies for vessels
│       ├── watchlist/
│       │   └── route.ts           # NEW: CRUD watchlist entries
│       └── alerts/
│           └── route.ts           # NEW: Get/mark alerts
├── components/
│   ├── panels/
│   │   ├── VesselPanel.tsx        # EXTEND: Add anomaly section, watchlist button
│   │   └── WatchlistPanel.tsx     # NEW: Collapsible watchlist sidebar
│   ├── ui/
│   │   ├── Header.tsx             # EXTEND: Add notification bell, anomaly filter
│   │   ├── NotificationBell.tsx   # NEW: Bell icon with dropdown
│   │   └── AnomalyBadge.tsx       # NEW: Reusable anomaly badge component
│   └── map/
│       └── VesselMap.tsx          # EXTEND: Anomaly badge colors on markers
├── lib/
│   ├── db/
│   │   ├── schema.sql             # EXTEND: anomalies, watchlist, alerts tables
│   │   ├── anomalies.ts           # NEW: Anomaly CRUD
│   │   ├── watchlist.ts           # NEW: Watchlist CRUD
│   │   └── alerts.ts              # NEW: Alerts CRUD
│   ├── detection/
│   │   ├── going-dark.ts          # NEW: Going dark detection logic
│   │   ├── loitering.ts           # NEW: Loitering detection logic
│   │   ├── deviation.ts           # NEW: Route deviation detection logic
│   │   └── coverage-zones.ts      # NEW: AIS coverage zone definitions
│   └── geo/
│       ├── chokepoints.ts         # EXISTING: Extend with isInAnchorage
│       ├── anchorages.ts          # NEW: Known anchorage polygons
│       └── haversine.ts           # NEW: Distance calculation
├── services/
│   └── ais-ingester/
│       ├── index.ts               # EXTEND: Add detection cron jobs
│       └── detection-jobs.ts      # NEW: Cron job definitions
├── stores/
│   └── vessel.ts                  # EXTEND: watchlist, alerts, anomalyFilter state
└── types/
    └── anomaly.ts                 # NEW: Anomaly, Alert, Watchlist types
```

### Pattern 1: Going Dark Detection Algorithm
**What:** Compare vessel's `last_seen` against coverage zones to detect AIS gaps
**When to use:** 15-minute scheduled job
**Example:**
```typescript
// src/lib/detection/going-dark.ts
import { pool } from '../db';
import { isInCoverageZone } from './coverage-zones';

interface GapCandidate {
  imo: string;
  lastSeen: Date;
  lastLat: number;
  lastLon: number;
  gapMinutes: number;
}

export async function detectGoingDark(): Promise<void> {
  // Find vessels with no update in >2 hours
  const result = await pool.query<GapCandidate>(`
    SELECT v.imo, v.last_seen as "lastSeen",
           p.latitude as "lastLat", p.longitude as "lastLon",
           EXTRACT(EPOCH FROM (NOW() - v.last_seen)) / 60 as "gapMinutes"
    FROM vessels v
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = v.mmsi ORDER BY time DESC LIMIT 1
    ) p ON true
    WHERE v.last_seen < NOW() - INTERVAL '2 hours'
      AND v.ship_type BETWEEN 80 AND 89  -- Tankers only
  `);

  for (const vessel of result.rows) {
    // Only flag if last position was in coverage zone
    if (!isInCoverageZone(vessel.lastLat, vessel.lastLon)) {
      continue; // Open ocean - satellite gap is normal
    }

    const confidence = vessel.gapMinutes >= 240 ? 'confirmed' : 'suspected';

    await upsertAnomaly({
      imo: vessel.imo,
      anomalyType: 'going_dark',
      confidence,
      detectedAt: new Date(),
      details: {
        lastPosition: { lat: vessel.lastLat, lon: vessel.lastLon },
        gapMinutes: Math.round(vessel.gapMinutes),
      },
    });
  }

  // Resolve anomalies for vessels that have reported back
  await pool.query(`
    UPDATE vessel_anomalies
    SET resolved_at = NOW()
    WHERE anomaly_type = 'going_dark'
      AND resolved_at IS NULL
      AND imo IN (
        SELECT imo FROM vessels WHERE last_seen > NOW() - INTERVAL '30 minutes'
      )
  `);
}
```

### Pattern 2: Loitering Detection with Position History
**What:** Analyze position history to detect vessels staying in small radius
**When to use:** 30-minute scheduled job for route anomalies
**Example:**
```typescript
// src/lib/detection/loitering.ts
import { pool } from '../db';
import { haversineDistance } from '../geo/haversine';
import { isInAnchorage } from '../geo/anchorages';

export async function detectLoitering(): Promise<void> {
  // Get positions from last 6 hours for tankers
  const result = await pool.query(`
    SELECT v.imo, v.mmsi,
           array_agg(json_build_object(
             'lat', p.latitude,
             'lon', p.longitude,
             'time', p.time
           ) ORDER BY p.time) as positions
    FROM vessels v
    JOIN vessel_positions p ON p.mmsi = v.mmsi
    WHERE v.ship_type BETWEEN 80 AND 89
      AND p.time > NOW() - INTERVAL '6 hours'
    GROUP BY v.imo, v.mmsi
    HAVING COUNT(*) >= 3  -- Need at least 3 positions
  `);

  for (const vessel of result.rows) {
    const positions = vessel.positions;
    if (positions.length < 3) continue;

    // Calculate centroid and max distance from centroid
    const centroid = calculateCentroid(positions);
    const maxDistance = Math.max(
      ...positions.map((p: any) => haversineDistance(centroid.lat, centroid.lon, p.lat, p.lon))
    );

    // Loitering: stayed within 5nm (9.26km) radius for 6+ hours
    const isLoitering = maxDistance < 9.26; // km

    if (isLoitering && !isInAnchorage(centroid.lat, centroid.lon)) {
      await upsertAnomaly({
        imo: vessel.imo,
        anomalyType: 'loitering',
        confidence: 'confirmed',
        detectedAt: new Date(),
        details: {
          centroid,
          radiusKm: maxDistance,
          durationHours: 6,
        },
      });
    }
  }
}

function calculateCentroid(positions: {lat: number, lon: number}[]) {
  const sumLat = positions.reduce((s, p) => s + p.lat, 0);
  const sumLon = positions.reduce((s, p) => s + p.lon, 0);
  return { lat: sumLat / positions.length, lon: sumLon / positions.length };
}
```

### Pattern 3: Session-Based Watchlist with Alert Generation
**What:** Track user's watched vessels and generate alerts on events
**When to use:** Watchlist CRUD and alert triggers
**Example:**
```typescript
// src/lib/db/watchlist.ts
import { pool } from './index';

export interface WatchlistEntry {
  userId: string;
  imo: string;
  addedAt: Date;
  notes: string | null;
}

export async function addToWatchlist(userId: string, imo: string, notes?: string): Promise<void> {
  await pool.query(
    `INSERT INTO watchlist (user_id, imo, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, imo) DO UPDATE SET notes = EXCLUDED.notes`,
    [userId, imo, notes || null]
  );
}

export async function removeFromWatchlist(userId: string, imo: string): Promise<void> {
  await pool.query(
    `DELETE FROM watchlist WHERE user_id = $1 AND imo = $2`,
    [userId, imo]
  );
}

export async function getUserWatchlist(userId: string): Promise<WatchlistEntry[]> {
  const result = await pool.query(
    `SELECT user_id as "userId", imo, added_at as "addedAt", notes
     FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC`,
    [userId]
  );
  return result.rows;
}

// Called after anomaly detection to generate alerts for watchers
export async function generateAlertsForAnomaly(imo: string, anomalyType: string, details: object): Promise<void> {
  await pool.query(
    `INSERT INTO alerts (user_id, imo, alert_type, details)
     SELECT user_id, $1, $2, $3
     FROM watchlist WHERE imo = $1`,
    [imo, anomalyType, JSON.stringify(details)]
  );
}
```

### Anti-Patterns to Avoid
- **Running detection on every position update:** Expensive at scale. Use scheduled batch jobs instead.
- **Storing detection history in memory:** Service restarts lose state. Use database for anomaly persistence.
- **Hardcoding threshold values:** Extract to config/constants for tuning based on real data.
- **Full user auth for watchlist:** Overkill for friend group. Session-based localStorage is sufficient.
- **Real-time WebSocket for alerts:** Polling every 30s is simpler and sufficient for this use case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance calculation | Custom lat/lon math | Haversine formula (well-tested) | Spherical geometry has edge cases at poles, date line |
| Session ID generation | Random strings | uuid v4 | Cryptographically secure, collision-free |
| Cron scheduling | setInterval | node-cron | Handles timezone, restart recovery, cron syntax |
| Polygon containment | Custom algorithm | Bounding box check | For rectangles, simple bounds is sufficient |
| Relative time display | Manual string building | date-fns formatDistanceToNow | Handles i18n, edge cases |

**Key insight:** Anomaly detection is about consistent, reproducible rules applied to time-series data. Keep the logic simple (geometry, time comparisons) and the thresholds configurable.

## Common Pitfalls

### Pitfall 1: False Positives from Open Ocean Gaps
**What goes wrong:** Flagging vessels as "going dark" when they're in satellite-only coverage areas
**Why it happens:** Not distinguishing terrestrial AIS coverage from satellite gaps
**How to avoid:** Define explicit coverage zone polygons; only flag gaps within those zones
**Warning signs:** Many "going dark" alerts for vessels in open ocean (Gulf of Aden, Arabian Sea)

### Pitfall 2: Anchorage Misclassification
**What goes wrong:** Flagging vessels legitimately waiting at Fujairah anchorage as "loitering"
**Why it happens:** Anchorage polygons not defined or too small
**How to avoid:** Define generous anchorage zones; exclude port approaches; use AIS destination field as hint
**Warning signs:** Loitering alerts at known anchorage areas

### Pitfall 3: Stale Anomaly Persistence
**What goes wrong:** Resolved anomalies remain flagged after vessel reports back
**Why it happens:** Detection job creates anomalies but resolution logic not implemented
**How to avoid:** Every detection job must also resolve cleared conditions; use `resolved_at` timestamp
**Warning signs:** Vessels showing "DARK" badge despite having recent positions

### Pitfall 4: Alert Spam from Repeated Detection
**What goes wrong:** Same anomaly generates duplicate alerts every detection cycle
**Why it happens:** Not checking if anomaly already exists before creating alert
**How to avoid:** Only generate alerts for NEW anomalies (created this cycle); use `created_at` comparison
**Warning signs:** Notification bell shows 50+ alerts for same vessel

### Pitfall 5: Session ID Loss on Browser Clear
**What goes wrong:** User clears localStorage, loses their watchlist
**Why it happens:** Session-based approach ties data to browser storage
**How to avoid:** This is acceptable for v1; document the limitation; cookie fallback optional
**Warning signs:** Users report losing watchlist after clearing cache

## Code Examples

Verified patterns for this phase:

### Database Schema Extensions
```sql
-- src/lib/db/schema.sql (Phase 3 additions)

-- =============================================================================
-- Phase 3: Anomaly Detection
-- =============================================================================

-- Vessel anomalies table (ANOM-01, ANOM-02)
-- Stores detected anomalies with type-specific details in JSONB
CREATE TABLE IF NOT EXISTS vessel_anomalies (
  id SERIAL PRIMARY KEY,
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  anomaly_type VARCHAR(50) NOT NULL,           -- 'going_dark', 'loitering', 'deviation', 'speed'
  confidence VARCHAR(20) DEFAULT 'confirmed',  -- 'confirmed', 'suspected', 'unknown'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,                     -- NULL = still active
  details JSONB,                               -- Type-specific data (last position, radius, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active anomalies (resolved_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_anomalies_active ON vessel_anomalies(imo, anomaly_type)
  WHERE resolved_at IS NULL;

-- Index for efficient lookup by type
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON vessel_anomalies(anomaly_type, detected_at DESC);

-- User watchlist table (HIST-02)
-- Session-based user tracking without full auth
CREATE TABLE IF NOT EXISTS watchlist (
  user_id VARCHAR(50) NOT NULL,               -- UUID from localStorage
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, imo)
);

-- Index for user's watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, added_at DESC);

-- User alerts table (HIST-02)
-- Notifications for watched vessels
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  alert_type VARCHAR(50) NOT NULL,            -- 'going_dark', 'loitering', 'chokepoint_enter', etc.
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,                        -- NULL = unread
  details JSONB                               -- Context about the alert
);

-- Index for unread alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, triggered_at DESC)
  WHERE read_at IS NULL;
```

### AIS Coverage Zones Definition
```typescript
// src/lib/detection/coverage-zones.ts
// Terrestrial AIS coverage zones in Middle East
// Going dark detection only applies within these zones

export interface CoverageZone {
  id: string;
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export const COVERAGE_ZONES: CoverageZone[] = [
  {
    id: 'persian_gulf',
    name: 'Persian Gulf',
    bounds: { minLat: 23.5, maxLat: 30.5, minLon: 47.5, maxLon: 57.0 },
  },
  {
    id: 'red_sea_north',
    name: 'Red Sea (North)',
    bounds: { minLat: 20.0, maxLat: 30.0, minLon: 32.0, maxLon: 44.0 },
  },
  {
    id: 'red_sea_south',
    name: 'Red Sea (South) / Bab el-Mandeb',
    bounds: { minLat: 12.0, maxLat: 20.0, minLon: 38.0, maxLon: 45.0 },
  },
  {
    id: 'suez_approaches',
    name: 'Suez Approaches',
    bounds: { minLat: 29.0, maxLat: 32.5, minLon: 31.5, maxLon: 35.0 },
  },
  {
    id: 'oman_coast',
    name: 'Gulf of Oman Coast',
    bounds: { minLat: 22.0, maxLat: 26.5, minLon: 56.0, maxLon: 61.0 },
  },
];

export function isInCoverageZone(lat: number, lon: number): boolean {
  return COVERAGE_ZONES.some(zone =>
    lat >= zone.bounds.minLat && lat <= zone.bounds.maxLat &&
    lon >= zone.bounds.minLon && lon <= zone.bounds.maxLon
  );
}

export function getCoverageZone(lat: number, lon: number): CoverageZone | null {
  return COVERAGE_ZONES.find(zone =>
    lat >= zone.bounds.minLat && lat <= zone.bounds.maxLat &&
    lon >= zone.bounds.minLon && lon <= zone.bounds.maxLon
  ) || null;
}
```

### Known Anchorages Definition
```typescript
// src/lib/geo/anchorages.ts
// Known anchorage areas to exclude from loitering detection

export interface Anchorage {
  id: string;
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export const ANCHORAGES: Anchorage[] = [
  {
    id: 'fujairah',
    name: 'Fujairah Anchorage',
    bounds: { minLat: 25.0, maxLat: 25.4, minLon: 56.2, maxLon: 56.7 },
  },
  {
    id: 'kharg_island',
    name: 'Kharg Island Anchorage',
    bounds: { minLat: 29.1, maxLat: 29.4, minLon: 50.1, maxLon: 50.5 },
  },
  {
    id: 'ras_tanura',
    name: 'Ras Tanura Anchorage',
    bounds: { minLat: 26.5, maxLat: 27.0, minLon: 49.8, maxLon: 50.3 },
  },
  {
    id: 'jebel_ali',
    name: 'Jebel Ali Anchorage',
    bounds: { minLat: 24.9, maxLat: 25.1, minLon: 54.8, maxLon: 55.2 },
  },
  {
    id: 'mina_al_ahmadi',
    name: 'Mina Al Ahmadi Anchorage',
    bounds: { minLat: 28.9, maxLat: 29.2, minLon: 48.0, maxLon: 48.4 },
  },
  {
    id: 'yanbu',
    name: 'Yanbu Anchorage',
    bounds: { minLat: 23.8, maxLat: 24.2, minLon: 37.8, maxLon: 38.3 },
  },
  {
    id: 'jeddah',
    name: 'Jeddah Anchorage',
    bounds: { minLat: 21.3, maxLat: 21.7, minLon: 38.9, maxLon: 39.3 },
  },
  {
    id: 'suez_waiting',
    name: 'Suez Canal Waiting Area',
    bounds: { minLat: 29.8, maxLat: 30.2, minLon: 32.3, maxLon: 32.7 },
  },
];

export function isInAnchorage(lat: number, lon: number): boolean {
  return ANCHORAGES.some(anch =>
    lat >= anch.bounds.minLat && lat <= anch.bounds.maxLat &&
    lon >= anch.bounds.minLon && lon <= anch.bounds.maxLon
  );
}

export function getAnchorage(lat: number, lon: number): Anchorage | null {
  return ANCHORAGES.find(anch =>
    lat >= anch.bounds.minLat && lat <= anch.bounds.maxLat &&
    lon >= anch.bounds.minLon && lon <= anch.bounds.maxLon
  ) || null;
}
```

### Haversine Distance Formula
```typescript
// src/lib/geo/haversine.ts
// Calculate distance between two coordinates in kilometers

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate bearing from point 1 to point 2.
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(x, y) * (180 / Math.PI);
  return (bearing + 360) % 360;
}
```

### Anomaly Types Definition
```typescript
// src/types/anomaly.ts
// Type definitions for anomaly detection system

export type AnomalyType = 'going_dark' | 'loitering' | 'deviation' | 'speed';
export type Confidence = 'confirmed' | 'suspected' | 'unknown';

export interface Anomaly {
  id: number;
  imo: string;
  anomalyType: AnomalyType;
  confidence: Confidence;
  detectedAt: Date;
  resolvedAt: Date | null;
  details: GoingDarkDetails | LoiteringDetails | DeviationDetails | SpeedDetails;
}

export interface GoingDarkDetails {
  lastPosition: { lat: number; lon: number };
  gapMinutes: number;
  coverageZone: string;
}

export interface LoiteringDetails {
  centroid: { lat: number; lon: number };
  radiusKm: number;
  durationHours: number;
}

export interface DeviationDetails {
  expectedHeading: number;
  actualHeading: number;
  deviationDegrees: number;
  destination: string;
}

export interface SpeedDetails {
  speedKnots: number;
  lastPosition: { lat: number; lon: number };
}

export interface WatchlistEntry {
  userId: string;
  imo: string;
  addedAt: Date;
  notes: string | null;
}

export interface Alert {
  id: number;
  userId: string;
  imo: string;
  alertType: string;
  triggeredAt: Date;
  readAt: Date | null;
  details: object;
}
```

### Cron Job Integration in AIS Ingester
```typescript
// src/services/ais-ingester/detection-jobs.ts
// Add to ais-ingester service

import cron from 'node-cron';
import { detectGoingDark } from '../../lib/detection/going-dark';
import { detectLoitering, detectDeviation, detectSpeedAnomaly } from '../../lib/detection/route-anomalies';
import { generateAlertsForNewAnomalies } from '../../lib/db/alerts';

export function startDetectionJobs(): void {
  console.log('Starting anomaly detection cron jobs...');

  // Going dark detection every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Running going dark detection...');
    try {
      const count = await detectGoingDark();
      console.log(`[CRON] Going dark: ${count} anomalies detected/updated`);
      await generateAlertsForNewAnomalies('going_dark');
    } catch (err) {
      console.error('[CRON] Going dark detection error:', err);
    }
  });

  // Route anomaly detection every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running route anomaly detection...');
    try {
      await detectLoitering();
      await detectDeviation();
      await detectSpeedAnomaly();
      console.log('[CRON] Route anomaly detection complete');
      await generateAlertsForNewAnomalies('loitering');
      await generateAlertsForNewAnomalies('deviation');
      await generateAlertsForNewAnomalies('speed');
    } catch (err) {
      console.error('[CRON] Route anomaly detection error:', err);
    }
  });

  console.log('Detection cron jobs scheduled');
}
```

### Notification Bell Component
```typescript
// src/components/ui/NotificationBell.tsx
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: number;
  imo: string;
  vesselName: string;
  alertType: string;
  triggeredAt: string;
  readAt: string | null;
}

export function NotificationBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get or create session ID
    let id = localStorage.getItem('tanker_tracker_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tanker_tracker_user_id', id);
    }
    setUserId(id);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchAlerts = async () => {
      const res = await fetch(`/api/alerts?userId=${userId}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [userId]);

  const unreadCount = alerts.filter(a => !a.readAt).length;

  const markAsRead = async (alertId: number) => {
    await fetch(`/api/alerts/${alertId}/read`, { method: 'POST' });
    setAlerts(alerts.map(a =>
      a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a
    ));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#1e1e3f] border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <span className="font-semibold text-white">Alerts</span>
          </div>
          {alerts.length === 0 ? (
            <div className="p-4 text-gray-400 text-center">No alerts</div>
          ) : (
            alerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => markAsRead(alert.id)}
                className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-[#252550] ${
                  !alert.readAt ? 'bg-[#1a1a40]' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-white">{alert.vesselName}</span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {alert.alertType === 'going_dark' && 'Went dark (AIS gap detected)'}
                  {alert.alertType === 'loitering' && 'Loitering detected'}
                  {alert.alertType === 'chokepoint_enter' && 'Entered chokepoint'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ML-based anomaly detection | Rule-based geometry + time | Still current | ML adds complexity without benefit for clear-cut anomalies (gaps, loitering) |
| Full auth for watchlist | Session-based localStorage | Still acceptable | Reduces complexity for small user base |
| Real-time WebSocket alerts | Polling (30s) | Still appropriate | WebSocket overkill for low-frequency alerts |
| Complex polygon containment | Simple bounding boxes | Still appropriate | Rectangular coverage zones don't need PostGIS |

**Deprecated/outdated:**
- Complex ML anomaly detection: For this use case, simple rules are more explainable and debuggable
- Full user auth systems: Overkill for password-protected friend group dashboard

## Open Questions

1. **Coverage Zone Boundary Precision**
   - What we know: General terrestrial AIS coverage areas
   - What's unclear: Exact boundaries where coverage becomes unreliable
   - Recommendation: Start with generous zones, refine based on false positive feedback

2. **Loitering Duration Threshold**
   - What we know: CONTEXT.md specifies 6 hours
   - What's unclear: Whether this is too aggressive or too lenient
   - Recommendation: Start at 6 hours, make configurable for tuning

3. **Watchlist User Persistence**
   - What we know: localStorage can be cleared by users
   - What's unclear: How often this will be a problem in practice
   - Recommendation: Accept for v1; document limitation; consider cookie backup later

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANOM-01 | Going dark detection identifies AIS gaps | unit | `npm test -- --run src/lib/detection/going-dark.test.ts` | Wave 0 |
| ANOM-01 | Coverage zone containment check | unit | `npm test -- --run src/lib/detection/coverage-zones.test.ts` | Wave 0 |
| ANOM-02 | Loitering detection with Haversine distance | unit | `npm test -- --run src/lib/detection/loitering.test.ts` | Wave 0 |
| ANOM-02 | Anchorage exclusion works correctly | unit | `npm test -- --run src/lib/geo/anchorages.test.ts` | Wave 0 |
| ANOM-02 | Haversine distance calculation accurate | unit | `npm test -- --run src/lib/geo/haversine.test.ts` | Wave 0 |
| HIST-02 | Watchlist CRUD operations | unit | `npm test -- --run src/lib/db/watchlist.test.ts` | Wave 0 |
| HIST-02 | Alert generation for watched vessels | unit | `npm test -- --run src/lib/db/alerts.test.ts` | Wave 0 |
| HIST-02 | Anomalies table CRUD | unit | `npm test -- --run src/lib/db/anomalies.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/detection/going-dark.test.ts` - covers ANOM-01 detection logic
- [ ] `src/lib/detection/coverage-zones.test.ts` - covers coverage zone containment
- [ ] `src/lib/detection/loitering.test.ts` - covers ANOM-02 loitering detection
- [ ] `src/lib/geo/anchorages.test.ts` - covers anchorage exclusion
- [ ] `src/lib/geo/haversine.test.ts` - covers distance and bearing calculations
- [ ] `src/lib/db/watchlist.test.ts` - covers HIST-02 watchlist CRUD
- [ ] `src/lib/db/alerts.test.ts` - covers HIST-02 alert generation
- [ ] `src/lib/db/anomalies.test.ts` - covers anomaly CRUD operations

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns: `src/lib/geo/chokepoints.ts`, `src/stores/vessel.ts`, `src/lib/db/vessels.ts`
- Phase 2 research: `.planning/phases/02-intelligence-layers/02-RESEARCH.md`
- CONTEXT.md decisions: `.planning/phases/03-anomaly-detection/03-CONTEXT.md`
- node-cron package documentation: v4.x built-in TypeScript types

### Secondary (MEDIUM confidence)
- Haversine formula: Well-established mathematical formula for great-circle distance
- AIS coverage patterns: General knowledge of terrestrial vs satellite AIS coverage

### Tertiary (LOW confidence)
- Exact coverage zone boundaries: Based on general Middle East AIS infrastructure knowledge; will need refinement with real position data
- Anchorage coordinates: Approximate based on general maritime knowledge; may need adjustment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - extends existing patterns, uses installed dependencies
- Architecture: HIGH - follows established project patterns
- Detection algorithms: HIGH - simple geometry, well-understood math
- Coverage zones: MEDIUM - coordinates approximate, may need tuning
- Threshold values: MEDIUM - CONTEXT.md specifies values but may need adjustment with real data
- Pitfalls: HIGH - common issues in anomaly detection systems

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - detection patterns are stable)

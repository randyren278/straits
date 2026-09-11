/**
 * Current watch — data gathering. Server-only (imports the pool).
 *
 * One query per fact family, all bounded to recent windows so this stays
 * cheap enough to poll every minute from the dashboard.
 */
import { pool } from '../db';
import { CHOKEPOINTS } from '../geo/chokepoints-constants';
import { getChokepointSpcBand } from '../detection/spc-index';
import { VESSEL_STALENESS_INTERVAL } from '../constants/staleness';
import { composeWatch, type EventFact, type ZoneTrafficFact, type ZoneCoverageFact, type WatchItem } from './compose';

/** How many recent events to consider before ranking. */
const EVENT_CANDIDATES = 20;

interface EventRow {
  imo: string;
  mmsi: string | null;
  name: string | null;
  anomaly_type: string;
  confidence: string;
  detected_at: Date;
  is_sanctioned: boolean;
  risk_category: string | null;
  risk_score: number | null;
  latitude: number | null;
  longitude: number | null;
}

async function loadEvents(): Promise<EventFact[]> {
  const result = await pool.query<EventRow>(`
    SELECT va.imo, v.mmsi, v.name, va.anomaly_type, va.confidence, va.detected_at,
           (vs.imo IS NOT NULL) AS is_sanctioned,
           vs.risk_category,
           rs.score AS risk_score,
           lp.latitude, lp.longitude
    FROM vessel_anomalies va
    LEFT JOIN vessels v ON v.imo = va.imo
    LEFT JOIN vessel_sanctions vs ON vs.imo = va.imo
    LEFT JOIN vessel_risk_scores rs ON rs.imo = va.imo
    JOIN LATERAL (
      SELECT latitude, longitude
      FROM vessel_positions vp
      WHERE vp.mmsi = v.mmsi
        AND vp.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
      ORDER BY vp.time DESC
      LIMIT 1
    ) lp ON true
    WHERE va.resolved_at IS NULL
      AND va.detected_at > NOW() - INTERVAL '48 hours'
    ORDER BY va.detected_at DESC
    LIMIT ${EVENT_CANDIDATES}
  `);
  return result.rows.map((r) => ({
    imo: r.imo,
    mmsi: r.mmsi,
    name: r.name,
    anomalyType: r.anomaly_type,
    confidence: r.confidence,
    detectedAt: new Date(r.detected_at),
    isSanctioned: r.is_sanctioned,
    sanctionRiskCategory: r.risk_category,
    riskScore: r.risk_score === null ? null : Number(r.risk_score),
    lat: r.latitude === null ? null : Number(r.latitude),
    lon: r.longitude === null ? null : Number(r.longitude),
  }));
}

function center(id: string) {
  const b = CHOKEPOINTS[id].bounds;
  return { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 };
}

async function loadTraffic(): Promise<ZoneTrafficFact[]> {
  return Promise.all(Object.values(CHOKEPOINTS).map(async (cp) => {
    const { minLat, maxLat, minLon, maxLon } = cp.bounds;
    const [counts, spc] = await Promise.all([
      pool.query<{ recent: string; previous: string }>(`
        SELECT
          COUNT(DISTINCT mmsi) FILTER (WHERE time > NOW() - INTERVAL '24 hours')::text AS recent,
          COUNT(DISTINCT mmsi) FILTER (WHERE time <= NOW() - INTERVAL '24 hours')::text AS previous
        FROM vessel_positions
        WHERE time > NOW() - INTERVAL '48 hours'
          AND latitude BETWEEN $1 AND $2
          AND longitude BETWEEN $3 AND $4
      `, [minLat, maxLat, minLon, maxLon]),
      getChokepointSpcBand(cp.id).catch(() => null),
    ]);
    const row = counts.rows[0];
    return {
      chokepoint: cp.id,
      name: cp.name,
      center: center(cp.id),
      recent: row ? parseInt(row.recent, 10) || 0 : 0,
      previous: row ? parseInt(row.previous, 10) || 0 : 0,
      z: spc ? spc.z : null,
    };
  }));
}

async function loadCoverage(): Promise<{ zones: ZoneCoverageFact[]; feedLastFix: Date | null }> {
  const [zoneRows, feed] = await Promise.all([
    Promise.all(Object.values(CHOKEPOINTS).map(async (cp) => {
      const { minLat, maxLat, minLon, maxLon } = cp.bounds;
      const r = await pool.query<{ last_fix: Date | null }>(`
        SELECT MAX(time) AS last_fix
        FROM vessel_positions
        WHERE time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
          AND latitude BETWEEN $1 AND $2
          AND longitude BETWEEN $3 AND $4
      `, [minLat, maxLat, minLon, maxLon]);
      return {
        chokepoint: cp.id,
        name: cp.name,
        center: center(cp.id),
        lastFix: r.rows[0]?.last_fix ? new Date(r.rows[0].last_fix) : null,
      };
    })),
    pool.query<{ last_fix: Date | null }>('SELECT MAX(time) AS last_fix FROM vessel_positions'),
  ]);
  return {
    zones: zoneRows,
    feedLastFix: feed.rows[0]?.last_fix ? new Date(feed.rows[0].last_fix) : null,
  };
}

export async function getCurrentWatch(now: Date = new Date()): Promise<{ generatedAt: string; items: WatchItem[] }> {
  const [events, traffic, coverage] = await Promise.all([loadEvents(), loadTraffic(), loadCoverage()]);
  return {
    generatedAt: now.toISOString(),
    items: composeWatch({ now, events, traffic, coverage: coverage.zones, feedLastFix: coverage.feedLastFix }),
  };
}

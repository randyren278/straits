/**
 * Current watch — data gathering. Server-only (imports the pool).
 *
 * One query per fact family, all bounded to recent windows so this stays
 * cheap enough to poll every minute from the dashboard.
 */
import { pool } from '../db';
import { CHOKEPOINTS } from '../geo/chokepoints-constants';
import { computeSpcBand, type DailyCount } from '../detection/spc-index';
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
    JOIN vessel_latest_positions lp ON lp.mmsi = v.mmsi
      AND lp.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
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

const ZONES = Object.values(CHOKEPOINTS);
const BOUND_PARAMS = ZONES.flatMap((cp) => {
  const { minLat, maxLat, minLon, maxLon } = cp.bounds;
  return [minLat, maxLat, minLon, maxLon];
});
function inZone(index: number): string {
  const first = index * 4 + 1;
  return `latitude BETWEEN $${first} AND $${first + 1}
    AND longitude BETWEEN $${first + 2} AND $${first + 3}`;
}

async function loadTraffic(): Promise<ZoneTrafficFact[]> {
  const fields = ZONES.flatMap((_, index) => [
    `COUNT(DISTINCT mmsi) FILTER (WHERE time > NOW() - INTERVAL '24 hours' AND ${inZone(index)})::text AS recent_${index}`,
    `COUNT(DISTINCT mmsi) FILTER (WHERE time <= NOW() - INTERVAL '24 hours' AND ${inZone(index)})::text AS previous_${index}`,
  ]);
  // Start the small daily read concurrently. A failed SPC calculation should
  // omit z-scores, not hide the observed traffic counts from Current Watch.
  const daily = pool.query<{ region: string; day: string; contacts: number }>(`
    SELECT region, day::text AS day, COUNT(*)::int AS contacts
    FROM vessel_daily_presence
    WHERE region = ANY($1::text[])
      AND day >= ((NOW() AT TIME ZONE 'UTC') - INTERVAL '30 days')::date
    GROUP BY region, day
    ORDER BY region, day
  `, [ZONES.map((cp) => cp.id)]).catch(() => null);
  const counts = await pool.query<Record<string, string>>(`
    SELECT ${fields.join(',\n           ')}
    FROM vessel_positions
    WHERE time > NOW() - INTERVAL '48 hours'
  `, BOUND_PARAMS);
  const byRegion = new Map<string, DailyCount[]>();
  for (const row of (await daily)?.rows ?? []) {
    const series = byRegion.get(row.region) ?? [];
    series.push({ date: row.day, count: row.contacts });
    byRegion.set(row.region, series);
  }
  const row = counts.rows[0];
  return ZONES.map((cp, index) => ({
    chokepoint: cp.id,
    name: cp.name,
    center: center(cp.id),
    recent: Number(row?.[`recent_${index}`]) || 0,
    previous: Number(row?.[`previous_${index}`]) || 0,
    z: computeSpcBand(byRegion.get(cp.id) ?? [])?.z ?? null,
  }));
}

async function loadCoverage(): Promise<{ zones: ZoneCoverageFact[]; feedLastFix: Date | null }> {
  const fields = ZONES.map((_, index) =>
    `MAX(time) FILTER (WHERE ${inZone(index)}) AS last_${index}`);
  const result = await pool.query<Record<string, Date | null>>(`
    SELECT (SELECT MAX(time) FROM vessel_positions) AS feed_last_fix,
           ${fields.join(',\n           ')}
    FROM vessel_positions
    WHERE time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
  `, BOUND_PARAMS);
  const row = result.rows[0];
  return {
    zones: ZONES.map((cp, index) => ({
      chokepoint: cp.id,
      name: cp.name,
      center: center(cp.id),
      lastFix: row?.[`last_${index}`] ? new Date(row[`last_${index}`]!) : null,
    })),
    feedLastFix: row?.feed_last_fix ? new Date(row.feed_last_fix) : null,
  };
}

export async function getCurrentWatch(now: Date = new Date()): Promise<{ generatedAt: string; items: WatchItem[] }> {
  const [events, traffic, coverage] = await Promise.all([loadEvents(), loadTraffic(), loadCoverage()]);
  return {
    generatedAt: now.toISOString(),
    items: composeWatch({ now, events, traffic, coverage: coverage.zones, feedLastFix: coverage.feedLastFix }),
  };
}

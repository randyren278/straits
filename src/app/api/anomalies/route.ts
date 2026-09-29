/**
 * GET /api/anomalies - Returns active (unresolved) anomalies.
 * Supports optional ?shipType=tanker|cargo|other filter (server-side, display only).
 * M005-S03: Includes sanctions status for each anomaly vessel.
 * Requirements: ANOM-01, ANOM-02, ANOM-06
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { VESSEL_STALENESS_INTERVAL } from '@/lib/constants/staleness';

const FLEET_PAGE_SIZE = 15;
const ACTIVE_CONTACT = `EXISTS (
  SELECT 1 FROM vessel_latest_positions lp
  JOIN vessels contact ON contact.mmsi = lp.mmsi
  WHERE contact.imo = va.imo
  AND lp.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
)`;

const FLEET_COLUMNS = `
  va.id, va.imo, va.anomaly_type AS "anomalyType", va.confidence,
  va.detected_at AS "detectedAt", va.resolved_at AS "resolvedAt", va.details,
  TRUE AS "isSanctioned", vs.risk_category AS "sanctionRiskCategory",
  v.name AS "vesselName", v.flag, vrs.score AS "riskScore",
  CASE WHEN v.ship_type BETWEEN 80 AND 89 THEN 'tanker'
       WHEN v.ship_type BETWEEN 70 AND 79 THEN 'cargo'
       ELSE 'other' END AS "shipCategory"`;

const FLEET_FROM = `
  FROM vessel_anomalies va
  JOIN vessels v ON v.imo = va.imo
  LEFT JOIN vessel_sanctions vs ON vs.imo = va.imo
  LEFT JOIN vessel_risk_scores vrs ON vrs.imo = va.imo
  WHERE va.resolved_at IS NULL AND ${ACTIVE_CONTACT}`;

function fleetSort(searchParams: URLSearchParams, sanctioned: boolean): string | null {
  const sort = searchParams.get('sort') ?? 'riskScore';
  const allowed = sanctioned ? ['vesselName', 'riskScore'] : ['vesselName', 'riskScore', 'detectedAt'];
  if (!allowed.includes(sort)) return null;
  const dir = searchParams.get('dir') ?? 'desc';
  if (dir !== 'asc' && dir !== 'desc') return null;
  // Whitelist both identifier and direction before interpolating SQL.
  const columns: Record<string, string> = {
    vesselName: '"vesselName"', riskScore: '"riskScore"', detectedAt: '"detectedAt"',
  };
  return `${columns[sort]} ${dir.toUpperCase()} NULLS LAST, "detectedAt" DESC, id DESC`;
}

async function queryFleetPage(tab: string, page: number, order: string) {
  const offset = (page - 1) * FLEET_PAGE_SIZE;
  // A sanctioned hull can have multiple active anomaly types. Keep its
  // highest-scored event, then page the deduplicated set.
  const query = tab === 'sanctioned'
    ? `SELECT * FROM (
         SELECT DISTINCT ON (va.imo) ${FLEET_COLUMNS}
         ${FLEET_FROM} AND vs.imo IS NOT NULL
         ORDER BY va.imo, vrs.score DESC NULLS LAST, va.detected_at DESC, va.id DESC
       ) fleet
       ORDER BY ${order} LIMIT $1 OFFSET $2`
    : `SELECT ${FLEET_COLUMNS.replace('TRUE AS "isSanctioned"', '(vs.imo IS NOT NULL) AS "isSanctioned"')}
       ${FLEET_FROM} AND va.anomaly_type = $1
       ORDER BY ${order} LIMIT $2 OFFSET $3`;
  const result = tab === 'sanctioned'
    ? await pool.query(query, [FLEET_PAGE_SIZE, offset])
    : await pool.query(query, [tab, FLEET_PAGE_SIZE, offset]);
  return result.rows;
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view');
  const imo = request.nextUrl.searchParams.get('imo');
  const shipType = request.nextUrl.searchParams.get('shipType');

  // The dashboard's "since last visit" badge only needs active event IDs and
  // detection times after one timestamp. Do not send every anomaly dossier on
  // a returning visitor's first dashboard load.
  if (view === 'since') {
    const since = new Date(request.nextUrl.searchParams.get('since') ?? '');
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: 'Invalid since timestamp' }, { status: 400 });
    }
    try {
      const result = await pool.query(
        `SELECT va.imo, va.detected_at AS "detectedAt"
         FROM vessel_anomalies va
         WHERE va.resolved_at IS NULL AND va.detected_at > $1
         AND EXISTS (
           SELECT 1 FROM vessel_latest_positions lp
           JOIN vessels v ON v.mmsi = lp.mmsi
           WHERE v.imo = va.imo
           AND lp.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
         )`,
        [since],
      );
      return NextResponse.json({ anomalies: result.rows });
    } catch (error) {
      console.error('Failed to fetch recent anomalies:', error);
      return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 });
    }
  }

  if (view === 'fleet-summary') {
    try {
      const result = await pool.query<{ anomalyType: string; count: string }>(`
        WITH active AS MATERIALIZED (
          SELECT va.imo, va.anomaly_type
          FROM vessel_anomalies va
          WHERE va.resolved_at IS NULL AND ${ACTIVE_CONTACT}
        )
        SELECT anomaly_type AS "anomalyType", COUNT(*)::text AS count
        FROM active GROUP BY anomaly_type
        UNION ALL
        SELECT 'sanctioned', COUNT(DISTINCT active.imo)::text
        FROM active JOIN vessel_sanctions vs ON vs.imo = active.imo
      `);
      const counts = result.rows
        .filter((row) => Number(row.count) > 0)
        .map((row) => ({ anomalyType: row.anomalyType, count: Number(row.count) }));
      const initialTab = counts.find((row) => row.anomalyType === 'sanctioned')?.anomalyType
        ?? counts.filter((row) => row.anomalyType !== 'sanctioned').sort((a, b) => b.count - a.count)[0]?.anomalyType
        ?? null;
      const initialAnomalies = initialTab
        ? await queryFleetPage(initialTab, 1, '"riskScore" DESC NULLS LAST, "detectedAt" DESC, id DESC')
        : [];
      return NextResponse.json({ counts, initialTab, initialAnomalies, pageSize: FLEET_PAGE_SIZE });
    } catch (error) {
      console.error('Failed to fetch fleet summary:', error);
      return NextResponse.json({ error: 'Failed to fetch fleet summary' }, { status: 500 });
    }
  }

  if (view === 'fleet-page') {
    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get('tab') ?? '';
    const sanctioned = tab === 'sanctioned';
    const page = Number(searchParams.get('page') ?? '1');
    const order = fleetSort(searchParams, sanctioned);
    if ((!sanctioned && !/^[a-z_]{1,50}$/.test(tab)) || !Number.isSafeInteger(page) || page < 1 || page > 100_000 || !order) {
      return NextResponse.json({ error: 'Invalid fleet page request' }, { status: 400 });
    }
    try {
      const anomalies = await queryFleetPage(tab, page, order);
      return NextResponse.json({ anomalies, page, pageSize: FLEET_PAGE_SIZE });
    } catch (error) {
      console.error('Failed to fetch fleet page:', error);
      return NextResponse.json({ error: 'Failed to fetch fleet page' }, { status: 500 });
    }
  }

  // Determine ship type clause (safe: controlled switch, not raw user input)
  let shipTypeClause = '';
  if (shipType === 'tanker') {
    shipTypeClause = 'AND v.ship_type BETWEEN 80 AND 89';
  } else if (shipType === 'cargo') {
    shipTypeClause = 'AND v.ship_type BETWEEN 70 AND 79';
  } else if (shipType === 'other') {
    shipTypeClause = 'AND (v.ship_type IS NULL OR v.ship_type < 70 OR v.ship_type > 89)';
  }

  try {
    // Always JOIN vessels for sanctions data; ship type filter also requires the join
    let query = `
      SELECT va.id, va.imo, va.anomaly_type as "anomalyType", va.confidence,
             va.detected_at as "detectedAt", va.resolved_at as "resolvedAt", va.details,
             CASE WHEN vs.imo IS NOT NULL THEN true ELSE false END AS "isSanctioned",
             vs.risk_category AS "sanctionRiskCategory",
             v.name AS "vesselName", v.flag,
             vrs.score AS "riskScore",
             CASE WHEN v.ship_type BETWEEN 80 AND 89 THEN 'tanker'
                  WHEN v.ship_type BETWEEN 70 AND 79 THEN 'cargo'
                  ELSE 'other'
             END AS "shipCategory"
      FROM vessel_anomalies va
      LEFT JOIN vessels v ON v.imo = va.imo
      LEFT JOIN vessel_sanctions vs ON vs.imo = va.imo
      LEFT JOIN vessel_risk_scores vrs ON vrs.imo = va.imo
      WHERE va.resolved_at IS NULL
      AND EXISTS (
        SELECT 1 FROM vessel_latest_positions lp
        JOIN vessels v2 ON v2.mmsi = lp.mmsi
        WHERE v2.imo = va.imo AND v2.imo IS NOT NULL
        AND lp.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
      )
      ${shipTypeClause}
    `;

    const params: string[] = [];

    if (imo) {
      const paramNum = params.length + 1;
      query += ` AND va.imo = $${paramNum}`;
      params.push(imo);
    }

    query += ` ORDER BY va.detected_at DESC`;

    const result = await pool.query(query, params);
    return NextResponse.json({ anomalies: result.rows });
  } catch (error) {
    console.error('Failed to fetch anomalies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anomalies' },
      { status: 500 }
    );
  }
}

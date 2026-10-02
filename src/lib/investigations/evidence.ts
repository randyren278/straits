import { pool } from '@/lib/db';
import { loadRegionContext, type RegionContext } from '@/lib/context/region';
import { getChokepointDaily } from '@/lib/db/crossings';
import { getRecentBuckets } from '@/lib/db/coverage';
import { classifyQuality } from '@/lib/coverage/quality';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import type { ActivityWindow, InvestigationRegion, InvestigationWindow, PassageWindow } from './claims';

export interface VesselSample {
  imo: string | null;
  mmsi: string;
  name: string;
  flag: string | null;
  shipType: number | null;
  observedAt: string;
  latitude: number;
  longitude: number;
  mapHref: string;
}

export interface ObservedCohort {
  flag: string;
  shipType: number | null;
  sampleSize: number;
}

export interface InvestigationEvidence {
  generatedAt: string;
  region: InvestigationRegion;
  window: InvestigationWindow;
  activity: { current: ActivityWindow; previous: ActivityWindow };
  coverage: {
    quality: 'recent' | 'intermittent' | 'insufficient' | 'unavailable';
    latestFix: string | null;
    latestFixAgeMinutes: number | null;
    nonEmptyHoursOfSix: number | null;
    historicalDays: { current: number; previous: number; expected: number } | null;
  };
  cohorts: ObservedCohort[];
  vessels: VesselSample[];
  passages: { current: PassageWindow; previous: PassageWindow } | null;
  context: RegionContext | null;
  limitations: string[];
}

interface WindowRow {
  contacts: number | null;
  fixes: number | null;
  latest_fix: Date | null;
  observed_days?: number | null;
}

interface CohortRow { flag: string | null; ship_type: number | null; sample_size: number }
interface VesselRow {
  imo: string | null; mmsi: string; name: string | null; flag: string | null; ship_type: number | null;
  time: Date; latitude: number; longitude: number;
}

function toActivity(row: WindowRow | undefined, startsAt: Date, endsAt: Date, label: string, expectedDays: number | null = null): ActivityWindow {
  return {
    contacts: row?.contacts ?? 0,
    fixes: row?.fixes ?? null,
    latestFix: row?.latest_fix?.toISOString() ?? null,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    label,
    observedDays: row?.observed_days ?? null,
    expectedDays,
  };
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function mapHref(region: InvestigationRegion, vessel: VesselRow): string {
  const params = new URLSearchParams({ cp: region });
  if (vessel.imo && /^\d{7}$/.test(vessel.imo)) {
    params.set('vessel', vessel.imo);
  } else {
    params.set('lat', vessel.latitude.toFixed(4));
    params.set('lon', vessel.longitude.toFixed(4));
    params.set('z', '9.0');
  }
  return `/dashboard?${params.toString()}`;
}

async function load24HourEvidence(region: InvestigationRegion, now: Date, starts: Date, bounds: (typeof CHOKEPOINTS)[string]['bounds']) {
  const baselineStart = new Date(starts.getTime() - 24 * 3_600_000);
  const aggregate = await pool.query<{
    period: string; contacts: number; fixes: number; latest_fix: Date | null;
  }>(
    `SELECT CASE WHEN time >= $1 THEN 'current' ELSE 'previous' END AS period,
            COUNT(DISTINCT mmsi)::int AS contacts,
            COUNT(*)::int AS fixes,
            MAX(time) AS latest_fix
     FROM vessel_positions
     WHERE time >= $2 AND time < $3
       AND latitude BETWEEN $4 AND $5 AND longitude BETWEEN $6 AND $7
     GROUP BY period`,
    [starts, baselineStart, now, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon],
  );
  const sampleParams = [starts, now, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon];
  const [cohorts, vessels] = await Promise.all([
    pool.query<CohortRow>(
      `WITH contacts AS (
         SELECT DISTINCT ON (mmsi) mmsi, imo
         FROM vessel_positions
         WHERE time >= $1 AND time < $2
           AND latitude BETWEEN $3 AND $4 AND longitude BETWEEN $5 AND $6
         ORDER BY mmsi, time DESC
       )
       SELECT COALESCE(v.flag, 'Unknown') AS flag,
              COALESCE(v.ship_type, f.ship_type) AS ship_type,
              COUNT(*)::int AS sample_size
       FROM contacts c
       LEFT JOIN LATERAL (
         SELECT flag, ship_type FROM vessels
         WHERE mmsi = c.mmsi
         ORDER BY (imo = c.imo) DESC NULLS LAST, last_seen DESC, imo LIMIT 1
       ) v ON true
       LEFT JOIN vessel_fallback_metadata f ON f.mmsi = c.mmsi
       GROUP BY COALESCE(v.flag, 'Unknown'), COALESCE(v.ship_type, f.ship_type)
       ORDER BY sample_size DESC, flag, ship_type NULLS LAST
       LIMIT 16`, sampleParams,
    ),
    pool.query<VesselRow>(
      `WITH contacts AS (
         SELECT DISTINCT ON (mmsi) mmsi, imo, time, latitude, longitude
         FROM vessel_positions
         WHERE time >= $1 AND time < $2
           AND latitude BETWEEN $3 AND $4 AND longitude BETWEEN $5 AND $6
         ORDER BY mmsi, time DESC
       )
       SELECT COALESCE(v.imo, c.imo) AS imo, c.mmsi,
              COALESCE(v.name, f.name, 'Unknown vessel') AS name,
              v.flag, COALESCE(v.ship_type, f.ship_type) AS ship_type,
              c.time, c.latitude, c.longitude
       FROM contacts c
       LEFT JOIN LATERAL (
         SELECT imo, name, flag, ship_type FROM vessels
         WHERE mmsi = c.mmsi
         ORDER BY (imo = c.imo) DESC NULLS LAST, last_seen DESC, imo LIMIT 1
       ) v ON true
       LEFT JOIN vessel_fallback_metadata f ON f.mmsi = c.mmsi
       ORDER BY c.time DESC
       LIMIT 30`, sampleParams,
    ),
  ]);
  const values = new Map(aggregate.rows.map((row) => [row.period, row]));
  return {
    current: toActivity(values.get('current'), starts, now, 'last 24 hours'),
    previous: toActivity(values.get('previous'), baselineStart, starts, 'previous 24 hours'),
    cohorts: cohorts.rows.map((row) => ({ flag: row.flag ?? 'Unknown', shipType: row.ship_type, sampleSize: row.sample_size })),
    vessels: vessels.rows.map((row) => ({
      imo: row.imo, mmsi: row.mmsi, name: row.name ?? 'Unknown vessel', flag: row.flag,
      shipType: row.ship_type, observedAt: row.time.toISOString(), latitude: row.latitude,
      longitude: row.longitude, mapHref: mapHref(region, row),
    })),
  };
}

async function loadSevenDayEvidence(region: InvestigationRegion, now: Date, bounds: (typeof CHOKEPOINTS)[string]['bounds']) {
  const end = utcMidnight(now);
  const currentStart = new Date(end.getTime() - 7 * 86_400_000);
  const previousStart = new Date(end.getTime() - 14 * 86_400_000);
  const currentEnd = end;
  const aggregate = await pool.query<{
    period: string; contacts: number; observation_days: number; latest_fix: Date | null;
  }>(
    `WITH daily AS (
       SELECT CASE WHEN day >= $1::date THEN 'current' ELSE 'previous' END AS period,
              mmsi, day
       FROM vessel_daily_presence
       WHERE region = $2 AND day >= $3::date AND day < $4::date
     ), counts AS (
       SELECT period, COUNT(DISTINCT mmsi)::int AS contacts,
              COUNT(DISTINCT day)::int AS observation_days
       FROM daily GROUP BY period
     ), latest AS (
       SELECT MAX(p.time) AS latest_fix
       FROM vessel_positions p
       WHERE p.time >= $1 AND p.time < $4
         AND p.latitude BETWEEN $5 AND $6 AND p.longitude BETWEEN $7 AND $8
     )
     SELECT counts.period, counts.contacts, counts.observation_days, latest.latest_fix
     FROM counts CROSS JOIN latest`,
    [currentStart, region, previousStart, currentEnd, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon],
  );
  const contactParams = [region, currentStart, currentEnd, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon];
  const [cohorts, vessels] = await Promise.all([
    pool.query<CohortRow>(
      `WITH contacts AS (SELECT DISTINCT mmsi FROM vessel_daily_presence WHERE region = $1 AND day >= $2::date AND day < $3::date)
       SELECT COALESCE(v.flag, 'Unknown') AS flag,
              COALESCE(v.ship_type, f.ship_type) AS ship_type,
              COUNT(*)::int AS sample_size
       FROM contacts c
       LEFT JOIN LATERAL (
         SELECT flag, ship_type, imo FROM vessels WHERE mmsi = c.mmsi
         ORDER BY last_seen DESC, imo LIMIT 1
       ) v ON true
       LEFT JOIN vessel_fallback_metadata f ON f.mmsi = c.mmsi
       GROUP BY COALESCE(v.flag, 'Unknown'), COALESCE(v.ship_type, f.ship_type)
       ORDER BY sample_size DESC, flag, ship_type NULLS LAST
       LIMIT 16`, [region, currentStart, currentEnd],
    ),
    pool.query<VesselRow>(
      `WITH contacts AS (SELECT DISTINCT mmsi FROM vessel_daily_presence WHERE region = $1 AND day >= $2::date AND day < $3::date),
       latest AS (
         SELECT DISTINCT ON (p.mmsi) p.mmsi, p.imo, p.time, p.latitude, p.longitude
         FROM vessel_positions p JOIN contacts c ON c.mmsi = p.mmsi
         WHERE p.time >= $2 AND p.time < $3
           AND p.latitude BETWEEN $4 AND $5 AND p.longitude BETWEEN $6 AND $7
         ORDER BY p.mmsi, p.time DESC
       )
       SELECT COALESCE(v.imo, p.imo) AS imo, p.mmsi,
              COALESCE(v.name, f.name, 'Unknown vessel') AS name,
              v.flag, COALESCE(v.ship_type, f.ship_type) AS ship_type,
              p.time, p.latitude, p.longitude
       FROM latest p
       LEFT JOIN LATERAL (
         SELECT imo, name, flag, ship_type FROM vessels WHERE mmsi = p.mmsi
         ORDER BY (imo = p.imo) DESC NULLS LAST, last_seen DESC, imo LIMIT 1
       ) v ON true
       LEFT JOIN vessel_fallback_metadata f ON f.mmsi = p.mmsi
       ORDER BY p.time DESC
       LIMIT 30`, contactParams,
    ),
  ]);
  const values = new Map(aggregate.rows.map((row) => [row.period, row]));
  const latest = aggregate.rows.reduce<Date | null>((max, row) => row.latest_fix && (!max || row.latest_fix > max) ? row.latest_fix : max, null);
  return {
    current: toActivity(
      { contacts: values.get('current')?.contacts ?? null, fixes: null, latest_fix: latest, observed_days: values.get('current')?.observation_days ?? null },
      currentStart, currentEnd, 'last 7 complete UTC days', 7,
    ),
    previous: toActivity(
      { contacts: values.get('previous')?.contacts ?? null, fixes: null, latest_fix: null, observed_days: values.get('previous')?.observation_days ?? null },
      previousStart, currentStart, 'preceding 7 complete UTC days', 7,
    ),
    currentDays: values.get('current')?.observation_days ?? 0,
    previousDays: values.get('previous')?.observation_days ?? 0,
    cohorts: cohorts.rows.map((row) => ({ flag: row.flag ?? 'Unknown', shipType: row.ship_type, sampleSize: row.sample_size })),
    vessels: vessels.rows.map((row) => ({
      imo: row.imo, mmsi: row.mmsi, name: row.name ?? 'Unknown vessel', flag: row.flag,
      shipType: row.ship_type, observedAt: row.time.toISOString(), latitude: row.latitude,
      longitude: row.longitude, mapHref: mapHref(region, row),
    })),
  };
}

function passageWindow(rows: Awaited<ReturnType<typeof getChokepointDaily>>, start: Date, end: Date, expected: number, label: string): PassageWindow {
  const startDay = start.toISOString().slice(0, 10);
  const endDay = end.toISOString().slice(0, 10);
  const inWindow = rows.filter((row) => row.day >= startDay && row.day < endDay);
  return {
    completed: inWindow.reduce((sum, row) => sum + row.northbound + row.southbound, 0),
    incomplete: inWindow.reduce((sum, row) => sum + row.incomplete, 0),
    waiting: inWindow.reduce((sum, row) => sum + row.waiting, 0),
    daysWithData: inWindow.length,
    daysExpected: expected,
    latestComputedAt: inWindow.reduce<string | null>((latest, row) => !latest || row.computedAt > latest ? row.computedAt : latest, null),
    label,
    startsAt: startDay,
    endsAt: endDay,
  };
}

export async function loadInvestigationEvidence(region: InvestigationRegion, window: InvestigationWindow): Promise<InvestigationEvidence> {
  const now = new Date();
  const bounds = CHOKEPOINTS[region].bounds;
  const activityPromise = window === '24h'
    ? load24HourEvidence(region, now, new Date(now.getTime() - 24 * 3_600_000), bounds)
    : loadSevenDayEvidence(region, now, bounds);
  const qualityPromise = getRecentBuckets(region, window === '7d' ? 15 * 24 : 24)
    .then((buckets) => {
      const assessment = classifyQuality(buckets, now);
      if (window !== '7d') return { assessment, historicalDays: null };
      const end = utcMidnight(now);
      const currentStart = new Date(end.getTime() - 7 * 86_400_000);
      const previousStart = new Date(end.getTime() - 14 * 86_400_000);
      const dayKeys = new Set(buckets.map((bucket) => bucket.bucketStart.toISOString().slice(0, 10)));
      const countDays = (start: Date, finish: Date) => {
        let count = 0;
        for (let time = start.getTime(); time < finish.getTime(); time += 86_400_000) {
          if (dayKeys.has(new Date(time).toISOString().slice(0, 10))) count++;
        }
        return count;
      };
      return {
        assessment,
        historicalDays: {
          current: countDays(currentStart, end),
          previous: countDays(previousStart, currentStart),
          expected: 7,
        },
      };
    })
    .catch(() => null);
  const passagesPromise = region === 'suez'
    ? getChokepointDaily('suez', window === '24h' ? 3 : 16).catch(() => null)
    : Promise.resolve(null);
  const contextPromise = loadRegionContext(region).catch(() => null);
  const [activity, qualityResult, rows, context] = await Promise.all([activityPromise, qualityPromise, passagesPromise, contextPromise]);

  let passages: InvestigationEvidence['passages'] = null;
  if (rows) {
    const end = utcMidnight(now);
    const spanDays = window === '24h' ? 1 : 7;
    const currentStart = new Date(end.getTime() - spanDays * 86_400_000);
    const previousStart = new Date(end.getTime() - 2 * spanDays * 86_400_000);
    passages = {
      current: passageWindow(rows, currentStart, end, spanDays, window === '24h' ? 'last complete UTC day' : 'last 7 complete UTC days'),
      previous: passageWindow(rows, previousStart, currentStart, spanDays, window === '24h' ? 'previous complete UTC day' : 'preceding 7 complete UTC days'),
    };
  }

  const quality = qualityResult?.assessment;
  const qualityName = quality?.quality ?? 'unavailable';
  return {
    generatedAt: now.toISOString(), region, window,
    activity: { current: activity.current, previous: activity.previous },
    coverage: {
      quality: qualityName,
      latestFix: quality?.basis.latestFix ?? activity.current.latestFix,
      latestFixAgeMinutes: quality?.basis.latestFixAgeMinutes ?? null,
      nonEmptyHoursOfSix: quality?.basis.nonEmptyLast6h ?? null,
      historicalDays: qualityResult?.historicalDays ?? null,
    },
    cohorts: activity.cohorts,
    vessels: activity.vessels,
    passages,
    context,
    limitations: [
      'Distinct MMSIs and position records measure observed AIS contacts, not official vessel traffic or completed transits.',
      'A contact missing from the feed is not evidence that the vessel stopped, evaded detection, or left the region.',
      ...(window === '7d' ? ['The 7-day activity totals use one distinct-MMSI record per UTC day; the comparison uses the previous seven complete UTC days.'] : []),
      ...(region === 'suez' ? ['Completed passages are counted only when both Suez gates are observed in order; aggregate rows may be absent when the crossing job did not record that day.'] : ['No completed-passage model is available for this region.']),
    ],
  };
}

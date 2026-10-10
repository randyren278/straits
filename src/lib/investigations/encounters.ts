import { pool } from '@/lib/db';

const MAX_ENCOUNTERS = 20;
const MAX_POSITIONS_PER_VESSEL = 250;
const POSITION_READ_LIMIT = MAX_POSITIONS_PER_VESSEL + 1;
const CONTEXT_HOURS = 12;
const POSITION_RETENTION_DAYS = 7;

export interface EncounterPosition {
  time: string;
  mmsi: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  source: string | null;
  lowConfidence: boolean;
  identityBasis: 'imo' | 'current_mmsi';
}

export interface EncounterSummary {
  id: string;
  partnerImo: string;
  partnerName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  minDistanceKm: number | null;
  selfSanctioned: boolean | null;
  partnerSanctioned: boolean | null;
}

export interface EncounterSelection {
  id: string;
  /** Only fixes whose IMO equals the selected hull. */
  selfPositions: EncounterPosition[];
  partnerPositions: EncounterPosition[];
  /** Provisional association through each vessel's current MMSI; these fixes have no IMO. */
  selfCandidatePositions: EncounterPosition[];
  partnerCandidatePositions: EncounterPosition[];
  selfPositionsMeta: PositionPageMeta;
  partnerPositionsMeta: PositionPageMeta;
  selfCandidatePositionsMeta: PositionPageMeta;
  partnerCandidatePositionsMeta: PositionPageMeta;
  positionWindow: { startsAt: string; endsAt: string };
  selfTrackStatus: 'observed' | 'no_imo_fixes';
  partnerTrackStatus: 'observed' | 'no_imo_fixes';
}

export interface PositionPageMeta {
  truncated: boolean;
  earliestReturnedAt: string | null;
  latestReturnedAt: string | null;
}

export interface EncounterCaseResponse {
  vessel: { imo: string; name: string; mmsi: string; flag: string | null };
  encounters: EncounterSummary[];
  /** The exact requested event, even if older than the latest-20 sidebar. */
  selectedSummary: EncounterSummary | null;
  selected: EncounterSelection | null;
}

export interface EncounterLead {
  imo: string;
  name: string;
  partnerImo: string;
  partnerName: string | null;
  lastSeenAt: string;
  minDistanceKm: number | null;
  eventId: string;
}

interface VesselRow { imo: string; name: string; mmsi: string; flag: string | null }
interface EncounterRow {
  partner_imo: string;
  partner_name: string | null;
  partner_mmsi: string | null;
  first_seen_us: string;
  first_seen_at: Date;
  last_seen_at: Date;
  min_distance_km: number | null;
  self_sanctioned: boolean | null;
  partner_sanctioned: boolean | null;
}
interface PositionRow {
  time: Date;
  mmsi: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  source: string | null;
  low_confidence: boolean | null;
}
interface LeadRow {
  imo: string;
  name: string;
  partner_imo: string;
  partner_name: string | null;
  first_seen_us: string;
  first_seen_at: Date;
  last_seen_at: Date;
  min_distance_km: number | null;
}

export function isValidEncounterImo(value: string): boolean {
  return /^\d{7}$/.test(value);
}

export function isValidEncounterId(value: string): boolean {
  return /^\d{7}-\d{16}$/.test(value);
}

export function encounterId(partnerImo: string, firstSeenMicroseconds: string): string {
  return `${partnerImo}-${firstSeenMicroseconds}`;
}

function toSummary(row: EncounterRow): EncounterSummary {
  return {
    id: encounterId(row.partner_imo, row.first_seen_us),
    partnerImo: row.partner_imo,
    partnerName: row.partner_name,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    minDistanceKm: row.min_distance_km,
    selfSanctioned: row.self_sanctioned,
    partnerSanctioned: row.partner_sanctioned,
  };
}

function toPosition(row: PositionRow, identityBasis: EncounterPosition['identityBasis']): EncounterPosition {
  return {
    time: row.time.toISOString(),
    mmsi: row.mmsi,
    latitude: row.latitude,
    longitude: row.longitude,
    speed: row.speed,
    source: row.source,
    lowConfidence: row.low_confidence ?? false,
    identityBasis,
  };
}

function toPositionPage(rows: PositionRow[], identityBasis: EncounterPosition['identityBasis']): { positions: EncounterPosition[]; meta: PositionPageMeta } {
  const positions = rows.slice(0, MAX_POSITIONS_PER_VESSEL).map((row) => toPosition(row, identityBasis)).reverse();
  return {
    positions,
    meta: {
      truncated: rows.length > MAX_POSITIONS_PER_VESSEL,
      earliestReturnedAt: positions[0]?.time ?? null,
      latestReturnedAt: positions.at(-1)?.time ?? null,
    },
  };
}

const EMPTY_PAGE = {
  positions: [] as EncounterPosition[],
  meta: { truncated: false, earliestReturnedAt: null, latestReturnedAt: null } as PositionPageMeta,
};

export type EncounterLoadResult =
  | { kind: 'found'; data: EncounterCaseResponse }
  | { kind: 'vessel_not_found' }
  | { kind: 'event_not_found' };

/** A small, recent entry point into recorded proximity cases. Names are joined after the ledger is bounded. */
export async function loadRecentEncounterLeads(): Promise<EncounterLead[]> {
  const result = await pool.query<LeadRow>(
    `WITH recent AS MATERIALIZED (
       SELECT imo_a, imo_b, first_seen_at, last_seen_at, min_distance_km
       FROM vessel_rendezvous
       WHERE last_seen_at >= NOW() - INTERVAL '7 days'
       ORDER BY last_seen_at DESC, first_seen_at DESC, imo_a, imo_b
       LIMIT 8
     )
     SELECT r.imo_a AS imo, self.name, r.imo_b AS partner_imo,
            partner.name AS partner_name,
            (extract(epoch from r.first_seen_at) * 1000000)::bigint::text AS first_seen_us,
            r.first_seen_at, r.last_seen_at, r.min_distance_km
     FROM recent r
     JOIN vessels self ON self.imo = r.imo_a
     LEFT JOIN vessels partner ON partner.imo = r.imo_b
     ORDER BY r.last_seen_at DESC, r.first_seen_at DESC, r.imo_a, r.imo_b`,
  );
  return result.rows.map((row) => ({
    imo: row.imo,
    name: row.name,
    partnerImo: row.partner_imo,
    partnerName: row.partner_name,
    lastSeenAt: row.last_seen_at.toISOString(),
    minDistanceKm: row.min_distance_km,
    eventId: encounterId(row.partner_imo, row.first_seen_us),
  }));
}

const ENCOUNTER_SELECT = `SELECT CASE WHEN r.imo_a = $1 THEN r.imo_b ELSE r.imo_a END AS partner_imo,
  partner.name AS partner_name, partner.mmsi AS partner_mmsi,
  (extract(epoch from r.first_seen_at) * 1000000)::bigint::text AS first_seen_us,
  r.first_seen_at, r.last_seen_at, r.min_distance_km,
  CASE WHEN r.imo_a = $1 THEN r.a_sanctioned ELSE r.b_sanctioned END AS self_sanctioned,
  CASE WHEN r.imo_a = $1 THEN r.b_sanctioned ELSE r.a_sanctioned END AS partner_sanctioned
  FROM vessel_rendezvous r
  LEFT JOIN vessels partner ON partner.imo = CASE WHEN r.imo_a = $1 THEN r.imo_b ELSE r.imo_a END`;

/** A fixed number of bounded reads: vessel, sidebar, exact event if requested, and four track branches. */
export async function loadEncounterCase(imo: string, eventId?: string, now = new Date()): Promise<EncounterLoadResult> {
  const vesselResult = await pool.query<VesselRow>(
    'SELECT imo, name, mmsi, flag FROM vessels WHERE imo = $1', [imo],
  );
  const vessel = vesselResult.rows[0];
  if (!vessel) return { kind: 'vessel_not_found' };

  const encounterResult = await pool.query<EncounterRow>(
    `${ENCOUNTER_SELECT}
     WHERE r.imo_a = $1 OR r.imo_b = $1
     ORDER BY r.last_seen_at DESC, r.first_seen_at DESC, r.imo_a, r.imo_b
     LIMIT ${MAX_ENCOUNTERS}`,
    [imo],
  );
  const encounters = encounterResult.rows.map(toSummary);
  let selectedRow: EncounterRow | undefined;
  if (eventId) {
    if (!isValidEncounterId(eventId)) return { kind: 'event_not_found' };
    const partnerImo = eventId.slice(0, 7);
    const firstSeenMicroseconds = eventId.slice(8);
    const exact = await pool.query<EncounterRow>(
      `${ENCOUNTER_SELECT}
       WHERE ((r.imo_a = $1 AND r.imo_b = $2) OR (r.imo_b = $1 AND r.imo_a = $2))
         AND r.first_seen_at = to_timestamp($3::numeric / 1000000)
       LIMIT 1`,
      [imo, partnerImo, firstSeenMicroseconds],
    );
    selectedRow = exact.rows[0];
    if (!selectedRow) return { kind: 'event_not_found' };
  } else {
    selectedRow = encounterResult.rows[0];
  }
  if (!selectedRow) return { kind: 'found', data: { vessel, encounters, selectedSummary: null, selected: null } };
  const selectedEvent = toSummary(selectedRow);

  const firstTime = Date.parse(selectedEvent.firstSeenAt);
  const lastTime = Date.parse(selectedEvent.lastSeenAt);
  const windowStart = new Date(Math.min(
    Math.min(firstTime, lastTime) - CONTEXT_HOURS * 3_600_000,
    now.getTime() - 1,
  ));
  const windowEnd = new Date(Math.min(
    Math.max(firstTime, lastTime) + CONTEXT_HOURS * 3_600_000,
    now.getTime(),
  ));
  const queryStart = new Date(Math.max(
    windowStart.getTime(),
    now.getTime() - POSITION_RETENTION_DAYS * 86_400_000,
  ));
  const queryEnd = windowEnd;

  async function positionsFor(identity: string | null, basis: EncounterPosition['identityBasis']): Promise<typeof EMPTY_PAGE> {
    if (!identity || queryStart > queryEnd) return EMPTY_PAGE;
    const predicate = basis === 'imo' ? 'imo = $1' : 'imo IS NULL AND mmsi = $1';
    const result = await pool.query<PositionRow>(
      `SELECT time, mmsi, latitude, longitude, speed, source, low_confidence
       FROM vessel_positions
       WHERE ${predicate} AND time >= $2 AND time <= $3
       ORDER BY time DESC
       LIMIT ${POSITION_READ_LIMIT}`,
      [identity, queryStart, queryEnd],
    );
    return toPositionPage(result.rows, basis);
  }

  const [self, partner, selfCandidate, partnerCandidate] = await Promise.all([
    positionsFor(imo, 'imo'),
    positionsFor(selectedEvent.partnerImo, 'imo'),
    positionsFor(vessel.mmsi, 'current_mmsi'),
    positionsFor(selectedRow.partner_mmsi, 'current_mmsi'),
  ]);
  return {
    kind: 'found',
    data: {
      vessel,
      encounters,
      selectedSummary: selectedEvent,
      selected: {
        id: selectedEvent.id,
        selfPositions: self.positions,
        partnerPositions: partner.positions,
        selfCandidatePositions: selfCandidate.positions,
        partnerCandidatePositions: partnerCandidate.positions,
        selfPositionsMeta: self.meta,
        partnerPositionsMeta: partner.meta,
        selfCandidatePositionsMeta: selfCandidate.meta,
        partnerCandidatePositionsMeta: partnerCandidate.meta,
        positionWindow: { startsAt: windowStart.toISOString(), endsAt: windowEnd.toISOString() },
        selfTrackStatus: self.positions.length ? 'observed' : 'no_imo_fixes',
        partnerTrackStatus: partner.positions.length ? 'observed' : 'no_imo_fixes',
      },
    },
  };
}

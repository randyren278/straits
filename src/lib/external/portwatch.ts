import { readBoundedJson } from './bounded-json';

export const PORTWATCH_SOURCE = {
  id: 'imf-portwatch',
  name: 'IMF PortWatch',
  url: 'https://portwatch.imf.org/',
  attribution: 'Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).',
  licenseUrl: 'https://www.imf.org/external/terms.htm',
  staleAfterDays: 7,
} as const;

export const PORTWATCH_CHOKEPOINT_IDS = {
  hormuz: 'chokepoint6',
  suez: 'chokepoint1',
  babel_mandeb: 'chokepoint4',
} as const;

export type PortWatchRegion = keyof typeof PORTWATCH_CHOKEPOINT_IDS;

export const PORTWATCH_COUNT_FIELDS = [
  'n_container',
  'n_dry_bulk',
  'n_general_cargo',
  'n_roro',
  'n_tanker',
  'n_cargo',
  'n_total',
] as const;

export type PortWatchCountField = (typeof PORTWATCH_COUNT_FIELDS)[number];

export interface PortWatchDailyCounts {
  date: string;
  counts: Record<PortWatchCountField, number>;
}

export interface PortWatchSnapshot {
  status: 'available' | 'empty';
  source: typeof PORTWATCH_SOURCE;
  region: PortWatchRegion;
  chokepointId: string;
  fetchedAt: string;
  latestSourceDate: string | null;
  sourceLagDays: number | null;
  stale: boolean;
  rows: PortWatchDailyCounts[];
}

export class PortWatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortWatchError';
  }
}

const QUERY_URL =
  'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';
const MAX_RESPONSE_BYTES = 256 * 1024;

type Fetcher = typeof fetch;

function isDateOnlyUtc(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function dateDifferenceInDays(earlier: string, later: string): number {
  const earlierMs = Date.parse(`${earlier}T00:00:00.000Z`);
  const laterMs = Date.parse(`${later}T00:00:00.000Z`);
  return Math.floor((laterMs - earlierMs) / 86_400_000);
}

function parseFeatureSet(payload: unknown, now: Date): PortWatchDailyCounts[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new PortWatchError('IMF PortWatch returned an invalid response');
  }
  const object = payload as Record<string, unknown>;
  if (object.error) throw new PortWatchError('IMF PortWatch reported a query error');
  if (!Array.isArray(object.features)) {
    throw new PortWatchError('IMF PortWatch response has no feature list');
  }

  const today = utcDate(now);
  const rows = object.features.map((feature): PortWatchDailyCounts => {
    if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
      throw new PortWatchError('IMF PortWatch returned an invalid feature');
    }
    const attributes = (feature as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
      throw new PortWatchError('IMF PortWatch feature has no attributes');
    }

    const fields = attributes as Record<string, unknown>;
    if (!isDateOnlyUtc(fields.date) || fields.date > today) {
      throw new PortWatchError('IMF PortWatch returned an invalid source date');
    }
    const counts = {} as Record<PortWatchCountField, number>;
    for (const field of PORTWATCH_COUNT_FIELDS) {
      const value = fields[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new PortWatchError(`IMF PortWatch returned an invalid ${field} count`);
      }
      counts[field] = value;
    }
    return { date: fields.date, counts };
  });

  const seenDates = new Set<string>();
  for (const row of rows) {
    if (seenDates.has(row.date)) throw new PortWatchError('IMF PortWatch returned duplicate dates');
    seenDates.add(row.date);
    if (row.counts.n_total < row.counts.n_tanker || row.counts.n_total < row.counts.n_cargo) {
      throw new PortWatchError('IMF PortWatch returned inconsistent total counts');
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}

/** Fetch up to the latest 30 reported UTC dates for one supported chokepoint. */
export async function fetchPortWatch(
  region: PortWatchRegion,
  fetcher: Fetcher = fetch,
  now = new Date(),
): Promise<PortWatchSnapshot> {
  const chokepointId = PORTWATCH_CHOKEPOINT_IDS[region];
  const url = new URL(QUERY_URL);
  url.search = new URLSearchParams({
    where: `portid='${chokepointId}'`,
    outFields: ['date', ...PORTWATCH_COUNT_FIELDS].join(','),
    returnGeometry: 'false',
    orderByFields: 'date DESC',
    resultRecordCount: '30',
    f: 'json',
  }).toString();

  let response: Response;
  try {
    response = await fetcher(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3_600 },
    });
  } catch {
    throw new PortWatchError('IMF PortWatch request failed or timed out');
  }
  if (!response.ok) throw new PortWatchError(`IMF PortWatch returned HTTP ${response.status}`);

  let payload: unknown;
  try {
    payload = await readBoundedJson(response, MAX_RESPONSE_BYTES);
  } catch (error) {
    if (error instanceof Error && error.message === 'Upstream response exceeded the size limit') {
      throw new PortWatchError(error.message);
    }
    throw new PortWatchError('IMF PortWatch returned invalid JSON');
  }

  const rows = parseFeatureSet(payload, now);
  const latestSourceDate = rows[0]?.date ?? null;
  const sourceLagDays = latestSourceDate ? dateDifferenceInDays(latestSourceDate, utcDate(now)) : null;
  return {
    status: rows.length ? 'available' : 'empty',
    source: PORTWATCH_SOURCE,
    region,
    chokepointId,
    fetchedAt: now.toISOString(),
    latestSourceDate,
    sourceLagDays,
    stale: sourceLagDays !== null && sourceLagDays > PORTWATCH_SOURCE.staleAfterDays,
    rows,
  };
}

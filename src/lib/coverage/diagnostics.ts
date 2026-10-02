import { REGIONS } from './buckets';
import { BUCKET_MINUTES } from '../constants/coverage';

export const COVERAGE_WINDOW_HOURS = 48;
export const COVERAGE_PEER_LIMIT = 100;

export interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface CoverageRegion {
  id: string;
  bounds: RegionBounds;
}

export const COVERAGE_REGIONS: readonly CoverageRegion[] = REGIONS.map((region) => ({ id: region.id, bounds: region.box }));

export interface BucketRow {
  bucketStart: string | Date;
  source: string;
  messageCount: number;
  latestFix: string | Date | null;
}

export interface HourCell {
  hour: string;
  recordedWindows: number;
  activeWindows: number;
  sourceReportedFixes: number | null;
  sources: string[];
}

export interface VesselGapSummary {
  count: number;
  firstFix: string | null;
  lastFix: string | null;
  longestGapSeconds: number | null;
  longestGapStart: string | null;
  longestGapEnd: string | null;
}

export function getCoverageRegion(id: string): CoverageRegion | null {
  return COVERAGE_REGIONS.find((region) => region.id === id) ?? null;
}

function hourKey(value: string | Date): string {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

/** Fill the 48-hour UTC window, preserving absent collection records as null. */
export function interpretHourlyCoverage(rows: BucketRow[], now: Date): HourCell[] {
  const end = new Date(now);
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end.getTime() - (COVERAGE_WINDOW_HOURS - 1) * 3_600_000);
  const cells = new Map<string, HourCell>();
  for (let i = 0; i < COVERAGE_WINDOW_HOURS; i++) {
    const hour = new Date(start.getTime() + i * 3_600_000).toISOString();
    cells.set(hour, { hour, recordedWindows: 0, activeWindows: 0, sourceReportedFixes: null, sources: [] });
  }
  const recordedWindows = new Set<string>();
  const activeWindows = new Set<string>();
  for (const row of rows) {
    const key = hourKey(row.bucketStart);
    const cell = cells.get(key);
    if (!cell) continue;
    const bucket = new Date(row.bucketStart).toISOString();
    recordedWindows.add(`${key}\0${bucket}`);
    if (row.messageCount > 0) activeWindows.add(`${key}\0${bucket}`);
    cell.sourceReportedFixes = (cell.sourceReportedFixes ?? 0) + row.messageCount;
    if (!cell.sources.includes(row.source)) cell.sources.push(row.source);
  }
  for (const value of recordedWindows) {
    const [key] = value.split('\0');
    const cell = cells.get(key);
    if (cell) cell.recordedWindows++;
  }
  for (const value of activeWindows) {
    const [key] = value.split('\0');
    const cell = cells.get(key);
    if (cell) cell.activeWindows++;
  }
  return [...cells.values()];
}

/** Summarize recorded regional collection rows in one exact vessel-gap interval. */
export function interpretCollectionInterval(rows: BucketRow[], start: string, end: string) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return { recordedWindows: 0, activeWindows: 0, sourceReportedFixes: 0, sources: [] as string[] };
  }
  const buckets = new Map<number, { active: boolean; fixes: number; sources: Set<string> }>();
  for (const row of rows) {
    const time = new Date(row.bucketStart).getTime();
    const bucketEnd = time + BUCKET_MINUTES * 60_000;
    if (time >= endMs || bucketEnd <= startMs) continue;
    const bucket = buckets.get(time) ?? { active: false, fixes: 0, sources: new Set<string>() };
    bucket.active ||= row.messageCount > 0;
    bucket.fixes += row.messageCount;
    bucket.sources.add(row.source);
    buckets.set(time, bucket);
  }
  const sources = new Set<string>();
  let activeWindows = 0;
  let sourceReportedFixes = 0;
  for (const bucket of buckets.values()) {
    if (bucket.active) activeWindows++;
    sourceReportedFixes += bucket.fixes;
    for (const source of bucket.sources) sources.add(source);
  }
  return { recordedWindows: buckets.size, activeWindows, sourceReportedFixes, sources: [...sources] };
}

export function interpretVesselGaps(summary: VesselGapSummary | null) {
  if (!summary || summary.count < 2 || summary.longestGapSeconds == null) {
    return { status: 'insufficient_history' as const, count: summary?.count ?? 0, longestGapSeconds: null };
  }
  return {
    status: 'observed_gaps' as const,
    count: summary.count,
    longestGapSeconds: Math.max(0, summary.longestGapSeconds),
    longestGapStart: summary.longestGapStart,
    longestGapEnd: summary.longestGapEnd,
  };
}

/**
 * Region-aware fallback.
 *
 * AISStream has no receivers east of the Red Sea and hears only a trickle in
 * Suez (docs/COVERAGE-DIAGNOSIS.md): ~35–90 of ~460 daily contacts per 90 s
 * window. The public fallback returns a full snapshot of every chokepoint box
 * on each call. So every harvest fetches all four chokepoint boxes from the
 * fallback and merges them under the primary — primary wins on a shared MMSI
 * (it carries speed, course, heading and IMO), the fallback fills the rest.
 * The result is one fix per vessel per harvest for every chokepoint, which is
 * what the crossing model needs to see both gates.
 *
 * Scoped to the four chokepoint boxes rather than the six coverage boxes on
 * purpose: the Persian Gulf box alone holds ~2,700 vessels, which at one row
 * per vessel per 10-minute harvest would exhaust the database's free tier
 * inside the retention window. Widening is a storage decision, not a code one.
 *
 * Pure planning + merging; the network call is injected.
 */
import { CHOKEPOINTS, type ChokepointBounds } from '../../lib/geo/chokepoints-constants';
import type { MiddleEastFallbackPosition } from './middle-east-fallback';

export interface FallbackRegion { id: string; box: ChokepointBounds }

export const FALLBACK_REGIONS: readonly FallbackRegion[] =
  Object.values(CHOKEPOINTS).map((cp) => ({ id: cp.id, box: cp.bounds }));

const inBox = (lat: number, lon: number, b: ChokepointBounds) =>
  lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;

export interface RegionFallbackResult {
  /** Latest fallback position per MMSI across every fetched region. */
  positions: Map<string, MiddleEastFallbackPosition>;
  /** Region ids the fallback was asked for (zero-result regions included). */
  attempted: string[];
  /** Per-region failures — one box failing must not hide the others. */
  errors: Record<string, string>;
}

export type RegionFetcher = (box: ChokepointBounds) => Promise<MiddleEastFallbackPosition[]>;

export async function collectRegionFallback(
  regions: readonly FallbackRegion[],
  fetchRegion: RegionFetcher,
): Promise<RegionFallbackResult> {
  const positions = new Map<string, MiddleEastFallbackPosition>();
  const errors: Record<string, string> = {};
  await Promise.all(regions.map(async (r) => {
    try {
      for (const p of await fetchRegion(r.box)) {
        const prev = positions.get(p.mmsi);
        if (!prev || p.time > prev.time) positions.set(p.mmsi, p);
      }
    } catch (err) {
      errors[r.id] = (err as Error).message;
    }
  }));
  return { positions, attempted: regions.map((r) => r.id), errors };
}

/** Primary wins on an MMSI both sources reported. */
export function mergePositions<T extends { mmsi: string }>(primary: Map<string, T>, fallback: Map<string, T>): Map<string, T> {
  const merged = new Map(primary);
  for (const [mmsi, p] of fallback) if (!merged.has(mmsi)) merged.set(mmsi, p);
  return merged;
}

export type PositionSource = 'aisstream' | 'middle-east-fallback';

export interface RegionCoverageEntry {
  aisstream: number;
  'middle-east-fallback': number | null;
  error?: string;
}

/** Per-chokepoint counts for status.json: what each source contributed this window. */
export function summarizeRegionCoverage(
  positions: Iterable<{ latitude: number; longitude: number; source: PositionSource }>,
  attemptedFallback: readonly string[],
  errors: Record<string, string> = {},
  regions: readonly FallbackRegion[] = FALLBACK_REGIONS,
): Record<string, RegionCoverageEntry> {
  const out: Record<string, RegionCoverageEntry> = {};
  for (const r of regions) {
    out[r.id] = { aisstream: 0, 'middle-east-fallback': attemptedFallback.includes(r.id) ? 0 : null };
    if (errors[r.id]) out[r.id].error = errors[r.id];
  }
  for (const p of positions) {
    for (const r of regions) {
      if (!inBox(p.latitude, p.longitude, r.box)) continue;
      const e = out[r.id];
      if (p.source === 'aisstream') e.aisstream++;
      else e['middle-east-fallback'] = (e['middle-east-fallback'] ?? 0) + 1;
    }
  }
  return out;
}

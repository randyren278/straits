/**
 * Prove the local mirror answers the harvester's heavy reads exactly as
 * Supabase does: sync the mirror, then run every mirrored read against both
 * and diff the results.
 *
 *   npx tsx --env-file=.env.harvester scripts/verify-mirror-equivalence.ts
 *
 * Costs roughly one unmirrored harvest of Supabase egress (~8 MB), plus the
 * mirror bootstrap if it is empty. Run it while no harvest is in progress
 * (hold ~/.straits-harvester/harvest.lock): a harvest writing between the two
 * reads shows up as a difference.
 *
 * What it proves, and its limits:
 *  - Detector reads are captured by a reader that records the query and then
 *    throws, so no detector writes anything. That captures each detector's
 *    first mirrored read only; src/lib/db/reader.test.ts enforces that each
 *    has exactly one.
 *  - Rows are compared as sorted multisets. Row order is checked only where
 *    it is part of the value (each vessel's fixes, each array_agg); the
 *    callers do not depend on top-level row order.
 *  - Lane density and learn state count as verified only if the mirror's copy
 *    was already current (run it after at least one harvest with the mirror);
 *    a copy that had to be refreshed during the check is a failure.
 *  - Positions, vessels and fallback metadata are also checked bit-exactly on
 *    every harvest by syncMirror's checksums; this script checks the queries.
 */
import { pool } from '../src/lib/db';
import { setReaderPool, type Reader } from '../src/lib/db/reader';
import { createMirrorPool, syncMirror, loadLaneRowsMirrored, loadLearnMirrored } from '../src/lib/db/mirror';
import { loadEngineVessels, loadLaneDensity, loadLearnState, laneDensityFromRows } from '../src/lib/db/tracks';
import { loadSuezTracks } from '../src/lib/db/crossings';
import { normalizeLearnState } from '../src/lib/tracks/learn';
import { grid } from '../src/lib/tracks/land';
import { detectLoitering } from '../src/lib/detection/loitering';
import { detectSpeedAnomaly, detectDeviation } from '../src/lib/detection/deviation';
import { detectSpoofedPositions } from '../src/lib/detection/teleport';
import { detectGoingDark } from '../src/lib/detection/going-dark';

const MIRROR_URL = process.env.MIRROR_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/straits_mirror';
const local = createMirrorPool(MIRROR_URL);
let failures = 0;

const canonical = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).sort();

function compare(name: string, a: unknown[], b: unknown[]): void {
  const ca = canonical(a), cb = canonical(b);
  const same = ca.length === cb.length && ca.every((v, i) => v === cb[i]);
  if (same) {
    console.log(`  ✓ ${name}: ${ca.length} rows identical`);
    return;
  }
  failures++;
  const onlyA = ca.filter((v) => !cb.includes(v)).slice(0, 3);
  const onlyB = cb.filter((v) => !ca.includes(v)).slice(0, 3);
  console.log(`  ✗ ${name}: supabase ${ca.length} rows, mirror ${cb.length} rows`);
  for (const v of onlyA) console.log(`      supabase only: ${v.slice(0, 300)}`);
  for (const v of onlyB) console.log(`      mirror only:   ${v.slice(0, 300)}`);
}

/**
 * Like compare(), for rows carrying a NOW()-derived column: the two servers
 * evaluate NOW() a fraction of a second apart, so that column may differ by
 * up to `maxDelta`; every other field must match exactly.
 */
function compareTimeDerived(name: string, a: Record<string, unknown>[], b: Record<string, unknown>[], key: string, field: string, maxDelta: number): void {
  const strip = (r: Record<string, unknown>) => ({ ...r, [field]: null });
  compare(`${name} (excluding ${field})`, a.map(strip), b.map(strip));
  const other = new Map(b.map((r) => [String(r[key]), Number(r[field])]));
  const worst = a.reduce((m, r) => Math.max(m, Math.abs(Number(r[field]) - (other.get(String(r[key])) ?? Infinity))), 0);
  if (worst <= maxDelta) {
    console.log(`  ✓ ${name} ${field}: max difference ${worst.toFixed(4)} (≤ ${maxDelta})`);
  } else {
    failures++;
    console.log(`  ✗ ${name} ${field}: max difference ${worst}`);
  }
}

/** Run `fn` with reads routed to `reader`. */
async function via<T>(reader: Reader, fn: () => Promise<T>): Promise<T> {
  setReaderPool(reader);
  try { return await fn(); } finally { setReaderPool(null); }
}

async function main(): Promise<void> {
  console.log('Syncing mirror...');
  const sync = await syncMirror(pool, local, {
    now: new Date(), deadline: Date.now() + 240_000, repairBudgetBytes: 100e6,
  });
  console.log(`  ready=${sync.ready} hours copied=${sync.bucketsRepaired} rows=${sync.rowsPulled} pulled=${(sync.bytesPulled / 1e6).toFixed(1)} MB${sync.reason ? ` reason=${sync.reason}` : ''}`);
  if (!sync.ready) throw new Error('mirror not ready; nothing to compare');

  console.log('Comparing mirrored reads:');
  compare('loadEngineVessels', await via(pool, loadEngineVessels), await via(local, loadEngineVessels));

  const until = new Date();
  const since = new Date(Date.parse(until.toISOString().slice(0, 10)) - 3 * 86_400_000);
  const suez = async () => [...(await loadSuezTracks(since, until)).entries()];
  compare('loadSuezTracks', await via(pool, suez), await via(local, suez));

  for (const [name, detector] of Object.entries({ detectGoingDark, detectLoitering, detectSpeedAnomaly, detectDeviation, detectSpoofedPositions })) {
    const captured: Array<{ text: string; values?: unknown[] }> = [];
    const capture: Reader = {
      async query(text: string, values?: unknown[]) {
        captured.push({ text, values });
        throw new Error('captured');
      },
    };
    await via(capture, detector).catch(() => {});
    if (captured.length !== 1) throw new Error(`${name}: expected one captured read, got ${captured.length}`);
    const { text, values } = captured[0];
    const [a, b] = await Promise.all([pool.query(text, values), local.query(text, values)]);
    if (name === 'detectGoingDark') compareTimeDerived(`${name} read`, a.rows, b.rows, 'imo', 'gapMinutes', 0.1);
    else compare(`${name} read`, a.rows, b.rows);
  }

  const size = grid.w * grid.h;
  const now = new Date();
  const laneSupabase = await loadLaneDensity(now, size);
  const laneMirrored = await loadLaneRowsMirrored(pool, local);
  const laneMirror = laneDensityFromRows(laneMirrored.rows, now, size);
  if (laneMirrored.source !== 'mirror') {
    failures++;
    console.log('  ✗ lane density: the mirror copy was stale and had to be re-copied');
  }
  // Millions of grid cells: compare in place rather than through compare().
  const laneDiffs = laneSupabase.reduce((n, w, i) => n + (Object.is(w, laneMirror[i]) ? 0 : 1), 0);
  if (laneDiffs === 0 && laneSupabase.length === laneMirror.length) {
    console.log(`  ✓ lane density: ${laneSupabase.filter((w) => w !== 0).length} non-zero cells identical`);
  } else {
    failures++;
    console.log(`  ✗ lane density: ${laneDiffs} cells differ`);
  }
  const learnMirrored = await loadLearnMirrored(pool, local);
  if (learnMirrored.source !== 'mirror') {
    failures++;
    console.log('  ✗ learn state: the mirror copy was stale and had to be re-copied');
  }
  compare('learn state', [await loadLearnState()], [normalizeLearnState(learnMirrored.value)]);
}

main()
  .then(() => {
    console.log(failures === 0 ? 'Mirror is equivalent.' : `${failures} difference(s).`);
  })
  .catch((err) => {
    failures++;
    console.error(err);
  })
  .finally(async () => {
    await pool.end();
    await local.end();
    process.exit(failures === 0 ? 0 : 1);
  });

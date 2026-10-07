/**
 * The harvester's decisions around the local mirror, kept out of
 * harvest-once.ts (which runs on import) so they can be tested directly.
 */
import type { MirrorSyncResult } from '../../lib/db/mirror';
import { formatMB } from './egress-meter';

/** status.json `mirror`: the sync result plus whether this run's heavy reads used it. */
export type MirrorStatus = Omit<MirrorSyncResult, 'bucketsChecked'> & { servedReads: boolean };

const notServed = (reason: string): MirrorStatus => ({
  ready: false, reason, bucketsRepaired: 0, bucketsPending: 0, rowsPulled: 0, bytesPulled: 0, servedReads: false,
});

/**
 * Verify/repair the mirror inside a time-budgeted step. Heavy reads move to it
 * only if the step finished within its budget AND the mirror verified: an
 * abandoned sync that completes later can never switch readers mid-run.
 */
export async function runMirrorSyncStep(deps: {
  enabled: boolean;
  step: (name: string, budgetMs: number, fn: () => Promise<void>) => Promise<boolean>;
  sync: () => Promise<MirrorSyncResult>;
  enableMirrorReads: () => void;
  warn: (message: string) => void;
  log: (message: string) => void;
}): Promise<{ serveReads: boolean; status: MirrorStatus }> {
  if (!deps.enabled) return { serveReads: false, status: notServed('disabled (MIRROR_DATABASE_URL=off)') };

  let result: MirrorSyncResult | null = null;
  const finished = await deps.step('mirror sync', 75_000, async () => { result = await deps.sync(); });
  const r = result as MirrorSyncResult | null;
  if (!finished || !r) return { serveReads: false, status: notServed('mirror sync did not finish in budget') };

  const { bucketsChecked, ...summary } = r;
  deps.log(`Mirror: ${r.ready ? 'verified' : 'NOT ready'} — ${bucketsChecked} hours checked, ${r.bucketsRepaired} copied, ${r.rowsPulled} rows (${formatMB(r.bytesPulled)})${r.reason ? `; ${r.reason}` : ''}`);
  if (!r.ready) {
    deps.warn(`mirror not ready, heavy reads use Supabase this run — ${r.reason}`);
    return { serveReads: false, status: { ...summary, servedReads: false } };
  }
  deps.enableMirrorReads();
  return { serveReads: true, status: { ...summary, servedReads: true } };
}

/**
 * Whether a heavy read the mirror would have served may hit Supabase. With the
 * mirror serving reads: always (it costs no egress). Without it: at most once
 * per interval, and never once the rolling-24h egress budget is spent, so a
 * long mirror outage cannot run the org past its quota. A failed last-run
 * lookup runs the step rather than silently skipping it.
 */
export async function degradedHeavyReadAllowed(input: {
  stepName: string;
  mirrorReady: boolean;
  egress24hBytes: () => number;
  budgetBytes: number;
  lastRunAt: () => Promise<Date | null>;
  now: number;
  minIntervalMs: number;
  warn: (message: string) => void;
  log: (message: string) => void;
}): Promise<boolean> {
  if (input.mirrorReady) return true;
  const used = input.egress24hBytes();
  if (used >= input.budgetBytes) {
    input.warn(`${input.stepName} skipped — mirror unavailable and ${formatMB(used)} of Supabase egress already used in 24h`);
    return false;
  }
  let last: Date | null = null;
  try { last = await input.lastRunAt(); } catch { last = null; }
  if (last && input.now - last.getTime() <= input.minIntervalMs) {
    input.log(`${input.stepName}: mirror unavailable and ran within ${Math.round(input.minIntervalMs / 60_000)}m, skipped`);
    return false;
  }
  return true;
}

/** Per-phase egress with whatever no phase claimed under "other". */
export function attributeEgress(byStep: Record<string, number>, totalBytes: number): Record<string, number> {
  const out = { ...byStep };
  delete out.other;
  const attributed = Object.values(out).reduce((sum, bytes) => sum + bytes, 0);
  return { ...out, other: Math.max(0, totalBytes - attributed) };
}

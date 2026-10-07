/**
 * Supabase egress accounting for the harvester.
 *
 * Supabase bills every byte its pooler sends to this Mac against the
 * organization's egress quota (5 GB/month on Free). In Oct 2026 the harvester
 * re-downloaded data it had just written — ~1 GB/day — and nothing noticed for
 * three weeks. Every run now measures what it downloaded, per step, and keeps
 * a rolling 24h total in status.json so a regression shows up the same day.
 */
import type { EventEmitter } from 'events';

interface MeteredStream { bytesRead?: number; _parent?: { bytesRead?: number } }

export interface EgressMeter {
  /** Bytes received from the database since the meter was attached. */
  totalBytes(): number;
}

/**
 * Count bytes received on every connection the pool opens.
 *
 * Under TLS the client's stream is a TLSSocket whose bytesRead is decrypted
 * payload; its parent net.Socket counts what actually crossed the wire, which
 * is what Supabase bills (measured: 1,003,228 vs 1,000,060 bytes for a 1 MB
 * result). Sockets are kept after the pool closes them because bytesRead stays
 * readable on a closed socket.
 */
export function meterPool(pool: EventEmitter): EgressMeter {
  const sockets: Array<{ bytesRead?: number }> = [];
  pool.on('connect', (client: { connection?: { stream?: MeteredStream } }) => {
    const stream = client?.connection?.stream;
    if (stream) sockets.push(stream._parent ?? stream);
  });
  return { totalBytes: () => sockets.reduce((sum, s) => sum + (s.bytesRead ?? 0), 0) };
}

export interface EgressSample { at: string; bytes: number }

const DAY_MS = 24 * 60 * 60 * 1000;

function isSample(value: unknown): value is EgressSample {
  const s = value as EgressSample;
  return !!s && typeof s.at === 'string' && Number.isFinite(Date.parse(s.at))
    && typeof s.bytes === 'number' && Number.isFinite(s.bytes) && s.bytes >= 0;
}

/**
 * The previous runs' samples plus this one, limited to the last 24h. A sample
 * already recorded for this run (same `at`) is replaced, never added twice.
 */
export function rollEgressHistory(prev: unknown, sample: EgressSample, nowMs: number): EgressSample[] {
  const kept = (Array.isArray(prev) ? prev.filter(isSample) : [])
    .filter((s) => s.at !== sample.at && Date.parse(s.at) > nowMs - DAY_MS);
  return [...kept, sample];
}

export function sumBytes(samples: readonly EgressSample[]): number {
  return samples.reduce((sum, s) => sum + s.bytes, 0);
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

export function egressBudgetWarning(bytes24h: number, budgetBytes: number): string | null {
  if (bytes24h <= budgetBytes) return null;
  return `Supabase egress ${formatMB(bytes24h)} in 24h exceeds the ${formatMB(budgetBytes)} budget`;
}

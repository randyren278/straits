/**
 * db-retry.ts — bounded retry for the harvester's data-critical DB statements.
 *
 * Why this exists: the harvest spends ~90s collecting AIS into memory, then
 * flushes it. AIS is a live broadcast with no cursor or replay, so if the flush
 * throws, that window's positions are gone permanently — the next run collects
 * fresh data, it does not backfill. A single transient blip (Wi-Fi hiccup,
 * laptop wake, Supabase pooler stall exceeding the pool's
 * connectionTimeoutMillis) therefore costs a ~10-minute hole in track history.
 *
 * Each call site wraps ONE statement. A multi-row INSERT is a single statement
 * and so is atomic — it either fully lands or fully fails — which keeps a retry
 * from re-sending rows that already committed. Do not wrap a multi-statement
 * sequence in this.
 */

/** Attempts including the first try. 3 attempts ≈ 1s + 2s of backoff. */
export const DB_RETRY_ATTEMPTS = 3;
/** First backoff; doubles each attempt (1s, 2s). */
export const DB_RETRY_BASE_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying on failure with exponential backoff.
 * Rethrows the LAST error if every attempt fails, so the caller's error
 * handling (status.json + exit 1) still reports an accurate cause.
 *
 * @param label - statement name, used in the retry warning line
 * @param fn - thunk performing exactly one SQL statement
 */
export async function withDbRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === DB_RETRY_ATTEMPTS) break;
      const backoff = DB_RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(
        `${label} failed (attempt ${attempt}/${DB_RETRY_ATTEMPTS}): ` +
        `${(err as Error).message} — retrying in ${backoff}ms`
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

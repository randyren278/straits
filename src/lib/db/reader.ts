/**
 * Where heavy reads of the harvester's own tables go.
 *
 * Defaults to the Supabase pool. The harvester points it at its verified local
 * mirror (src/lib/db/mirror.ts) for the rest of a run, so those reads stop
 * costing Supabase egress. Only queries that touch nothing but
 * vessel_positions, vessels and vessel_fallback_metadata, within the last few
 * days, may use it — everything else stays on `pool`. Nothing outside the
 * harvester ever changes it, so on Vercel this is always `pool`.
 */
import type { QueryResult, QueryResultRow } from 'pg';
import { pool } from './index';

export interface Reader {
  query<R extends QueryResultRow = any>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

let current: Reader = pool;

export function readerPool(): Reader {
  return current;
}

/** Route mirrored-table reads to `reader`; null restores the Supabase pool. */
export function setReaderPool(reader: Reader | null): void {
  current = reader ?? pool;
}

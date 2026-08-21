import { pool } from '../db/index';
import type { SanctionEntry } from '../external/opensanctions';

const DEFAULT_MIN_RETAIN_RATIO = 0.5;
const BOOTSTRAP_ROW_THRESHOLD = 100;

export class SanctionsSnapshotRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SanctionsSnapshotRejectedError';
  }
}

function configuredRetainRatio(): number {
  const parsed = Number(process.env.SANCTIONS_MIN_RETAIN_RATIO);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1
    ? parsed
    : DEFAULT_MIN_RETAIN_RATIO;
}

/**
 * Fail closed before a sanctions snapshot is allowed to reconcile deletions.
 *
 * A successful HTTP/CSV response can still be truncated upstream. Comparing
 * unique incoming IMO coverage against the currently committed snapshot keeps a
 * partial download from deleting most of the intelligence table. Small/empty
 * databases are treated as bootstrap environments and do not require historical
 * coverage, but an empty fetch is always rejected because it is never useful.
 */
export async function validateSanctionsSnapshot(entries: SanctionEntry[]): Promise<{
  incomingUnique: number;
  currentCount: number;
  retainRatio: number;
}> {
  const incomingUnique = new Set(entries.map((entry) => entry.imo).filter(Boolean)).size;
  if (incomingUnique === 0) {
    throw new SanctionsSnapshotRejectedError('Refusing to reconcile an empty sanctions snapshot');
  }

  const result = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM vessel_sanctions'
  );
  const currentCount = Number(result.rows[0]?.count ?? 0);
  const minRetainRatio = configuredRetainRatio();
  const retainRatio = currentCount > 0 ? incomingUnique / currentCount : 1;

  if (currentCount >= BOOTSTRAP_ROW_THRESHOLD && retainRatio < minRetainRatio) {
    throw new SanctionsSnapshotRejectedError(
      `Sanctions snapshot coverage ${retainRatio.toFixed(3)} is below required ${minRetainRatio.toFixed(3)} ` +
        `(${incomingUnique} incoming unique IMOs vs ${currentCount} committed rows)`
    );
  }

  return { incomingUnique, currentCount, retainRatio };
}

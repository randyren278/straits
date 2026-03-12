/**
 * Sanctions Matcher (INTL-01)
 *
 * Matches vessel IMO numbers against OpenSanctions and other sanctions lists.
 * Supports OFAC, EU, and UN sanctions lists.
 */
import { getSanction } from '../db/sanctions';

// Re-export normalizeIMO from opensanctions for backwards compatibility
export { normalizeIMO } from '../external/opensanctions';

export interface SanctionMatch {
  imo: string;
  authority: 'OFAC' | 'EU' | 'UN';
  listDate: Date | null;
  reason: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceUrl: string | null;
}

/**
 * Look up a vessel in sanctions lists by IMO number.
 * Queries local database for cached sanctions data.
 *
 * @param imo - Vessel IMO number (normalized)
 * @returns Sanction match if found, null otherwise
 */
export async function matchVesselSanctions(
  imo: string
): Promise<SanctionMatch | null> {
  const record = await getSanction(imo);
  if (!record) return null;

  return {
    imo: record.imo,
    authority: record.sanctioningAuthority as 'OFAC' | 'EU' | 'UN',
    listDate: record.listDate,
    reason: record.reason,
    confidence: (record.confidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'HIGH',
    sourceUrl: null, // sourceUrl not stored in SanctionRecord
  };
}

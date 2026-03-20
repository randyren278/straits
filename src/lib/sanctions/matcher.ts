/**
 * Sanctions Matcher (INTL-01, M005)
 *
 * Matches vessel IMO numbers against OpenSanctions maritime sanctions lists.
 * Supports OFAC, EU, UK, Canada, UN, and 23 other data sources.
 */
import { getSanction } from '../db/sanctions';
import type { SanctionRecord } from '../db/sanctions';

// Re-export normalizeIMO from opensanctions for backwards compatibility
export { normalizeIMO } from '../external/opensanctions';

export interface SanctionMatch {
  imo: string;
  authority: string;
  listDate: Date | null;
  reason: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceUrl: string | null;
  riskCategory: string | null;
  datasets: string[] | null;
  aliases: string[] | null;
  opensanctionsUrl: string | null;
  flag: string | null;
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
    authority: record.sanctioningAuthority,
    listDate: record.listDate,
    reason: record.reason,
    confidence: (record.confidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'HIGH',
    sourceUrl: record.opensanctionsUrl || null,
    riskCategory: record.riskCategory || null,
    datasets: record.datasets || null,
    aliases: record.aliases || null,
    opensanctionsUrl: record.opensanctionsUrl || null,
    flag: record.flag || null,
  };
}

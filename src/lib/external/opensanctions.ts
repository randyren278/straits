/**
 * OpenSanctions data fetcher and CSV parser.
 * INTL-01: Sanctions matching for vessels.
 */
import Papa from 'papaparse';

export interface SanctionEntry {
  imo: string;
  name: string;
  authority: 'OFAC' | 'EU' | 'UN';
  listDate: Date | null;
  reason: string | null;
  sourceUrl: string;
}

/**
 * Normalize an IMO number to 7-digit format.
 * Removes "IMO" prefix if present and pads with leading zeros.
 *
 * @param imo - Raw IMO number string
 * @returns Normalized 7-digit IMO string, or null if invalid
 */
export function normalizeIMO(imo: string | null | undefined): string | null {
  if (!imo) return null;

  // Remove "IMO " prefix if present (case-insensitive), then trim whitespace
  const cleaned = imo.replace(/^IMO\s*/i, '').trim();

  // Return null for empty or non-numeric strings
  if (!cleaned || !/^\d+$/.test(cleaned)) return null;

  // Pad to 7 digits with leading zeros
  return cleaned.padStart(7, '0');
}

/**
 * Map dataset string to sanctioning authority.
 */
function mapAuthority(datasets: string): 'OFAC' | 'EU' | 'UN' {
  if (datasets?.includes('us_ofac')) return 'OFAC';
  if (datasets?.includes('eu_')) return 'EU';
  return 'UN';
}

/**
 * Parse CSV text from OpenSanctions into SanctionEntry objects.
 *
 * @param csvText - Raw CSV content
 * @returns Array of parsed sanction entries with valid IMO numbers
 */
export function parseSanctionsCSV(csvText: string): SanctionEntry[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // Filter for entries with IMO numbers (vessels)
  return result.data
    .filter((row) => row.imo_number)
    .map((row) => ({
      imo: normalizeIMO(row.imo_number)!,
      name: row.name || '',
      authority: mapAuthority(row.datasets),
      listDate: row.first_seen ? new Date(row.first_seen) : null,
      reason: row.topics || null,
      sourceUrl: row.source_url || '',
    }))
    .filter((entry) => entry.imo); // Remove entries with invalid IMO
}

/**
 * Fetch the sanctions list from OpenSanctions API.
 *
 * @returns Array of SanctionEntry objects from OpenSanctions maritime CSV
 */
export async function fetchSanctionsList(): Promise<SanctionEntry[]> {
  // OpenSanctions provides a maritime-focused dataset
  const url =
    'https://data.opensanctions.org/datasets/latest/default/targets.simple.csv';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sanctions: ${response.status}`);
  }

  const csvText = await response.text();
  return parseSanctionsCSV(csvText);
}

/**
 * OpenSanctions Maritime CSV fetcher and parser.
 *
 * Fetches the purpose-built maritime dataset from OpenSanctions which includes
 * vessels and organizations with IMO numbers, risk categories, flag states,
 * MMSI numbers, aliases, and listing datasets from 23 data sources.
 *
 * CSV columns: type, caption, imo, risk, countries, flag, mmsi, id, url, datasets, aliases
 *
 * M005-S01: Switched from generic targets.simple.csv (broken — no imo_number column)
 * to maritime-specific maritime.csv with dedicated vessel columns.
 */
import Papa from 'papaparse';

/**
 * Risk categories from the OpenSanctions maritime CSV.
 *
 * - sanction:              Directly sanctioned by a government authority
 * - mare.detained:         Detained by port state control
 * - mare.detained;reg.warn: Detained with regulatory warnings
 * - mare.shadow;poi:       Shadow fleet vessel (person of interest)
 * - poi:                   Person/entity of interest (not directly sanctioned)
 * - reg.warn:              Regulatory warning only
 * - (empty):               Listed but no specific risk category
 */
export type MaritimeRiskCategory =
  | 'sanction'
  | 'mare.detained'
  | 'mare.detained;reg.warn'
  | 'mare.shadow;poi'
  | 'poi'
  | 'reg.warn'
  | '';

export interface SanctionEntry {
  /** Normalized 7-digit IMO number */
  imo: string;
  /** Vessel or organization name */
  name: string;
  /** Entity type: VESSEL or ORGANIZATION */
  vesselType: 'VESSEL' | 'ORGANIZATION';
  /** Risk category from OpenSanctions */
  riskCategory: MaritimeRiskCategory;
  /** All dataset IDs that list this entity (semicolon-separated in CSV) */
  datasets: string[];
  /** Flag state ISO code (may be empty) */
  flag: string;
  /** MMSI number (may be empty — only ~2,400 of 16,900 entries have it) */
  mmsi: string;
  /** All known aliases (semicolon-separated in CSV) */
  aliases: string[];
  /** OpenSanctions entity URL */
  opensanctionsUrl: string;
  /** All associated countries */
  countries: string[];

  // Legacy fields for backward compatibility
  /** Primary sanctioning authority derived from datasets */
  authority: string;
  /** Date vessel was first seen in sanctions lists (not available in maritime CSV — always null) */
  listDate: null;
  /** Risk category used as reason field for backward compatibility */
  reason: string | null;
  /** OpenSanctions profile URL */
  sourceUrl: string;
}

/**
 * Normalize an IMO number to 7-digit format.
 * Removes "IMO" prefix if present and pads with leading zeros.
 *
 * @param imo - Raw IMO number string (e.g., "IMO9187629", "1234567", "IMO 123")
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
 * Derive the primary sanctioning authority from a list of dataset IDs.
 * Checks for the most significant authority first (OFAC > EU > UK > Canada > UN > other).
 */
function deriveAuthority(datasets: string[]): string {
  const joined = datasets.join(';');
  if (joined.includes('us_ofac')) return 'OFAC';
  if (joined.includes('eu_')) return 'EU';
  if (joined.includes('gb_')) return 'UK';
  if (joined.includes('ca_')) return 'CA';
  if (joined.includes('un_')) return 'UN';
  if (joined.includes('ch_seco')) return 'CH';
  if (joined.includes('ua_war')) return 'UA';
  if (joined.includes('fr_')) return 'FR';
  if (joined.includes('be_')) return 'BE';
  if (joined.includes('mc_')) return 'MC';
  if (joined.includes('ae_')) return 'AE';
  // Detention / port state control sources
  if (joined.includes('_mou_')) return 'PSC';
  return 'OTHER';
}

/**
 * Raw row shape from the maritime CSV.
 */
interface MaritimeCSVRow {
  type: string;
  caption: string;
  imo: string;
  risk: string;
  countries: string;
  flag: string;
  mmsi: string;
  id: string;
  url: string;
  datasets: string;
  aliases: string;
}

/**
 * Validate that the CSV has the expected maritime columns.
 * Fails fast if OpenSanctions changes their schema.
 */
function validateHeaders(headers: string[]): void {
  const required = ['type', 'caption', 'imo', 'risk', 'flag', 'mmsi', 'url', 'datasets'];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `Maritime CSV schema mismatch: missing columns [${missing.join(', ')}]. ` +
        `Expected maritime-specific CSV from OpenSanctions. Got columns: [${headers.join(', ')}]`
    );
  }
}

/**
 * Parse CSV text from OpenSanctions maritime dataset into SanctionEntry objects.
 * Only includes entries with valid IMO numbers.
 *
 * @param csvText - Raw CSV content from maritime.csv
 * @returns Array of parsed sanction entries with valid IMO numbers
 */
export function parseMaritimeCSV(csvText: string): SanctionEntry[] {
  const result = Papa.parse<MaritimeCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // Validate headers on the first parse
  if (result.meta.fields) {
    validateHeaders(result.meta.fields);
  }

  return result.data
    .filter((row) => {
      // Must have an IMO number
      const imo = normalizeIMO(row.imo);
      return imo !== null;
    })
    .map((row) => {
      const datasets = row.datasets ? row.datasets.split(';').filter(Boolean) : [];
      const aliases = row.aliases ? row.aliases.split(';').filter(Boolean) : [];
      const countries = row.countries ? row.countries.split(';').filter(Boolean) : [];

      return {
        imo: normalizeIMO(row.imo)!,
        name: row.caption || '',
        vesselType: (row.type as 'VESSEL' | 'ORGANIZATION') || 'VESSEL',
        riskCategory: (row.risk || '') as MaritimeRiskCategory,
        datasets,
        flag: row.flag || '',
        mmsi: row.mmsi || '',
        aliases,
        opensanctionsUrl: row.url || '',
        countries,
        // Legacy compatibility
        authority: deriveAuthority(datasets),
        listDate: null,
        reason: row.risk || null,
        sourceUrl: row.url || '',
      };
    });
}

// Backward compatibility alias
export const parseSanctionsCSV = parseMaritimeCSV;

/**
 * OpenSanctions maritime dataset URL.
 * Updated daily. Contains ~16,900 entries (vessels + organizations) with IMO numbers.
 * Free for non-commercial use (CC BY-NC 4.0).
 */
const MARITIME_CSV_URL =
  'https://data.opensanctions.org/datasets/latest/maritime/maritime.csv';

/**
 * Fetch the maritime sanctions list from OpenSanctions.
 *
 * @returns Array of SanctionEntry objects from the maritime-specific CSV
 */
export async function fetchSanctionsList(): Promise<SanctionEntry[]> {
  const response = await fetch(MARITIME_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch maritime sanctions: ${response.status}`);
  }

  const csvText = await response.text();
  return parseMaritimeCSV(csvText);
}

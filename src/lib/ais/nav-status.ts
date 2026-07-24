/**
 * AIS Navigational Status Decoding
 *
 * Maps the AIS nav_status integer (0–15) to a human-readable label.
 * Reference: ITU-R M.1371 navigational status codes.
 */

/** AIS navigational status code → human-readable label. */
const NAV_STATUS_LABELS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  9: 'Reserved (HSC)',
  10: 'Reserved (WIG)',
  11: 'Towing astern',
  12: 'Pushing ahead / towing alongside',
  13: 'Reserved',
  14: 'AIS-SART / MOB / EPIRB',
  15: 'Undefined',
};

/**
 * Decode an AIS navigational status integer into a human-readable label.
 *
 * @param n - AIS nav_status code (0–15), or null if not reported
 * @returns Human-readable status label, or 'Unknown' when null/unrecognised
 */
export function decodeNavStatus(n: number | null): string {
  if (n == null) return 'Unknown';
  return NAV_STATUS_LABELS[n] ?? 'Undefined';
}

/** Nav-status codes indicating the vessel is stationary by declaration. */
export const STATIONARY_NAV_STATUSES = new Set<number>([1, 5]);

/**
 * Whether a nav_status code declares the vessel at anchor (1) or moored (5).
 *
 * @param n - AIS nav_status code, or null
 * @returns True if the vessel declares itself anchored or moored
 */
export function isDeclaredStationary(n: number | null): boolean {
  return n != null && STATIONARY_NAV_STATUSES.has(n);
}

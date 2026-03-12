/**
 * Vessel filtering utilities for map display.
 * Requirements: MAP-03
 */
import type { VesselWithPosition } from '@/types/vessel';

/**
 * Filter vessels to show only tankers (ship types 80-89).
 * AIS ship type codes 80-89 represent tanker vessels:
 * - 80: Tanker
 * - 81-84: Various tanker subtypes
 * - 85: Tanker, hazardous category A
 * - 86-88: Tanker, hazardous category B/C/D
 * - 89: Tanker, no additional info
 *
 * @param vessels - Array of vessels to filter
 * @param tankersOnly - If true, return only tankers; if false, return all
 * @returns Filtered array of vessels
 */
export function filterTankers(
  vessels: VesselWithPosition[],
  tankersOnly: boolean
): VesselWithPosition[] {
  if (!tankersOnly) {
    return vessels;
  }
  return vessels.filter((v) => v.shipType >= 80 && v.shipType <= 89);
}

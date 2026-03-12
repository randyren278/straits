/**
 * Route Classification (HIST-01)
 *
 * Classifies vessel destinations to route regions.
 * Used for grouping traffic data by destination area.
 */
import type { RouteRegion } from '@/types/analytics';

/** Keywords to match for each destination region */
export const REGION_KEYWORDS: Record<RouteRegion, string[]> = {
  east_asia: ['CHINA', 'JAPAN', 'KOREA', 'TAIWAN', 'SGP', 'SINGAPORE', 'HONG KONG', 'INDIA', 'VIETNAM', 'THAILAND'],
  europe: ['ROTTERDAM', 'ANTWERP', 'UK', 'SPAIN', 'ITALY', 'GREECE', 'TURKEY', 'HAMBURG', 'MARSEILLE'],
  americas: ['US', 'USA', 'HOUSTON', 'LOUISIANA', 'BRAZIL', 'MEXICO', 'GULF'],
  unknown: [], // Never matches keywords
};

/**
 * Classify vessel destination to route region.
 * Uses keyword substring matching on destination field.
 *
 * @param destination - AIS destination field (may be null or abbreviated)
 * @returns Matched route region or 'unknown'
 */
export function classifyRoute(destination: string | null): RouteRegion {
  if (!destination) return 'unknown';

  const upper = destination.toUpperCase();

  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (region === 'unknown') continue;
    if (keywords.some(kw => upper.includes(kw))) {
      return region as RouteRegion;
    }
  }

  return 'unknown';
}

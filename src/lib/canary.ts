/** Canary features are available only on explicitly enabled non-production deployments. */
export function isCanaryEnabled(): boolean {
  return process.env.STRAITS_CANARY === '1' && process.env.VERCEL_ENV !== 'production';
}

export const CANARY_APP_TABLES = ['watchlist', 'alerts', 'performance_samples'] as const;
export type CanaryAppTable = (typeof CANARY_APP_TABLES)[number];

/**
 * Resolve an application-owned table to its isolated schema on the canary.
 * Names are a closed union because SQL identifiers cannot be parameterized.
 */
export function appTable(table: CanaryAppTable): string {
  return isCanaryEnabled() ? `canary.${table}` : table;
}

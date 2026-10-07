/**
 * Postgres for the integration tests: MIRROR_TEST_ADMIN_URL, else the Mac's
 * local mirror server. Locally an unreachable server skips those tests; in CI
 * (CI=true) it fails the run, so they can never pass by silently not running.
 */
import { Pool } from 'pg';

export const PG_ADMIN_URL = process.env.MIRROR_TEST_ADMIN_URL ?? 'postgres://postgres@127.0.0.1:5433/postgres';

/** The same server, another database. */
export const pgUrl = (db: string) => PG_ADMIN_URL.replace(/\/[^/]*$/, `/${db}`);

export async function pgAvailable(): Promise<boolean> {
  const p = new Pool({ connectionString: PG_ADMIN_URL, connectionTimeoutMillis: 2000, max: 1 });
  try {
    await p.query('SELECT 1');
    return true;
  } catch (err) {
    if (process.env.CI) {
      throw new Error(`Postgres integration tests need a server in CI (${PG_ADMIN_URL}): ${(err as Error).message}`);
    }
    return false;
  } finally {
    await p.end().catch(() => {});
  }
}

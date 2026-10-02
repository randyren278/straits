#!/usr/bin/env node
/**
 * Provision the least-privilege Straits canary Postgres role.
 *
 * Safe by default: prints a plan only. After reviewing the generated plan,
 * run with --apply and DATABASE_URL set to the intended admin connection.
 * Secrets and database error messages are never written to stdout/stderr.
 */
import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const ROLE = 'straits_canary';
const ENV_OUT = path.resolve('.env.canary.local');
const APPLY = process.argv.includes('--apply');
const OBSERVATION_TABLES = [
  'vessels',
  'vessel_fallback_metadata',
  'vessel_positions',
  'vessel_latest_positions',
  'vessel_daily_presence',
  'vessel_sanctions',
  'oil_prices',
  'news_items',
  'vessel_anomalies',
  'vessel_destination_changes',
  'vessel_proximity_events',
  'vessel_rendezvous',
  'vessel_risk_scores',
  'vessel_track_state',
  'vessel_crossings',
  'chokepoint_daily',
  'collection_buckets',
  'track_engine_state',
  'lane_density',
];

function safeError(error) {
  // PostgreSQL error.message/detail can contain submitted SQL, so expose only
  // the stable SQLSTATE and a generic failure label.
  const code = typeof error?.code === 'string' ? ` (SQLSTATE ${error.code})` : '';
  return `Database operation failed${code}. No SQL or credentials were printed.`;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseEnv(text) {
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith('DATABASE_URL='));
  if (!line) return null;
  const raw = line.slice('DATABASE_URL='.length).trim();
  try { return new URL(raw); } catch { return null; }
}

async function existingCanaryUrl() {
  try {
    return parseEnv(await readFile(ENV_OUT, 'utf8'));
  } catch { return null; }
}

function buildCanaryUrl(adminUrl, password) {
  const url = new URL(adminUrl.toString());
  const adminUser = decodeURIComponent(url.username);
  const projectRef = adminUser.includes('.') ? adminUser.slice(adminUser.lastIndexOf('.') + 1) : null;
  url.username = encodeURIComponent(projectRef ? `${ROLE}.${projectRef}` : ROLE);
  url.password = encodeURIComponent(password);
  return url.toString();
}

function envFile(databaseUrl) {
  return [
    `DATABASE_URL=${databaseUrl}`,
    'STRAITS_CANARY=1',
    'NEXT_PUBLIC_STRAITS_CANARY=1',
    '',
  ].join('\n');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL must point to the intended database admin connection.');
    process.exitCode = 2;
    return;
  }

  const adminUrl = new URL(process.env.DATABASE_URL);

  if (!APPLY) {
    console.log('Canary database setup plan (dry run; no connection opened):');
    console.log(`- Create role ${ROLE} with least-privilege login flags if absent; validate flags and preserve credentials if it already exists.`);
    console.log('- Grant schema USAGE and table DML only in schema canary; revoke PUBLIC access there.');
    console.log('- Create immutable investigation story storage with SELECT and INSERT only.');
    console.log(`- Grant SELECT and add role-specific RLS policies only for the fixed observation allowlist (${OBSERVATION_TABLES.length} table names).`);
    console.log('- Revoke this role’s privileges on every current public table and sequence before allowlisting.');
    console.log('- Write .env.canary.local with mode 0600. Credentials are omitted from this plan.');
    console.log('Review the plan and then run with --apply to provision.');
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    // Discover the active public catalog read-only, then intersect it with a
    // source-controlled allowlist. Newly added tables remain denied by default.
    const discovered = await client.query(`
      SELECT c.relname AS name, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);
    const publicTables = new Map(discovered.rows.map((row) => [row.name, row]));
    const observationTables = OBSERVATION_TABLES.filter((name) => publicTables.has(name));
    const missingRls = observationTables.filter((name) => !publicTables.get(name).rls);
    if (missingRls.length) throw new Error('OBSERVATION_RLS_MISSING');

    const existingRole = await client.query(`
      SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
        r.rolbypassrls, r.rolinherit, r.rolcanlogin,
        EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS has_memberships,
        (EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE c.relowner = r.oid AND n.nspname = 'public')
         OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'public' AND n.nspowner = r.oid)) AS owns_public_objects
      FROM pg_roles r WHERE r.rolname = '${ROLE}'
    `);
    const roleState = existingRole.rows[0];
    if (roleState && (
      roleState.rolsuper
      || roleState.rolcreatedb
      || roleState.rolcreaterole
      || roleState.rolreplication
      || roleState.rolbypassrls
      || roleState.rolinherit
      || !roleState.rolcanlogin
      || roleState.has_memberships
      || roleState.owns_public_objects
    )) {
      throw new Error('CANARY_ROLE_NOT_ISOLATED');
    }

    const priorCanaryUrl = await existingCanaryUrl();
    const adminUser = decodeURIComponent(adminUrl.username);
    const projectRef = adminUser.includes('.') ? adminUser.slice(adminUser.lastIndexOf('.') + 1) : null;
    const expectedCanaryUser = projectRef ? `${ROLE}.${projectRef}` : ROLE;
    const priorMatchesTarget = priorCanaryUrl
      && priorCanaryUrl.hostname === adminUrl.hostname
      && priorCanaryUrl.port === adminUrl.port
      && priorCanaryUrl.pathname === adminUrl.pathname
      && decodeURIComponent(priorCanaryUrl.username) === expectedCanaryUser;
    if (roleState && !priorMatchesTarget) throw new Error('EXISTING_ROLE_CREDENTIAL_MISSING');
    const password = priorMatchesTarget
      ? decodeURIComponent(priorCanaryUrl.password)
      : randomBytes(48).toString('base64url');
    const canaryUrl = buildCanaryUrl(adminUrl, password);

    await client.query('BEGIN');
    try {
      if (!roleState) {
        await client.query(`CREATE ROLE ${ROLE} LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOSUPERUSER PASSWORD ${sqlLiteral(password)}`);
      }
      const createPrivilege = await client.query("SELECT has_schema_privilege('straits_canary', 'public', 'CREATE') AS allowed");
      if (createPrivilege.rows[0]?.allowed) throw new Error('PUBLIC_SCHEMA_CREATE_INHERITED');
      const schemaSql = await readFile(new URL('./canary-schema.sql', import.meta.url), 'utf8');
      await client.query(schemaSql);
      const storiesSql = await readFile(new URL('./canary-stories.sql', import.meta.url), 'utf8');
      await client.query(storiesSql);
      await client.query(`REVOKE ALL ON SCHEMA canary FROM PUBLIC`);
      await client.query(`GRANT USAGE ON SCHEMA canary TO ${ROLE}`);
      await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA canary FROM PUBLIC`);
      await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA canary FROM PUBLIC`);
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON canary.watchlist, canary.alerts, canary.performance_samples TO ${ROLE}`);
      await client.query(`GRANT USAGE, SELECT ON SEQUENCE canary.alerts_id_seq TO ${ROLE}`);

      await client.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
      await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);
      await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${ROLE}`);
      const privateRead = await client.query(`
        SELECT c.relname
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND ((NOT (c.relname = ANY($1::text[])) AND has_table_privilege('${ROLE}', c.oid, 'SELECT'))
               OR has_table_privilege('${ROLE}', c.oid, 'INSERT')
               OR has_table_privilege('${ROLE}', c.oid, 'UPDATE')
               OR has_table_privilege('${ROLE}', c.oid, 'DELETE'))
        ORDER BY c.relname LIMIT 1
      `, [observationTables]);
      if (privateRead.rowCount) throw new Error('PUBLIC_READ_INHERITED');

      // Remove only policies created by this script from any public table, so
      // a table removed from the allowlist does not retain stale canary access.
      for (const { name } of discovered.rows) {
        await client.query(`DROP POLICY IF EXISTS straits_canary_observe_select ON public.${quoteIdent(name)}`);
      }
      for (const name of observationTables) {
        await client.query(`GRANT SELECT ON TABLE public.${quoteIdent(name)} TO ${ROLE}`);
        await client.query(`CREATE POLICY straits_canary_observe_select ON public.${quoteIdent(name)} FOR SELECT TO ${ROLE} USING (true)`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }

    await writeFile(ENV_OUT, envFile(canaryUrl), { mode: 0o600, flag: 'w' });
    await chmod(ENV_OUT, 0o600);
    console.log(`Provisioned ${ROLE}; restricted credentials saved to .env.canary.local (mode 0600).`);
    console.log(`Observation tables granted: ${observationTables.join(', ') || '(none found)'}.`);
  } catch (error) {
    if (error?.message === 'OBSERVATION_RLS_MISSING') {
      console.error('Setup stopped: an allowlisted public observation table has RLS disabled. Review the schema before provisioning.');
    } else if (error?.message === 'CANARY_ROLE_NOT_ISOLATED') {
      console.error('Setup stopped: the existing canary role does not have the required least-privilege flags or owns public objects. Resolve that state before provisioning.');
    } else if (error?.message === 'EXISTING_ROLE_CREDENTIAL_MISSING') {
      console.error('Setup stopped: the existing canary role has no matching local credential file. Preserve or rotate that role credential explicitly before retrying.');
    } else if (error?.message === 'PUBLIC_SCHEMA_CREATE_INHERITED') {
      console.error('Setup stopped: public currently grants CREATE to this role through inherited privileges. Remove that shared grant in a separately reviewed database change, then retry.');
    } else if (error?.message === 'PUBLIC_READ_INHERITED') {
      console.error('Setup stopped: the role receives SELECT on a non-observation public table through shared privileges. Remove that shared grant in a separately reviewed database change, then retry.');
    } else {
      console.error(safeError(error));
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});

#!/usr/bin/env node
/** Verify canary database isolation using the runtime canary credentials. */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

function safeError(error) {
  const code = typeof error?.code === 'string' ? ` (SQLSTATE ${error.code})` : '';
  return `Canary verification failed${code}. Database details and credentials were omitted.`;
}

async function expectDenied(client, label, sql) {
  try {
    await client.query(sql);
  } catch (error) {
    if (error?.code === '42501') return;
    throw new Error(`DENIAL_PROBE_ERROR:${label}:${error?.code ?? 'unknown'}`);
  }
  throw new Error(`UNEXPECTED_PERMISSION:${label}`);
}

async function verify() {
  if (!process.env.DATABASE_URL || process.env.STRAITS_CANARY !== '1' || process.env.NEXT_PUBLIC_STRAITS_CANARY !== '1') {
    console.error('Load .env.canary.local with Node --env-file; required canary flags or DATABASE_URL are missing.');
    process.exitCode = 2;
    return;
  }
  let username;
  try { username = decodeURIComponent(new URL(process.env.DATABASE_URL).username); } catch {
    console.error('DATABASE_URL is invalid.');
    process.exitCode = 2;
    return;
  }
  if (username !== 'straits_canary' && !/^straits_canary\.[A-Za-z0-9_-]+$/.test(username)) {
    console.error('DATABASE_URL must authenticate as the straits_canary role.');
    process.exitCode = 2;
    return;
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const identity = await client.query('SELECT current_user AS role');
    if (identity.rows[0]?.role !== 'straits_canary') throw new Error('ROLE_IDENTITY_MISMATCH');

    const observation = await client.query('SELECT imo FROM public.vessels LIMIT 1');
    if (observation.rowCount < 1) throw new Error('NO_OBSERVATION_ROWS');

    await expectDenied(client, 'public.watchlist SELECT', 'SELECT * FROM public.watchlist LIMIT 1');
    await expectDenied(client, 'public.vessels UPDATE', 'UPDATE public.vessels SET imo = imo WHERE false');

    const forbiddenName = `straits_canary_permission_probe_${randomUUID().replaceAll('-', '')}`;
    await client.query('BEGIN');
    try {
      await expectDenied(client, 'public CREATE', `CREATE TABLE public.${forbiddenName} (id integer)`);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }

    const sampleId = randomUUID();
    await client.query('BEGIN');
    try {
      const inserted = await client.query(`
        INSERT INTO canary.performance_samples
          (sample_id, metric, route, device, connection, value, build_sha)
        VALUES ($1, 'LCP', '/canary-probe', 'desktop', 'unknown', 1, 'canary-verification')
        RETURNING sample_id, metric
      `, [sampleId]);
      const readBack = await client.query(`
        SELECT sample_id, metric FROM canary.performance_samples
        WHERE sample_id = $1 AND metric = 'LCP'
      `, [sampleId]);
      if (inserted.rowCount !== 1 || readBack.rowCount !== 1 || readBack.rows[0].sample_id !== sampleId) {
        throw new Error('CANARY_WRITE_ROUNDTRIP_FAILED');
      }
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.log('Canary database verified: public vessel observations readable; private public tables and public writes denied; canary performance write/read succeeded and was rolled back.');
  } catch (error) {
    if (error?.message === 'UNEXPECTED_PERMISSION:public.watchlist SELECT') {
      console.error('Canary verification failed: role can read public.watchlist.');
    } else if (error?.message === 'UNEXPECTED_PERMISSION:public.vessels UPDATE') {
      console.error('Canary verification failed: role can update public.vessels.');
    } else if (error?.message === 'UNEXPECTED_PERMISSION:public CREATE') {
      console.error('Canary verification failed: role can create objects in public.');
    } else if (error?.message?.startsWith('DENIAL_PROBE_ERROR:')) {
      const [, probe, code] = error.message.split(':');
      console.error(`Canary verification failed: ${probe} did not fail with permission denied (SQLSTATE ${code}).`);
    } else if (error?.message === 'ROLE_IDENTITY_MISMATCH') {
      console.error('Canary verification failed: connected role identity is not straits_canary.');
    } else if (error?.message === 'NO_OBSERVATION_ROWS') {
      console.error('Canary verification failed: public.vessels returned no rows.');
    } else {
      console.error(safeError(error));
    }
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

verify().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});

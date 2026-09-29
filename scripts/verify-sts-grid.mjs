/** Transactional check for adjacent-cell STS candidates on local Postgres. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost');
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  throw new Error('Refusing STS fixture on a non-local database');
}
const source = await readFile('src/lib/detection/sts-transfer.ts', 'utf8');
const match = source.match(/const result = await pool\.query<StsRow>\(`([\s\S]*?)`\);/);
assert.ok(match, 'STS candidate SQL not found');
const sql = match[1].replace('${POSITION_FRESHNESS_MINUTES}', '30').replace('${STS_DISTANCE_KM}', '0.926');
assert.ok(!sql.includes('${'), 'STS SQL has unresolved template values');

const suffix = String(process.pid).padStart(7, '0').slice(-7);
const imoA = `7${suffix}`, imoB = `8${suffix}`, imoDuplicate = `6${suffix}`;
const mmsiA = `91${suffix}`, mmsiB = `92${suffix}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`INSERT INTO vessels(imo,mmsi,name) VALUES
    ($1,$4,'GRID A'),($2,$5,'GRID B'),($3,$4,'GRID DUPLICATE')`,
  [imoA, imoB, imoDuplicate, mmsiA, mmsiB]);
  await client.query(`INSERT INTO vessel_positions(time,mmsi,imo,latitude,longitude,source) VALUES
    (NOW(),$1,$3,25.024,56.024,'aisstream'),
    (NOW(),$2,$4,25.027,56.027,'aisstream')`, [mmsiA, mmsiB, imoA, imoB]);
  const { rows } = await client.query(sql);
  const includes = (a, b) => rows.some((row) => row.imo_a === a && row.imo_b === b);
  assert.ok(includes(imoA, imoB), 'adjacent spatial cells must produce a close pair');
  assert.ok(!includes(imoDuplicate, imoA), 'two identities for one MMSI are one contact');
  console.log('PASS STS candidate grid: adjacent cells and duplicate MMSI');
} finally {
  await client.query('ROLLBACK');
  await client.end();
}

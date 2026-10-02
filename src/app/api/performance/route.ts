/** Small first-party sink for sampled Web Vitals and map readiness. */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { appTable } from '@/lib/canary';

const METRICS = new Set(['LCP', 'INP', 'CLS', 'MAP_READY', 'MAP_INIT_ERROR', 'MAP_DATA_ERROR', 'SHELL_READY', 'SNAPSHOT_RECEIVED', 'MAP_STYLE_READY']);
const ROUTES = new Set(['/dashboard', '/fleet', '/analytics', '/about', '/investigations']);
const DEVICES = new Set(['phone', 'tablet', 'desktop']);
const CONNECTIONS = new Set(['slow-2g', '2g', '3g', '4g', 'unknown']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin telemetry rejected' }, { status: 403 });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 1024) {
    return NextResponse.json({ error: 'Telemetry payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return NextResponse.json({ error: 'Telemetry payload too large' }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 });
  }
  const { sampleId, metric, value, route, device, connection } = body as Record<string, unknown>;
  if (
    typeof sampleId !== 'string' || !UUID.test(sampleId) ||
    typeof metric !== 'string' || !METRICS.has(metric) ||
    typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (metric === 'CLS' ? 10 : 120_000) ||
    typeof route !== 'string' || !ROUTES.has(route) ||
    typeof device !== 'string' || !DEVICES.has(device) ||
    typeof connection !== 'string' || !CONNECTIONS.has(connection)
  ) {
    return NextResponse.json({ error: 'Invalid telemetry fields' }, { status: 400 });
  }

  try {
    await pool.query(
      `INSERT INTO ${appTable('performance_samples')} (sample_id, metric, route, device, connection, value, build_sha)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (sample_id, metric) DO UPDATE SET
         value = EXCLUDED.value, updated_at = NOW()`,
      [sampleId, metric, route, device, connection, value, process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'],
    );
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'performance-sample-write-failed', reason: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ error: 'Telemetry unavailable' }, { status: 503 });
  }
}

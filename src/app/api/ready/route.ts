import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/index';

/**
 * Readiness probe for traffic-serving dependencies.
 *
 * Unlike /api/health, this checks the database because the dashboard cannot
 * provide meaningful intelligence without it. A dependency failure returns
 * 503 so deployment platforms and external monitors can distinguish "process
 * is alive" from "service is ready".
 */
export async function GET() {
  const startedAt = performance.now();

  try {
    await pool.query('SELECT 1 AS ok');
    const latencyMs = Math.round(performance.now() - startedAt);

    return NextResponse.json(
      {
        status: 'ready',
        database: 'ok',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    console.error('[readiness] database probe failed', error);

    return NextResponse.json(
      {
        status: 'not_ready',
        database: 'unavailable',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

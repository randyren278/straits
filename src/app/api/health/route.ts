import { NextResponse } from 'next/server';

/**
 * Lightweight liveness probe.
 *
 * This endpoint deliberately does not touch Postgres or any upstream provider.
 * Infrastructure can use it to answer only one question: is the Next.js
 * process alive and capable of serving a request?
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'straits',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      revision: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

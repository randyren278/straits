/**
 * Alerts REST API
 *
 * GET /api/alerts - Get user's alerts with vessel info
 *
 * User identification via X-User-Id header (localStorage UUID).
 * Requirements: HIST-02
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAlertsWithVessels } from '@/lib/db/alerts';

/**
 * GET /api/alerts
 * Returns user's alerts with vessel names.
 * Query params: limit (default 50)
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing user ID' },
      { status: 400 }
    );
  }

  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const alerts = await getAlertsWithVessels(userId, limit);
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

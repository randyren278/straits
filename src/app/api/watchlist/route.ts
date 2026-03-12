/**
 * Watchlist REST API
 *
 * GET /api/watchlist - Get user's watchlist with vessel info
 * POST /api/watchlist - Add vessel to watchlist
 * DELETE /api/watchlist?imo=X - Remove vessel from watchlist
 *
 * User identification via X-User-Id header (localStorage UUID).
 * Requirements: HIST-02
 */
import { NextRequest, NextResponse } from 'next/server';
import { addToWatchlist, removeFromWatchlist, getWatchlistWithVessels } from '@/lib/db/watchlist';

/**
 * GET /api/watchlist
 * Returns user's watchlist entries with vessel names.
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
    const watchlist = await getWatchlistWithVessels(userId);
    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error('Failed to fetch watchlist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watchlist
 * Add vessel to user's watchlist.
 * Body: { imo: string, notes?: string }
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing user ID' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { imo, notes } = body as { imo?: string; notes?: string };

    if (!imo) {
      return NextResponse.json(
        { error: 'Missing IMO' },
        { status: 400 }
      );
    }

    await addToWatchlist(userId, imo, notes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to add to watchlist:', error);
    return NextResponse.json(
      { error: 'Failed to add to watchlist' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchlist?imo=X
 * Remove vessel from user's watchlist.
 */
export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const imo = request.nextUrl.searchParams.get('imo');

  if (!userId || !imo) {
    return NextResponse.json(
      { error: 'Missing user ID or IMO' },
      { status: 400 }
    );
  }

  try {
    await removeFromWatchlist(userId, imo);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove from watchlist:', error);
    return NextResponse.json(
      { error: 'Failed to remove from watchlist' },
      { status: 500 }
    );
  }
}

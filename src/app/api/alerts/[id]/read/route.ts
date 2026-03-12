/**
 * Mark Alert as Read API
 *
 * POST /api/alerts/[id]/read - Mark specific alert as read
 *
 * Requirements: HIST-02
 */
import { NextRequest, NextResponse } from 'next/server';
import { markAlertAsRead } from '@/lib/db/alerts';

/**
 * POST /api/alerts/[id]/read
 * Mark an alert as read (sets read_at timestamp).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const alertId = parseInt(id, 10);

  if (isNaN(alertId)) {
    return NextResponse.json(
      { error: 'Invalid alert ID' },
      { status: 400 }
    );
  }

  try {
    await markAlertAsRead(alertId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark alert as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark alert as read' },
      { status: 500 }
    );
  }
}

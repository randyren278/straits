import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { isCanaryEnabled } from '@/lib/canary';
import { isValidStoryId, type InvestigationStorySnapshot } from '@/lib/investigations/story-model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isCanaryEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { id } = await params;
  if (!isValidStoryId(id)) return NextResponse.json({ error: 'Story not found.' }, { status: 404 });

  try {
    const result = await pool.query<{ id: string; created_at: Date; snapshot: InvestigationStorySnapshot | string }>(
      `SELECT id::text, created_at, snapshot
       FROM canary.investigation_stories
       WHERE id = $1::uuid`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    return NextResponse.json({ id: row.id, createdAt: row.created_at.toISOString(), snapshot }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[investigation-stories] snapshot read failed', typeof error === 'object' && error !== null && 'code' in error ? error.code : 'unknown');
    return NextResponse.json({ error: 'Story snapshot is temporarily unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

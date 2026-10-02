import { pool } from '@/lib/db';
import type { InvestigationStoryRecord, InvestigationStorySnapshot } from './story-model';

export async function getInvestigationStory(id: string): Promise<InvestigationStoryRecord | null> {
  const result = await pool.query<{ id: string; created_at: Date; snapshot: InvestigationStorySnapshot | string }>(
    `SELECT id::text, created_at, snapshot
     FROM canary.investigation_stories
     WHERE id = $1::uuid`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
  return { id: row.id, createdAt: row.created_at.toISOString(), snapshot };
}

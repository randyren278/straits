import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { isCanaryEnabled } from '@/lib/canary';
import { buildStorySnapshot } from '@/lib/investigations/stories';
import { parseStoryRequest, StoryRequestError } from '@/lib/investigations/story-model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_BODY_BYTES = 8 * 1024;
const MAX_STORIES = 1000;

const storyLimitError = new Error('STORY_LIMIT_REACHED');

async function readBoundedText(request: NextRequest): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function POST(request: NextRequest) {
  if (!isCanaryEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body exceeds 8 KB.' }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await readBoundedText(request);
    body = JSON.parse(raw);
  } catch (error) {
    if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
      return NextResponse.json({ error: 'Request body exceeds 8 KB.' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  try {
    const input = parseStoryRequest(body);
    // The caller submits only question parameters and an annotation. Evidence
    // and assessment are always rebuilt from current server-side observations.
    const snapshot = await buildStorySnapshot(input);
    const client = await pool.connect();
    let row: { id: string; created_at: Date };
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('canary.investigation_stories.insert', 0))");
      const count = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM canary.investigation_stories');
      if (count.rows[0].count >= MAX_STORIES) throw storyLimitError;
      const result = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO canary.investigation_stories
           (region, claim_id, comparison_window, claim_text, annotation, snapshot)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id::text, created_at`,
        [input.region, snapshot.claim.id, input.window, input.claimText, input.annotation, JSON.stringify(snapshot)],
      );
      row = result.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    const href = `/investigations/stories/${row.id}`;
    return NextResponse.json({ id: row.id, createdAt: row.created_at.toISOString(), href }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof StoryRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error === storyLimitError) {
      return NextResponse.json({ error: 'Story storage is at its 1,000 snapshot limit.' }, { status: 429 });
    }
    console.error('[investigation-stories] snapshot creation failed', typeof error === 'object' && error !== null && 'code' in error ? error.code : 'unknown');
    return NextResponse.json({ error: 'Story snapshot could not be created.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

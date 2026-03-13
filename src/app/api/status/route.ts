/**
 * GET /api/status — Returns per-source health status based on DB freshness timestamps.
 * No external API pings — all status derived from DB to avoid rate limit cost.
 * Requirements: WIRE-05
 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/index';

export type SourceStatus = 'live' | 'degraded' | 'offline';

/**
 * Classify a data source based on how old the most recent row is.
 *
 * @param lastUpdate - Timestamp of most recent row, or null if table is empty
 * @param liveThresholdMs - Max age (ms) to be considered live
 * @param degradedThresholdMs - Max age (ms) to be considered degraded (beyond this = offline)
 */
export function classify(
  lastUpdate: Date | null,
  liveThresholdMs: number,
  degradedThresholdMs: number
): SourceStatus {
  if (!lastUpdate) return 'offline';
  const ageMs = Date.now() - lastUpdate.getTime();
  if (ageMs <= liveThresholdMs) return 'live';
  if (ageMs <= degradedThresholdMs) return 'degraded';
  return 'offline';
}

export async function GET() {
  const [aisResult, pricesResult, newsResult] = await Promise.all([
    pool.query('SELECT MAX(time) as last_update FROM vessel_positions'),
    pool.query('SELECT MAX(fetched_at) as last_update FROM oil_prices'),
    pool.query('SELECT MAX(created_at) as last_update FROM news_items'),
  ]);

  const ais = classify(aisResult.rows[0]?.last_update, 5 * 60 * 1000, 30 * 60 * 1000);
  const prices = classify(pricesResult.rows[0]?.last_update, 2 * 60 * 60 * 1000, 24 * 60 * 60 * 1000);
  const news = classify(newsResult.rows[0]?.last_update, 60 * 60 * 1000, 12 * 60 * 60 * 1000);

  return NextResponse.json({ ais, prices, news });
}

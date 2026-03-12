/**
 * Oil Prices API Route
 * Returns latest WTI and Brent crude prices with 30-day history for sparklines.
 *
 * GET /api/prices
 */
import { NextResponse } from 'next/server';
import { getLatestPrices } from '@/lib/db/prices';

export async function GET() {
  try {
    const prices = await getLatestPrices();
    return NextResponse.json({ prices });
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    return NextResponse.json({ prices: [], error: 'Failed to fetch prices' }, { status: 500 });
  }
}

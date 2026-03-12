/**
 * News Headlines API Route
 * Returns latest 15 news headlines filtered by oil/tanker keywords.
 *
 * GET /api/news
 */
import { NextResponse } from 'next/server';
import { getLatestNews } from '@/lib/db/news';

export async function GET() {
  try {
    const headlines = await getLatestNews(15);
    return NextResponse.json({ headlines });
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return NextResponse.json({ headlines: [], error: 'Failed to fetch news' }, { status: 500 });
  }
}

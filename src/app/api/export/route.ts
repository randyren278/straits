/**
 * GET /api/export — Export current vessel data as CSV or JSON.
 *
 * Query params:
 * - format: 'csv' | 'json' (default 'csv')
 * - type: 'vessels' (default 'vessels'; reserved for future export types)
 * - tankersOnly: 'true' to restrict to tankers (ship types 80-89)
 *
 * Returns a downloadable file with a Content-Disposition attachment header so
 * analysts can pull the live fleet snapshot into a spreadsheet / SIEM workflow.
 */
import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { getVesselsWithSanctions } from '@/lib/db/sanctions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv';
  const tankersOnly = searchParams.get('tankersOnly') === 'true';

  try {
    const vessels = await getVesselsWithSanctions(tankersOnly);

    // Flatten to analyst-friendly rows (one vessel per row, position inlined).
    const rows = vessels.map((v) => ({
      imo: v.imo ?? '',
      mmsi: v.mmsi,
      name: v.name ?? '',
      flag: v.flag ?? '',
      shipType: v.shipType ?? '',
      destination: v.destination ?? '',
      latitude: v.position.latitude,
      longitude: v.position.longitude,
      speed: v.position.speed ?? '',
      course: v.position.course ?? '',
      lastSeen: v.lastSeen ? new Date(v.lastSeen).toISOString() : '',
      isSanctioned: v.isSanctioned,
      sanctioningAuthority: v.sanctioningAuthority ?? '',
      sanctionRiskCategory: v.sanctionRiskCategory ?? '',
      anomalyType: v.anomalyType ?? '',
      anomalyConfidence: v.anomalyConfidence ?? '',
    }));

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, vessels: rows }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="tanker-export-${stamp}.json"`,
        },
      });
    }

    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tanker-export-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export vessels:', error);
    return NextResponse.json({ error: 'Failed to export vessels' }, { status: 500 });
  }
}

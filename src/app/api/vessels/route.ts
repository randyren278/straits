/**
 * GET /api/vessels - Returns vessels with their latest positions.
 * Requirements: MAP-01
 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tankersOnly = searchParams.get('tankersOnly') === 'true';

  // Filter to tanker ship types (80-89) if requested
  const typeFilter = tankersOnly ? 'AND v.ship_type BETWEEN 80 AND 89' : '';

  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (v.imo)
        v.imo, v.mmsi, v.name, v.flag, v.ship_type as "shipType",
        v.destination, v.last_seen as "lastSeen",
        p.latitude, p.longitude, p.speed, p.course, p.heading,
        p.nav_status as "navStatus", p.low_confidence as "lowConfidence",
        p.time as "positionTime"
      FROM vessels v
      JOIN vessel_positions p ON v.mmsi = p.mmsi
      WHERE p.time > NOW() - INTERVAL '1 hour'
      ${typeFilter}
      ORDER BY v.imo, p.time DESC
    `);

    // Transform to VesselWithPosition structure
    const vessels = result.rows.map((row) => ({
      imo: row.imo,
      mmsi: row.mmsi,
      name: row.name,
      flag: row.flag,
      shipType: row.shipType,
      destination: row.destination,
      lastSeen: row.lastSeen,
      position: {
        time: row.positionTime,
        mmsi: row.mmsi,
        imo: row.imo,
        latitude: row.latitude,
        longitude: row.longitude,
        speed: row.speed,
        course: row.course,
        heading: row.heading,
        navStatus: row.navStatus,
        lowConfidence: row.lowConfidence,
      },
    }));

    return NextResponse.json({
      vessels,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch vessels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vessels' },
      { status: 500 }
    );
  }
}

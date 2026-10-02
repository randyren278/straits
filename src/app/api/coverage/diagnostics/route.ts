import { NextResponse } from 'next/server';
import { isCanaryEnabled } from '@/lib/canary';
import { getRegionBuckets, getRegionPeers, getVesselGapSummary } from '@/lib/db/coverage-diagnostics';
import { getCoverageRegion, interpretCollectionInterval, interpretHourlyCoverage, interpretVesselGaps } from '@/lib/coverage/diagnostics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isCanaryEnabled()) return new NextResponse(null, { status: 404 });
  const params = new URL(request.url).searchParams;
  const regionId = params.get('region') ?? '';
  const region = getCoverageRegion(regionId);
  if (!region) return NextResponse.json({ error: 'Unknown coverage region.' }, { status: 400 });

  const mmsi = params.get('mmsi');
  if (mmsi != null && !/^\d{9}$/.test(mmsi)) {
    return NextResponse.json({ error: 'MMSI must contain exactly 9 digits.' }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();
  try {
    const [buckets, peers] = await Promise.all([
      getRegionBuckets(regionId),
      getRegionPeers(regionId, region.bounds),
    ]);
    let selectedVessel: null | Record<string, unknown> = null;
    if (mmsi) {
      const peer = peers.find((candidate) => candidate.mmsi === mmsi);
      if (!peer) {
        selectedVessel = { mmsi, status: 'not_in_peer_sample', count: 0, longestGapSeconds: null };
      } else {
        const summary = await getVesselGapSummary(mmsi);
        const interpreted = interpretVesselGaps(summary);
        selectedVessel = {
          ...peer,
          ...interpreted,
          ...(interpreted.status === 'observed_gaps' && interpreted.longestGapStart && interpreted.longestGapEnd
            ? { longestGapCollection: interpretCollectionInterval(buckets, interpreted.longestGapStart, interpreted.longestGapEnd) }
            : {}),
          ...(summary?.lastFix
            ? {
              sinceLastFixSeconds: Math.max(0, Math.floor((new Date(generatedAt).getTime() - new Date(summary.lastFix).getTime()) / 1000)),
              sinceLastFixCollection: interpretCollectionInterval(buckets, summary.lastFix, generatedAt),
            }
            : {}),
        };
      }
    }
    return NextResponse.json({
      region: { id: region.id, bounds: region.bounds },
      generatedAt,
      window: { hours: 48, startsAt: new Date(Date.now() - 48 * 3_600_000).toISOString(), endsAt: generatedAt },
      regionalCollection: {
        basis: 'collection_buckets; window counts are distinct regional 10-minute intervals across sources',
        hourly: interpretHourlyCoverage(buckets, new Date(generatedAt)),
      },
      peers: { basis: 'latest_position_in_region', limit: 100, vessels: peers },
      selectedVessel,
      interpretation: 'Regional collection describes recorded feed attempts and fixes. Vessel gaps describe this MMSI history only; neither establishes why observations stopped or proves evasion.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Coverage diagnostics are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

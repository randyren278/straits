/**
 * GET /api/brief/[chokepoint] — Chokepoint Situation Brief (SITREP).
 *
 * Composes a deterministic, timestamped intelligence brief for one chokepoint
 * from existing data functions:
 *  - vessel + tanker counts currently in the zone (getVesselsInChokepoint)
 *  - active anomaly breakdown by type (counts)
 *  - top-risk vessels present (join vessel_risk_scores)
 *  - current WTI/Brent prices + 24h move (getLatestPrices)
 *  - GPS-jamming ratio (share of low_confidence positions in the zone, recent)
 *  - top news ranked by relevance_score (getLatestNews)
 *  - the chokepoint SPC band/z-score (getChokepointSpcBand; null on cold start)
 *
 * Returns structured JSON by default. With `?format=md` (or `text`), returns a
 * plaintext/markdown SITREP with a timestamp header, using the download-header
 * style of /api/export. No LLM narrative pass, no image cards (out of scope).
 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints';
import { getVesselsInChokepoint } from '@/lib/geo/chokepoints';
import { getLatestPrices } from '@/lib/db/prices';
import { getLatestNews } from '@/lib/db/news';
import { getChokepointSpcBand } from '@/lib/detection/spc-index';

/** Recent window (minutes) used for the GPS-jamming ratio in the zone. */
const JAMMING_WINDOW_MINUTES = 60;

/** How many top-risk vessels to surface in the brief. */
const TOP_RISK_LIMIT = 5;

/** How many relevance-ranked headlines to surface. */
const NEWS_LIMIT = 5;

interface TopRiskRow {
  imo: string;
  name: string | null;
  flag: string | null;
  score: number;
}

interface JammingRow {
  total: string;
  low_confidence: string;
}

/**
 * Compose the structured brief for a chokepoint. Fans out to existing data
 * functions plus two small zone-scoped queries (top-risk + jamming ratio).
 */
async function composeBrief(chokepointId: string) {
  const cp = CHOKEPOINTS[chokepointId];
  const { minLat, maxLat, minLon, maxLon } = cp.bounds;

  const [vessels, prices, news, spc, topRiskResult, jammingResult] = await Promise.all([
    getVesselsInChokepoint(chokepointId),
    getLatestPrices(),
    getLatestNews(NEWS_LIMIT),
    getChokepointSpcBand(chokepointId),
    // Top-risk vessels currently in the zone (join vessel_risk_scores).
    pool.query<TopRiskRow>(`
      WITH latest_positions AS (
        SELECT DISTINCT ON (vp.mmsi) vp.mmsi, vp.latitude, vp.longitude, v.imo, v.name, v.flag
        FROM vessel_positions vp
        JOIN vessels v ON vp.mmsi = v.mmsi
        WHERE vp.time > NOW() - INTERVAL '${JAMMING_WINDOW_MINUTES} minutes'
          AND vp.latitude BETWEEN $1 AND $2
          AND vp.longitude BETWEEN $3 AND $4
      )
      SELECT lp.imo, lp.name, lp.flag, rs.score
      FROM latest_positions lp
      JOIN vessel_risk_scores rs ON rs.imo = lp.imo
      WHERE lp.imo IS NOT NULL
      ORDER BY rs.score DESC
      LIMIT ${TOP_RISK_LIMIT}
    `, [minLat, maxLat, minLon, maxLon]),
    // GPS-jamming ratio: share of low_confidence positions in the zone recently.
    pool.query<JammingRow>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE low_confidence)::text AS low_confidence
      FROM vessel_positions
      WHERE time > NOW() - INTERVAL '${JAMMING_WINDOW_MINUTES} minutes'
        AND latitude BETWEEN $1 AND $2
        AND longitude BETWEEN $3 AND $4
    `, [minLat, maxLat, minLon, maxLon]),
  ]);

  const present = vessels ?? [];
  const tankerCount = present.filter((v) => v.shipType !== null && v.shipType >= 80 && v.shipType <= 89).length;

  // Active anomaly breakdown by type among vessels present.
  const anomalyBreakdown: Record<string, number> = {};
  for (const v of present) {
    if (v.hasActiveAnomaly && v.anomalyType) {
      anomalyBreakdown[v.anomalyType] = (anomalyBreakdown[v.anomalyType] ?? 0) + 1;
    }
  }

  const jamRow = jammingResult.rows[0] ?? { total: '0', low_confidence: '0' };
  const jamTotal = Number(jamRow.total);
  const jamLow = Number(jamRow.low_confidence);

  return {
    generatedAt: new Date().toISOString(),
    chokepoint: { id: cp.id, name: cp.name },
    traffic: {
      totalVessels: present.length,
      tankerCount,
    },
    anomalies: {
      totalActive: Object.values(anomalyBreakdown).reduce((s, n) => s + n, 0),
      byType: anomalyBreakdown,
    },
    topRisk: topRiskResult.rows.map((r) => ({
      imo: r.imo,
      name: r.name,
      flag: r.flag,
      score: Number(r.score),
    })),
    prices: prices.map((p) => ({
      symbol: p.symbol,
      price: p.price,
      change: p.change,
      changePercent: p.changePercent,
    })),
    gpsJamming: {
      windowMinutes: JAMMING_WINDOW_MINUTES,
      totalPositions: jamTotal,
      lowConfidencePositions: jamLow,
      ratio: jamTotal > 0 ? jamLow / jamTotal : 0,
    },
    news: news.map((n) => ({
      title: n.title,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
      relevanceScore: n.relevanceScore,
    })),
    spc: spc
      ? {
          latest: spc.latest,
          mean: spc.mean,
          stddev: spc.stddev,
          z: spc.z,
          lower: spc.lower,
          belowBand: spc.z <= -2,
        }
      : null,
  };
}

type Brief = Awaited<ReturnType<typeof composeBrief>>;

/**
 * Render the brief as a plaintext/markdown SITREP with a timestamp header.
 */
function renderMarkdown(brief: Brief): string {
  const lines: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  lines.push(`# SITREP — ${brief.chokepoint.name.toUpperCase()}`);
  lines.push(`GENERATED: ${brief.generatedAt}`);
  lines.push(`CHOKEPOINT: ${brief.chokepoint.id}`);
  lines.push('');

  lines.push('## TRAFFIC');
  lines.push(`Total vessels in zone: ${brief.traffic.totalVessels}`);
  lines.push(`Tankers: ${brief.traffic.tankerCount}`);
  lines.push('');

  lines.push('## ACTIVE ANOMALIES');
  lines.push(`Total active: ${brief.anomalies.totalActive}`);
  const byType = Object.entries(brief.anomalies.byType);
  if (byType.length === 0) {
    lines.push('(none)');
  } else {
    for (const [type, count] of byType) {
      lines.push(`  ${type}: ${count}`);
    }
  }
  lines.push('');

  lines.push('## TOP-RISK VESSELS');
  if (brief.topRisk.length === 0) {
    lines.push('(none)');
  } else {
    for (const v of brief.topRisk) {
      lines.push(`  [${v.score}] ${v.name ?? 'UNKNOWN'} (IMO ${v.imo}, ${v.flag ?? '??'})`);
    }
  }
  lines.push('');

  lines.push('## OIL PRICES');
  if (brief.prices.length === 0) {
    lines.push('(no price data)');
  } else {
    for (const p of brief.prices) {
      const sign = p.changePercent >= 0 ? '+' : '';
      lines.push(`  ${p.symbol}: ${p.price} (${sign}${p.changePercent.toFixed(2)}% 24h)`);
    }
  }
  lines.push('');

  lines.push('## GPS JAMMING');
  lines.push(
    `Low-confidence positions (last ${brief.gpsJamming.windowMinutes}m): ` +
    `${brief.gpsJamming.lowConfidencePositions}/${brief.gpsJamming.totalPositions} (${pct(brief.gpsJamming.ratio)})`
  );
  lines.push('');

  lines.push('## THROUGHPUT SPC');
  if (!brief.spc) {
    lines.push('(insufficient history — cold start)');
  } else {
    lines.push(`Latest: ${brief.spc.latest} | mean ${brief.spc.mean.toFixed(1)} | z ${brief.spc.z.toFixed(2)}`);
    lines.push(brief.spc.belowBand ? 'STATUS: BELOW CONTROL BAND — throughput collapse' : 'STATUS: nominal');
  }
  lines.push('');

  lines.push('## INTELLIGENCE (by relevance)');
  if (brief.news.length === 0) {
    lines.push('(no headlines)');
  } else {
    for (const n of brief.news) {
      lines.push(`  [r${n.relevanceScore}] ${n.title} — ${n.source}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chokepoint: string }> }
) {
  const { chokepoint } = await params;

  if (!CHOKEPOINTS[chokepoint]) {
    return NextResponse.json({ error: 'Unknown chokepoint' }, { status: 404 });
  }

  try {
    const brief = await composeBrief(chokepoint);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (format === 'md' || format === 'text') {
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(renderMarkdown(brief), {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="sitrep-${chokepoint}-${stamp}.md"`,
        },
      });
    }

    return NextResponse.json(brief);
  } catch (error) {
    console.error(`[API] Failed to compose brief for ${chokepoint}:`, error);
    return NextResponse.json({ error: 'Failed to compose situation brief' }, { status: 500 });
  }
}

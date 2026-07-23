/**
 * Demo seed script — populates the database with realistic Middle East vessel
 * traffic so the dashboard renders as a live system (for screenshots / local dev).
 *
 * Usage: tsx --env-file=.env.local scripts/seed-demo.ts
 *
 * Idempotent-ish: truncates the demo tables first, then inserts a fresh dataset.
 * Safe for local/demo databases only — do NOT run against production.
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Deterministic PRNG so re-seeding gives a stable dataset (no Math.random surprises).
let _s = 1337;
function rnd(): number {
  _s = (_s * 1103515245 + 12345) & 0x7fffffff;
  return _s / 0x7fffffff;
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

// Realistic maritime regions across the Middle East + approaches.
const REGIONS = [
  { name: 'Strait of Hormuz', lat: [25.5, 26.6], lon: [56.0, 57.2], busy: true },
  { name: 'Persian Gulf', lat: [24.5, 29.5], lon: [49.0, 55.5], busy: true },
  { name: 'Gulf of Oman', lat: [23.5, 25.5], lon: [57.5, 60.5], busy: true },
  { name: 'Arabian Sea', lat: [15.0, 23.0], lon: [58.0, 68.0], busy: false },
  { name: 'Bab el-Mandeb', lat: [11.5, 13.2], lon: [43.0, 44.5], busy: true },
  { name: 'Red Sea', lat: [15.0, 27.5], lon: [34.0, 42.0], busy: false },
  { name: 'Suez Approaches', lat: [29.6, 31.5], lon: [32.0, 32.9], busy: true },
];

const SHIP_TYPES = [
  { code: 80, label: 'Tanker' },
  { code: 81, label: 'Tanker' },
  { code: 82, label: 'Tanker' },
  { code: 84, label: 'Tanker (LNG)' },
  { code: 89, label: 'Tanker' },
  { code: 70, label: 'Cargo' },
  { code: 71, label: 'Cargo' },
  { code: 79, label: 'Cargo' },
  { code: 60, label: 'Passenger' },
  { code: 52, label: 'Tug' },
];

const FLAGS = ['PA', 'LR', 'MH', 'SG', 'MT', 'HK', 'GR', 'CY', 'IR', 'RU', 'CN', 'IN', 'AE', 'GA', 'CK', 'PW'];
const DESTINATIONS = [
  'NINGBO', 'QINGDAO', 'ROTTERDAM', 'SIKKA', 'FUJAIRAH', 'RAS TANURA', 'JEBEL ALI',
  'SINGAPORE', 'KAOHSIUNG', 'YEOSU', 'JAMNAGAR', 'PORT SAID', 'SUEZ', 'MINA AL AHMADI',
  'KHARG ISLAND', 'BASRAH OIL TERMINAL', 'DALIAN', 'MAILIAO', 'ONSAN', 'MESAIEED',
];
const NAME_A = ['PACIFIC', 'GULF', 'DESERT', 'OCEAN', 'STAR', 'EASTERN', 'NORDIC', 'CROWN', 'SEA', 'ORIENTAL', 'GLOBAL', 'FRONT', 'NEW', 'GRAND', 'ROYAL', 'SILVER', 'BLUE', 'GOLDEN'];
const NAME_B = ['VENTURE', 'PIONEER', 'HORIZON', 'FALCON', 'MERIDIAN', 'VOYAGER', 'SPIRIT', 'GLORY', 'EMPRESS', 'TRADER', 'MARINER', 'LEGACY', 'ENDEAVOUR', 'PHOENIX', 'HARMONY', 'PROSPERITY', 'SOVEREIGN', 'TRIUMPH'];

const NAV_STATUS = [0, 0, 0, 1, 5, 8]; // 0=under way, 1=at anchor, 5=moored, 8=sailing

interface Vessel {
  imo: string; mmsi: string; name: string; flag: string; shipType: number;
  destination: string; lat: number; lon: number; speed: number; course: number;
  heading: number; navStatus: number; region: string; sanctioned: boolean;
}

function makeVessels(n: number): Vessel[] {
  const vessels: Vessel[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < n; i++) {
    const region = rnd() < 0.55 ? pick(REGIONS.filter(r => r.busy)) : pick(REGIONS);
    const st = pick(SHIP_TYPES);
    let name = `${pick(NAME_A)} ${pick(NAME_B)}`;
    while (usedNames.has(name)) name = `${pick(NAME_A)} ${pick(NAME_B)} ${Math.floor(rnd() * 90) + 10}`;
    usedNames.add(name);
    const imo = String(9000000 + i * 137 + Math.floor(rnd() * 90));
    const mmsi = String(200000000 + Math.floor(rnd() * 599999999));
    const navStatus = pick(NAV_STATUS);
    const speed = navStatus === 1 || navStatus === 5 ? round(between(0, 0.4), 1) : round(between(6, 15.5), 1);
    const course = round(between(0, 359), 1);
    vessels.push({
      imo, mmsi, name, flag: pick(FLAGS), shipType: st.code,
      destination: pick(DESTINATIONS),
      lat: round(between(region.lat[0], region.lat[1])),
      lon: round(between(region.lon[0], region.lon[1])),
      speed, course, heading: course, navStatus,
      region: region.name,
      // Sanctioned bias toward IR/RU flags + tankers
      sanctioned: false,
    });
  }
  // Mark ~12% sanctioned, biased to IR/RU flagged tankers
  const sortable = [...vessels].sort((a, b) => {
    const sa = (a.flag === 'IR' || a.flag === 'RU' ? 2 : 0) + (a.shipType >= 80 && a.shipType <= 89 ? 1 : 0);
    const sb = (b.flag === 'IR' || b.flag === 'RU' ? 2 : 0) + (b.shipType >= 80 && b.shipType <= 89 ? 1 : 0);
    return sb - sa;
  });
  sortable.slice(0, Math.floor(n * 0.12)).forEach(v => (v.sanctioned = true));
  return vessels;
}

async function main() {
  console.log('Seeding demo data into', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  const N = 140;
  const vessels = makeVessels(N);

  // Clean demo tables (order respects FKs).
  await pool.query(`TRUNCATE alerts, watchlist, vessel_risk_scores, vessel_anomalies,
    vessel_destination_changes, vessel_proximity_events, vessel_sanctions,
    vessel_positions, oil_prices, news_items, vessels RESTART IDENTITY CASCADE`);

  // --- Vessels + positions (with short history tracks for realism) ---
  for (const v of vessels) {
    await pool.query(
      `INSERT INTO vessels (imo, mmsi, name, flag, ship_type, destination, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6, NOW() - ($7 || ' minutes')::interval)`,
      [v.imo, v.mmsi, v.name, v.flag, v.shipType, v.destination, Math.floor(rnd() * 90)]
    );
    // 8-point history track over the last ~4 hours, drifting along course.
    const steps = 8;
    for (let s = steps; s >= 0; s--) {
      const ageMin = s * 30 + Math.floor(rnd() * 8);
      const drift = (steps - s) * (v.speed / 60) * 0.5;
      const rad = (v.course * Math.PI) / 180;
      const lat = round(v.lat - Math.cos(rad) * drift * 0.012);
      const lon = round(v.lon - Math.sin(rad) * drift * 0.012);
      await pool.query(
        `INSERT INTO vessel_positions
         (time, mmsi, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence)
         VALUES (NOW() - ($1 || ' minutes')::interval, $2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ageMin, v.mmsi, v.imo, lat, lon, v.speed, v.course, v.heading, v.navStatus,
         v.region === 'Strait of Hormuz' && rnd() < 0.25]
      );
    }
  }
  console.log(`  ✓ ${vessels.length} vessels + position tracks`);

  // --- Sanctions ---
  const RISK_CATS = ['sanction', 'mare.shadow;poi', 'mare.detained', 'poi', 'reg.warn'];
  const AUTHORITIES = ['OFAC', 'EU', 'UK', 'UN', 'PSC'];
  const sanctioned = vessels.filter(v => v.sanctioned);
  for (const v of sanctioned) {
    await pool.query(
      `INSERT INTO vessel_sanctions
       (imo, sanctioning_authority, reason, confidence, risk_category, datasets, flag, mmsi, aliases, vessel_type, name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'VESSEL',$10)
       ON CONFLICT (imo) DO NOTHING`,
      [v.imo, pick(AUTHORITIES), 'Shadow fleet / sanctions evasion', pick(['HIGH', 'HIGH', 'MEDIUM']),
       pick(RISK_CATS), ['us_ofac_sdn', 'eu_fsf'], v.flag, v.mmsi, [v.name + ' (ex)'], v.name]
    );
  }
  console.log(`  ✓ ${sanctioned.length} sanctioned vessels`);

  // --- Oil prices (30-day history for sparklines) ---
  const symbols = [{ s: 'WTI', base: 71 }, { s: 'BRENT', base: 75 }];
  for (const { s, base } of symbols) {
    let price = base;
    for (let d = 30; d >= 0; d--) {
      const prev = price;
      price = round(price + between(-1.8, 1.9), 2);
      const change = round(price - prev, 2);
      await pool.query(
        `INSERT INTO oil_prices (symbol, price, change, change_percent, fetched_at)
         VALUES ($1,$2,$3,$4, NOW() - ($5 || ' days')::interval)`,
        [s, price, change, round((change / prev) * 100, 2), d]
      );
    }
  }
  console.log('  ✓ oil price history (WTI + BRENT, 30d)');

  // --- News ---
  const NEWS = [
    ['Tanker traffic surges through Strait of Hormuz amid regional tensions', 'Reuters', 9],
    ['Oil prices climb as shipping insurers widen Gulf risk premiums', 'Bloomberg', 8],
    ['Shadow fleet tankers spotted conducting ship-to-ship transfers off Fujairah', 'gCaptain', 9],
    ['EU adds 40 vessels to sanctions list over sanctions-evasion concerns', 'Al Jazeera', 8],
    ['Bab el-Mandeb transits drop as vessels reroute around Cape of Good Hope', 'TradeWinds', 7],
    ['GPS jamming reported by multiple vessels near Bandar Abbas', 'Lloyd’s List', 8],
    ['Suez Canal Authority reports steady crude tanker throughput this quarter', 'Reuters', 6],
    ['Dark-fleet activity intensifies in the Gulf of Oman, analysts warn', 'Bloomberg', 8],
  ];
  for (let i = 0; i < NEWS.length; i++) {
    const [title, source, rel] = NEWS[i];
    await pool.query(
      `INSERT INTO news_items (title, source, url, published_at, relevance_score)
       VALUES ($1,$2,$3, NOW() - ($4 || ' hours')::interval, $5) ON CONFLICT (url) DO NOTHING`,
      [title, source, `https://example.com/news/${i}-${Date.now?.() ?? i}`, i * 3 + 1, rel]
    );
  }
  console.log(`  ✓ ${NEWS.length} news items`);

  // --- Anomalies + risk scores (bias to sanctioned + Hormuz vessels) ---
  const ANOM = ['going_dark', 'loitering', 'deviation', 'speed'];
  const anomVessels = vessels.filter(v => v.sanctioned || v.region === 'Strait of Hormuz').slice(0, 24);
  for (const v of anomVessels) {
    const type = pick(ANOM);
    await pool.query(
      `INSERT INTO vessel_anomalies (imo, anomaly_type, confidence, detected_at, details)
       VALUES ($1,$2,$3, NOW() - ($4 || ' hours')::interval, $5)
       ON CONFLICT (imo, anomaly_type) WHERE resolved_at IS NULL DO NOTHING`,
      [v.imo, type, pick(['confirmed', 'confirmed', 'suspected']), Math.floor(rnd() * 48),
       JSON.stringify({ lastLat: v.lat, lastLon: v.lon, region: v.region, radiusNm: round(between(0.5, 4), 1) })]
    );
    const score = Math.floor(between(35, 98));
    await pool.query(
      `INSERT INTO vessel_risk_scores (imo, score, factors, computed_at)
       VALUES ($1,$2,$3, NOW()) ON CONFLICT (imo) DO UPDATE SET score = EXCLUDED.score, factors = EXCLUDED.factors`,
      [v.imo, score, JSON.stringify({
        sanctioned: v.sanctioned, anomalyType: type,
        flag: v.flag, goingDark: type === 'going_dark',
      })]
    );
  }
  console.log(`  ✓ ${anomVessels.length} anomalies + risk scores`);

  // --- Destination changes (behavioral) ---
  for (const v of anomVessels.slice(0, 10)) {
    await pool.query(
      `INSERT INTO vessel_destination_changes (imo, previous_destination, new_destination, changed_at)
       VALUES ($1,$2,$3, NOW() - ($4 || ' hours')::interval)`,
      [v.imo, pick(DESTINATIONS), v.destination, Math.floor(rnd() * 24)]
    );
  }
  console.log('  ✓ destination changes');

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM vessel_positions');
  console.log(`\nDone. vessel_positions rows: ${rows[0].c}`);
  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});

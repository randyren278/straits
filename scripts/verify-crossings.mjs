/**
 * Measured verification for the Chokepoint Pulse card.
 *
 * The DOM must render one day control per day the API returned, and clicking
 * the newest one must produce exactly the voyages the API reports for that day
 * (or the pruned message when the API says the raw positions are gone).
 *
 * Usage: npm run verify:crossings        (uses :3000 if listening, else starts `next start` from the last build)
 *        BASE_URL=https://straits.randyren.org npm run verify:crossings
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

async function ensureServer() {
  if (process.env.BASE_URL) return null;
  try { await fetch(`${BASE}/api/health`); return null; } catch { /* nothing listening */ }
  const child = spawn('npx', ['next', 'start', '-p', '3000'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { await fetch(`${BASE}/api/health`); return child; } catch { /* not yet */ }
  }
  child.kill();
  throw new Error('next start did not come up on :3000 within 60s');
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

async function run() {
  const server = await ensureServer();
  const api = await (await fetch(`${BASE}/api/chokepoints/suez/crossings?range=7d`)).json();
  const days = api.days ?? [];
  check('api: days array returned', Array.isArray(api.days), `${days.length} days`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="chokepoint-pulse"]', { timeout: 30_000 });

  const domDays = await page.$$eval('[data-testid^="crossing-bar-"]', (els) => els.map((e) => e.getAttribute('data-testid').replace('crossing-bar-', '')));
  check('analytics: one day control per API day', JSON.stringify(domDays) === JSON.stringify(days.map((d) => d.day)), `dom=${domDays.join(',')} api=${days.map((d) => d.day).join(',')}`);

  if (days.length === 0) {
    const empty = await page.$('[data-testid="crossings-empty"]');
    check('analytics: empty state shown with no aggregates', !!empty, empty ? 'rendered' : 'missing');
  } else {
    const newest = days[days.length - 1].day;
    const dayApi = await (await fetch(`${BASE}/api/chokepoints/suez/crossings?range=7d&day=${newest}`)).json();
    await page.click(`[data-testid="crossing-bar-${newest}"]`);
    if (dayApi.voyages === null) {
      await page.waitForSelector('[data-testid="voyages-pruned"]', { timeout: 30_000 });
      const text = await page.textContent('[data-testid="voyages-pruned"]');
      check(`analytics: ${newest} pruned message`, /pruned|no voyage detail/.test(text ?? ''), `dom="${text}" reason=${dayApi.reason}`);
    } else {
      await page.waitForSelector('[data-testid="voyages-count"]', { timeout: 30_000 });
      const rows = await page.$$('[data-testid="voyage-row"]');
      check(`analytics: ${newest} voyage rows equal API`, rows.length === dayApi.voyages.length, `dom=${rows.length} api=${dayApi.voyages.length}`);
    }
    const sparse = await page.$('[data-testid="crossings-sparse"]');
    const complete = days.reduce((s, d) => s + d.northbound + d.southbound, 0);
    const incomplete = days.reduce((s, d) => s + d.incomplete, 0);
    const ratio = complete + incomplete ? incomplete / (complete + incomplete) : null;
    check('analytics: sparse-sampling line matches the data', (ratio !== null && ratio > 0.5) === !!sparse, `ratio=${ratio === null ? 'n/a' : ratio.toFixed(2)} line=${!!sparse}`);
  }

  await page.close();
  await browser.close();
  server?.kill();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${BASE}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });

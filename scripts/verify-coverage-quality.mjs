/**
 * Measured verification for the observation-quality labels.
 *
 * For every chokepoint, the dashboard header widget and the analytics chart row
 * must show exactly the label /api/coverage computed — read from the DOM, not a
 * screenshot. An "insufficient" region with zero contacts must not print a
 * literal 0 anywhere a reader would take it for an observation.
 *
 * Usage: npm run verify:coverage        (uses :3000 if listening, else starts `next start` from the last build)
 *        BASE_URL=https://straits.randyren.org npm run verify:coverage
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

/** With no server on :3000 and no BASE_URL, serve the last `next build` ourselves. */
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
const LABEL = { recent: 'Recent observations', intermittent: 'Intermittent observations', insufficient: 'Insufficient observations' };

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

async function run() {
  const server = await ensureServer();
  const api = await (await fetch(`${BASE}/api/coverage`)).json();
  const chokepoints = api.chokepoints ?? [];
  check('api: four chokepoints with a quality field',
    chokepoints.length === 4 && chokepoints.every((c) => LABEL[c.quality]),
    chokepoints.map((c) => `${c.id}=${c.quality}`).join(' '));
  const stats = (await (await fetch(`${BASE}/api/chokepoints`)).json()).chokepoints ?? [];
  const totals = Object.fromEntries(stats.map((s) => [s.id, s.totalVessels]));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Dashboard header widgets (desktop only).
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid^="quality-chip-"]', { timeout: 30_000 });
  for (const cp of chokepoints) {
    const chip = page.locator(`[data-testid="quality-chip-${cp.id}"]`).first();
    const domQuality = (await chip.count()) ? await chip.getAttribute('data-quality') : null;
    const title = (await chip.count()) ? await chip.getAttribute('title') ?? '' : '';
    check(`dashboard: ${cp.id} chip matches API`, domQuality === cp.quality && title.includes(LABEL[cp.quality]), `dom=${domQuality} title="${title.slice(0, 40)}" api=${cp.quality}`);
    const box = (await chip.count()) ? await chip.boundingBox() : null;
    check(`dashboard: ${cp.id} chip is one line`, !!box && box.height < 20, `height=${box ? Math.round(box.height) : 'n/a'}px`);

    const count = page.locator(`[data-testid="chokepoint-count-${cp.id}"]`).first();
    const countText = (await count.count()) ? (await count.textContent())?.trim() ?? '' : '';
    if (cp.quality === 'insufficient' && totals[cp.id] === 0) {
      check(`dashboard: ${cp.id} unobserved shows no literal 0`, !/\b0\b/.test(countText) && /unobserved/.test(countText), `dom="${countText}"`);
    } else {
      check(`dashboard: ${cp.id} count rendered`, /\d/.test(countText), `dom="${countText}"`);
    }
  }

  await page.waitForSelector('[data-testid="header-observation"] rect', { timeout: 30_000 });
  const headerCells = await page.$$eval('[data-testid="header-observation"] rect', (els) => els.length);
  check('dashboard: header shows 4 regions × 24 h observation cells', headerCells === 96, `${headerCells} cells`);
  const rowOverlap = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[data-testid="header-chokepoints"] > div')].map((e) => e.getBoundingClientRect());
    for (let i = 1; i < boxes.length; i++) if (boxes[i].left < boxes[i - 1].right) return `overlap at ${Math.round(boxes[i].left)}`;
    return null;
  });
  check('dashboard: header second row has no overlapping blocks', rowOverlap === null, rowOverlap ?? 'clean');

  // Analytics chart rows.
  await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid^="chart-quality-"]', { timeout: 30_000 });
  await page.waitForSelector('[data-testid^="quality-chip-chart-"]', { timeout: 30_000 });
  const rows = await page.$$eval('[data-testid^="chart-quality-"]', (els) =>
    els.map((el) => ({ id: el.getAttribute('data-testid').replace('chart-quality-', ''), text: el.textContent ?? '' })));
  for (const row of rows) {
    const cp = chokepoints.find((c) => c.id === row.id);
    if (!cp) { check(`analytics: ${row.id} known to API`, false, 'not in /api/coverage'); continue; }
    check(`analytics: ${row.id} row matches API`, row.text.includes(LABEL[cp.quality]), `dom="${row.text.trim().slice(0, 80)}" api=${cp.quality}`);
  }
  const heat = await page.$$('[data-testid^="chart-heat-"]');
  check('analytics: 7-day observation strip under every chart', heat.length === rows.length, `${heat.length} strips for ${rows.length} charts`);
  const order = rows.map((r) => r.id);
  const rank = { recent: 0, intermittent: 1, insufficient: 2 };
  const sorted = [...order].sort((a, b) => rank[chokepoints.find((c) => c.id === a)?.quality] - rank[chokepoints.find((c) => c.id === b)?.quality]);
  check('analytics: best-observed chokepoint first', JSON.stringify(order) === JSON.stringify(sorted), order.join(' > '));

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

/**
 * Interaction + responsive recon — clicks a vessel on the map to open the detail
 * panel, and captures mobile + tablet viewports to surface responsive bugs.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/tmp/tt-shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();

// --- Mobile dashboard ---
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await mp.waitForTimeout(5000);
await mp.screenshot({ path: `${OUT}/dashboard-mobile.png`, fullPage: true }).catch(() => {});
await mobile.close();

// --- Tablet dashboard ---
const tablet = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
const tp = await tablet.newPage();
await tp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await tp.waitForTimeout(5000);
await tp.screenshot({ path: `${OUT}/dashboard-tablet.png`, fullPage: true }).catch(() => {});
await tablet.close();

// --- Desktop: click a vessel marker to open detail panel ---
const desk = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const dp = await desk.newPage();
await dp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await dp.waitForTimeout(6000);

// The map canvas is where vessels are drawn. Click near the dense Hormuz cluster.
// Map fills the left region; cluster around center-right of the map area.
const clicks = [
  { x: 620, y: 470 }, { x: 600, y: 450 }, { x: 640, y: 490 },
];
let opened = false;
for (const c of clicks) {
  await dp.mouse.click(c.x, c.y);
  await dp.waitForTimeout(1500);
  // Detail panel typically shows vessel name / IMO text
  const hasPanel = await dp.locator('text=/IMO|MMSI|RISK|DESTINATION/i').count().catch(() => 0);
  if (hasPanel > 0) { opened = true; break; }
}
await dp.screenshot({ path: `${OUT}/dashboard-detail.png`, fullPage: false }).catch(() => {});

// Try the search box interaction
try {
  const search = dp.locator('input[type="text"], input[placeholder*="essel" i]').first();
  await search.click({ timeout: 3000 });
  await search.fill('OCEAN');
  await dp.waitForTimeout(2000);
  await dp.screenshot({ path: `${OUT}/dashboard-search.png`, fullPage: false }).catch(() => {});
} catch {}

await desk.close();
await browser.close();
console.log(JSON.stringify({ detailPanelOpened: opened }));

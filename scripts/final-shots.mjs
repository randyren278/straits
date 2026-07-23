import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const OUT = '/Users/randyren/Developer/tanker-tracker/docs/screenshots';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

async function shot(path, file, wait = 5500, full = false) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  await p.close();
  console.log('shot:', file);
}

await shot('/dashboard', 'dashboard.png', 6500);
await shot('/fleet', 'fleet.png', 3500, true);
await shot('/analytics', 'analytics.png', 4000, true);
await shot('/about', 'about.png', 2500, true);

// Dashboard with a vessel selected (detail panel) — click near the Hormuz cluster
const dp = await ctx.newPage();
await dp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await dp.waitForTimeout(6500);
for (const c of [[770, 520], [760, 500], [780, 540], [800, 520]]) {
  await dp.mouse.click(c[0], c[1]);
  await dp.waitForTimeout(1200);
  const has = await dp.locator('text=/RISK|DESTINATION|MMSI|VESSEL/i').count().catch(() => 0);
  if (has > 0) break;
}
await dp.screenshot({ path: `${OUT}/dashboard-detail.png`, fullPage: false });
await dp.close();
console.log('shot: dashboard-detail.png');

await b.close();

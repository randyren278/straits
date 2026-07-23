/**
 * Playwright UI reconnaissance — drives the running dashboard, captures screenshots
 * of every route, and records console errors + failed network requests.
 *
 * Output:
 *   /tmp/tt-shots/*.png        full-page screenshots
 *   /tmp/tt-shots/report.json  console errors + failed requests per route
 *
 * Usage: node scripts/ui-recon.mjs   (dev server must be running on :3000)
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = '/tmp/tt-shots';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ROUTES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/fleet', name: 'fleet' },
  { path: '/analytics', name: 'analytics' },
  { path: '/about', name: 'about' },
];

const report = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push({ url: res.url(), status: res.status() });
  });

  let navError = null;
  try {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    navError = String(e);
  }

  // Give the map / async panels time to render.
  await page.waitForTimeout(6000);

  // Try to capture a vessel detail panel on the dashboard by clicking a marker area.
  await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: true }).catch(() => {});

  report.push({
    route: route.path,
    name: route.name,
    navError,
    pageErrors,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 30),
    failedRequests: failedRequests.slice(0, 30),
  });

  await page.close();
}

// Also probe the API endpoints directly for health.
const api = await ctx.newPage();
const API_ENDPOINTS = [
  '/api/status', '/api/vessels', '/api/prices', '/api/news',
  '/api/anomalies', '/api/chokepoints',
];
const apiReport = [];
for (const ep of API_ENDPOINTS) {
  try {
    const res = await api.request.get(`${BASE}${ep}`, { timeout: 20000 });
    const text = await res.text();
    apiReport.push({ ep, status: res.status(), bytes: text.length, sample: text.slice(0, 160) });
  } catch (e) {
    apiReport.push({ ep, error: String(e) });
  }
}
await api.close();

writeFileSync(`${OUT}/report.json`, JSON.stringify({ routes: report, api: apiReport }, null, 2));
console.log('UI recon complete. Screenshots + report in', OUT);
console.log(JSON.stringify({ routes: report, api: apiReport }, null, 2));

await browser.close();

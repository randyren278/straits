/** Reproducible lab probe. Fresh browser context per run; no production writes.
 * BASE_URL=https://straits.randyren.org RUNS=3 node scripts/measure-first-load.mjs
 * PROFILE=mobile simulates 1.6 Mbps down / 750 Kbps up, 150 ms RTT, 4x CPU.
 * This measures lab LCP/CLS and app readiness, not field INP or server cold starts.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const runs = Number(process.env.RUNS ?? 3);
const profile = process.env.PROFILE ?? 'desktop';
const out = resolve(process.env.OUT_DIR ?? `artifacts/performance/${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? 'chrome' });
const results = [];
try {
  for (let run = 1; run <= runs; run++) {
    const context = await browser.newContext({
      viewport: profile === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: profile === 'mobile', hasTouch: profile === 'mobile',
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (profile === 'mobile') {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const requests = new Map();
    const errors = [];
    cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, {
      url: e.request.url, type: e.type, started: e.timestamp,
    }));
    cdp.on('Network.responseReceived', e => {
      const r = requests.get(e.requestId);
      if (r) Object.assign(r, { status: e.response.status, ttfbMs: (e.timestamp - r.started) * 1000,
        cache: e.response.headers['x-vercel-cache'] ?? null,
        cacheControl: e.response.headers['cache-control'] ?? null });
    });
    cdp.on('Network.loadingFinished', e => {
      const r = requests.get(e.requestId);
      if (r) Object.assign(r, { durationMs: (e.timestamp - r.started) * 1000, encodedBytes: e.encodedDataLength });
    });
    cdp.on('Network.loadingFailed', e => {
      const r = requests.get(e.requestId);
      if (r) r.error = e.errorText;
    });
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.__loadMetrics = { lcpMs: null, cls: 0, shifts: [], longTasks: [], marks: {} };
      const m = window.__loadMetrics;
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) { m.lcpMs = e.startTime; m.lcpElement = e.element?.tagName; }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      let shiftWindow = { start: 0, last: 0, value: 0 };
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          if (e.startTime - shiftWindow.last >= 1000 || e.startTime - shiftWindow.start >= 5000) {
            shiftWindow = { start: e.startTime, last: e.startTime, value: e.value };
          } else { shiftWindow.last = e.startTime; shiftWindow.value += e.value; }
          m.cls = Math.max(m.cls, shiftWindow.value);
          m.shifts.push({ start: e.startTime, value: e.value, sources: e.sources?.map(s => ({
            tag: s.node?.tagName, testId: s.node?.getAttribute?.('data-testid'),
            className: String(s.node?.className ?? '').slice(0, 180),
          })) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) m.longTasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ type: 'longtask', buffered: true });
      new MutationObserver(() => {
        for (const [name, selector] of Object.entries({
          header: 'header', mapSurface: '[data-testid="vessel-map-surface"]',
          mapReady: '[data-testid="vessel-map-surface"][data-reveal-state="ready"]',
        })) if (!m.marks[name] && document.querySelector(selector)) m.marks[name] = performance.now();
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-reveal-state'] });
    });
    let navigationError = null;
    try {
      await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('[data-testid="vessel-map-surface"][data-reveal-state="ready"]', { timeout: 60000 });
    } catch (e) { navigationError = e.message; }
    await page.waitForTimeout(5000);
    const metrics = await page.evaluate(() => ({
      ...window.__loadMetrics,
      appMarks: performance.getEntriesByType('mark').filter(e => e.name.startsWith('straits:')).map(e => ({ name: e.name, ms: e.startTime })),
      navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
      paints: performance.getEntriesByType('paint').map(e => e.toJSON()),
      resources: performance.getEntriesByType('resource').map(e => e.toJSON()),
      text: document.body.innerText.slice(0, 6000),
    }));
    await page.screenshot({ path: `${out}/${profile}-${run}.png` });
    const result = { run, profile, base, at: new Date().toISOString(), browser: browser.version(),
      navigationError, metrics, errors, requests: [...requests.values()] };
    results.push(result);
    await writeFile(`${out}/${profile}-${run}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ run, profile, lcpMs: metrics.lcpMs, cls: metrics.cls,
      marks: metrics.marks, ttfbMs: metrics.navigation?.responseStart,
      htmlCompleteMs: metrics.navigation?.responseEnd,
      requests: result.requests.length,
      encodedBytes: result.requests.reduce((s, r) => s + (r.encodedBytes ?? 0), 0),
      api: result.requests.filter(r => r.url.includes('/api/')).map(r => ({
        path: new URL(r.url).pathname, ms: Math.round(r.durationMs ?? 0), status: r.status, cache: r.cache,
      })), navigationError }));
    await context.close();
  }
} finally {
  await writeFile(`${out}/${profile}-summary.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`Evidence: ${out}`);

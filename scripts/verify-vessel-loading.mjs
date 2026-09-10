/**
 * Browser-level proof for the dashboard's map-first/vessel-data-later state.
 *
 * This intentionally does not start a server or seed a database. Point
 * BASE_URL at an already-running, seeded dashboard and hold only the vessel
 * response; CARTO basemap requests continue normally.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run verify:vessel-loading
 *
 * Screenshots are written to a temporary directory and are never committed.
 */
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  console.error('verify:vessel-loading requires BASE_URL for a running dashboard');
  process.exit(2);
}

const OUT = mkdtempSync(path.join(tmpdir(), 'straits-vessel-loading-'));
const VESSELS = [
  {
    imo: '9000001',
    mmsi: '123456781',
    name: 'LOADING TEST ONE',
    flag: 'PA',
    shipType: 80,
    destination: 'FUJAIRAH',
    lastSeen: '2026-09-10T12:00:00.000Z',
    isSanctioned: false,
    sanctioningAuthority: null,
    sanctionReason: null,
    sanctionRiskCategory: null,
    anomalyType: null,
    anomalyConfidence: null,
    anomalyDetectedAt: null,
    position: {
      time: '2026-09-10T12:00:00.000Z',
      mmsi: '123456781',
      imo: '9000001',
      latitude: 25.5,
      longitude: 55.5,
      speed: 10,
      course: 90,
      heading: 90,
      navStatus: 0,
      lowConfidence: false,
    },
  },
  {
    imo: '9000002',
    mmsi: '123456782',
    name: 'LOADING TEST TWO',
    flag: 'LR',
    shipType: 70,
    destination: 'SOHAR',
    lastSeen: '2026-09-10T12:00:00.000Z',
    isSanctioned: false,
    sanctioningAuthority: null,
    sanctionReason: null,
    sanctionRiskCategory: null,
    anomalyType: null,
    anomalyConfidence: null,
    anomalyDetectedAt: null,
    position: {
      time: '2026-09-10T12:00:00.000Z',
      mmsi: '123456782',
      imo: '9000002',
      latitude: 25.7,
      longitude: 55.7,
      speed: 8,
      course: 180,
      heading: 180,
      navStatus: 0,
      lowConfidence: false,
    },
  },
];

const waitFor = async (page, predicate, description, timeout = 60_000) => {
  await page.waitForFunction(predicate, undefined, { timeout }).catch((error) => {
    throw new Error(`Timed out waiting for ${description}: ${error.message}`);
  });
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await chromium.launch();
const viewports = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1440, height: 900 }],
];

try {
  for (const [label, viewport] of viewports) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    let releaseResponse = () => {};
    const responseGate = new Promise((resolve) => { releaseResponse = resolve; });

    await page.route('**/api/vessels*', async (route) => {
      await responseGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vessels: VESSELS, timestamp: '2026-09-10T12:00:00.000Z' }),
      });
    });

    try {
      const vesselRequest = page.waitForRequest('**/api/vessels*', { timeout: 90_000 });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await vesselRequest;

      await page.waitForSelector('.maplibregl-canvas', { state: 'visible', timeout: 60_000 });
      await page.waitForSelector('[data-testid="vessel-loading-hud"]', { state: 'visible', timeout: 30_000 });
      await waitFor(
        page,
        () => document.querySelector('[data-testid="vessel-map"]')?.getAttribute('data-map-state') === 'ready',
        `${label} basemap ready state`,
      );
      const pending = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          const box = element?.getBoundingClientRect();
          if (!box || box.width <= 0 || box.height <= 0) return null;
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        };
        const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const map = document.querySelector('[data-testid="vessel-map"]');
        const hud = document.querySelector('[data-testid="vessel-loading-hud"]');
        const hudRect = rect('[data-testid="vessel-loading-hud"]');
        const chipsRect = rect('[data-testid="map-filter-chips"]');
        return {
          state: map?.getAttribute('data-vessel-state'),
          mapState: map?.getAttribute('data-map-state'),
          busy: map?.getAttribute('aria-busy'),
          hud: !!hud,
          status: document.querySelector('[data-testid="vessel-loading-hud"] [role="status"]')?.textContent ?? '',
          canvas: !!document.querySelector('.maplibregl-canvas'),
          chips: chipsRect,
          hudOverlapsChips: overlaps(hudRect, chipsRect),
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      assert(pending.canvas, `${label}: basemap canvas missing while vessel data was pending`);
      assert(pending.mapState === 'ready', `${label}: expected basemap ready state, got ${pending.mapState}`);
      assert(pending.hud, `${label}: loading HUD missing while vessel data was pending`);
      assert(/MAP ONLINE/i.test(pending.status), `${label}: pending HUD status did not contain MAP ONLINE (${pending.status})`);
      assert(pending.state === 'loading', `${label}: expected loading state, got ${pending.state}`);
      assert(pending.busy === 'true', `${label}: expected aria-busy=true, got ${pending.busy}`);
      if (label === 'phone') {
        assert(pending.chips, 'phone: visible map-filter chips missing while HUD is pending');
        assert(!pending.hudOverlapsChips, 'phone: loading HUD overlaps visible map-filter chips');
        assert(pending.overflowX <= 1, `phone: horizontal overflow while HUD is pending (${pending.overflowX}px)`);
      }
      await page.screenshot({ path: path.join(OUT, `${label}-before.png`), fullPage: false });
      console.log(`PASS ${label}: basemap + loading HUD remain visible while /api/vessels is delayed`);

      releaseResponse();
      await waitFor(
        page,
        () => document.querySelector('[data-testid="vessel-map"]')?.getAttribute('data-vessel-state') === 'ready',
        `${label} vessel map ready state`,
      );
      const ready = await page.evaluate(() => ({
        state: document.querySelector('[data-testid="vessel-map"]')?.getAttribute('data-vessel-state'),
        count: document.querySelector('[data-testid="vessel-map"]')?.getAttribute('data-vessel-count'),
        hud: !!document.querySelector('[data-testid="vessel-loading-hud"]'),
      }));
      assert(ready.state === 'ready', `${label}: expected ready state, got ${ready.state}`);
      assert(ready.count === String(VESSELS.length), `${label}: expected ${VESSELS.length} vessels, got ${ready.count}`);
      assert(!ready.hud, `${label}: loading HUD remained after map idle`);
      assert(pageErrors.length === 0, `${label}: page errors: ${pageErrors.join(' | ')}`);
      assert(consoleErrors.length === 0, `${label}: console errors: ${consoleErrors.join(' | ')}`);
      await page.screenshot({ path: path.join(OUT, `${label}-after.png`), fullPage: false });
      console.log(`PASS ${label}: delayed data reached ready state and HUD was removed`);
    } catch (error) {
      if (pageErrors.length) console.error(`${label}: page errors: ${pageErrors.join(' | ')}`);
      if (consoleErrors.length) console.error(`${label}: console errors: ${consoleErrors.join(' | ')}`);
      throw error;
    } finally {
      // Ensure a failed assertion cannot leave an intercepted request hanging.
      releaseResponse();
      await page.close();
    }
  }
} catch (error) {
  console.error(`FAIL verify:vessel-loading — ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  console.log(`Screenshots: ${OUT}`);
}

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

for (const asset of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  const response = await fetch(new URL(`/maplibre/${asset}`, BASE_URL));
  const body = await response.arrayBuffer();
  assert(response.ok, `${asset}: expected HTTP 200, got ${response.status}`);
  assert(
    response.headers.get('content-type')?.includes('javascript'),
    `${asset}: expected a JavaScript content type, got ${response.headers.get('content-type')}`,
  );
  assert(body.byteLength > 0, `${asset}: response body was empty`);
}
console.log('PASS MapLibre worker and shared module are available');

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
        const surface = document.querySelector('[data-testid="vessel-map-surface"]');
        const overlay = document.querySelector('[data-testid="vessel-loading-overlay"]');
        const hud = document.querySelector('[data-testid="vessel-loading-hud"]');
        const mapRect = rect('[data-testid="vessel-map"]');
        const overlayRect = rect('[data-testid="vessel-loading-overlay"]');
        const hudRect = rect('[data-testid="vessel-loading-hud"]');
        const chipsRect = rect('[data-testid="map-filter-chips"]');
        return {
          state: map?.getAttribute('data-vessel-state'),
          mapState: map?.getAttribute('data-map-state'),
          busy: map?.getAttribute('aria-busy'),
          hud: !!hud,
          status: document.querySelector('[data-testid="vessel-loading-hud"] [role="status"]')?.textContent ?? '',
          canvas: !!document.querySelector('.maplibregl-canvas'),
          surfaceState: surface?.getAttribute('data-reveal-state'),
          surfaceFilter: surface ? getComputedStyle(surface).filter : '',
          surfaceTransitionDuration: surface ? getComputedStyle(surface).transitionDuration : '',
          overlayState: overlay?.getAttribute('data-reveal-state'),
          overlayOpacity: overlay ? Number(getComputedStyle(overlay).opacity) : 0,
          overlayTransitionDuration: overlay ? getComputedStyle(overlay).transitionDuration : '',
          overlayVisibility: overlay ? getComputedStyle(overlay).visibility : '',
          overlayCoversMap: !!mapRect && !!overlayRect
            && Math.abs(mapRect.left - overlayRect.left) <= 1
            && Math.abs(mapRect.right - overlayRect.right) <= 1
            && Math.abs(mapRect.top - overlayRect.top) <= 1
            && Math.abs(mapRect.bottom - overlayRect.bottom) <= 1,
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
      assert(pending.surfaceState === 'covered', `${label}: expected covered map surface, got ${pending.surfaceState}`);
      assert(pending.surfaceFilter.includes('blur(6px)'), `${label}: map surface was not blurred (${pending.surfaceFilter})`);
      assert(pending.surfaceTransitionDuration !== '0s', `${label}: map reveal has no transition duration`);
      assert(pending.overlayState === 'covered', `${label}: expected covered overlay, got ${pending.overlayState}`);
      assert(pending.overlayOpacity >= 0.99, `${label}: loading overlay was not opaque (${pending.overlayOpacity})`);
      assert(pending.overlayTransitionDuration !== '0s', `${label}: loading overlay has no fade duration`);
      assert(pending.overlayVisibility === 'visible', `${label}: loading overlay was not visible`);
      assert(pending.overlayCoversMap, `${label}: loading overlay did not cover the full map`);
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
        () => {
          const map = document.querySelector('[data-testid="vessel-map"]');
          const surface = document.querySelector('[data-testid="vessel-map-surface"]');
          const overlay = document.querySelector('[data-testid="vessel-loading-overlay"]');
          if (!surface || !overlay) return false;
          const filter = getComputedStyle(surface).filter;
          return map?.getAttribute('data-vessel-state') === 'ready'
            && Number(getComputedStyle(overlay).opacity) <= 0.01
            && getComputedStyle(overlay).visibility === 'hidden'
            && (filter === 'none' || filter.includes('blur(0px)'));
        },
        `${label} vessel reveal transition`,
      );
      const ready = await page.evaluate(() => {
        const map = document.querySelector('[data-testid="vessel-map"]');
        const surface = document.querySelector('[data-testid="vessel-map-surface"]');
        const overlay = document.querySelector('[data-testid="vessel-loading-overlay"]');
        return {
          state: map?.getAttribute('data-vessel-state'),
          count: map?.getAttribute('data-vessel-count'),
          surfaceState: surface?.getAttribute('data-reveal-state'),
          surfaceFilter: surface ? getComputedStyle(surface).filter : '',
          overlayState: overlay?.getAttribute('data-reveal-state'),
          overlayHidden: overlay?.getAttribute('aria-hidden'),
          overlayOpacity: overlay ? Number(getComputedStyle(overlay).opacity) : 1,
          overlayVisibility: overlay ? getComputedStyle(overlay).visibility : '',
          hud: !!document.querySelector('[data-testid="vessel-loading-hud"]'),
        };
      });
      assert(ready.state === 'ready', `${label}: expected ready state, got ${ready.state}`);
      assert(ready.count === String(VESSELS.length), `${label}: expected ${VESSELS.length} vessels, got ${ready.count}`);
      assert(ready.surfaceState === 'ready', `${label}: map surface did not reach ready reveal state`);
      assert(ready.surfaceFilter === 'none' || ready.surfaceFilter.includes('blur(0px)'), `${label}: map remained blurred (${ready.surfaceFilter})`);
      assert(ready.overlayState === 'ready', `${label}: overlay did not reach ready reveal state`);
      assert(ready.overlayHidden === 'true', `${label}: completed overlay was not hidden from assistive technology`);
      assert(ready.overlayOpacity <= 0.01, `${label}: loading overlay did not fade out (${ready.overlayOpacity})`);
      assert(ready.overlayVisibility === 'hidden', `${label}: loading overlay remained visible`);
      assert(ready.hud, `${label}: HUD was unmounted before its exit transition could complete`);
      assert(pageErrors.length === 0, `${label}: page errors: ${pageErrors.join(' | ')}`);
      assert(consoleErrors.length === 0, `${label}: console errors: ${consoleErrors.join(' | ')}`);
      await page.screenshot({ path: path.join(OUT, `${label}-after.png`), fullPage: false });
      console.log(`PASS ${label}: delayed data rendered, then the HUD and blur faded out`);
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

/**
 * Measured verification for the mobile dashboard app shell.
 *
 * Screenshots are not evidence on this project. A prior audit here produced 105
 * findings, shipped, and still missed four user-visible defects — a screenshot
 * cannot show below-the-fold content, nor state that only exists after an
 * interaction. Every check below is a number pulled from the live DOM.
 *
 * Deliberately does NOT follow scripts/ui-audit.mjs's `desktop` detector, which
 * compares elements positionally by index. `display:none` elements still occupy
 * index slots, so adding a mobile-only control shifts every later index and
 * reports diffs that are not real. Everything here selects visible elements by
 * selector and asserts their geometry directly.
 *
 * Usage: npm run verify:dashboard        (requires npm run dev on :3000)
 *        BASE_URL=https://straits.randyren.org npm run verify:dashboard
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const VIEWPORTS = [[390, 844], [360, 800]];
const ROUTES = ['/dashboard', '/fleet', '/analytics', '/about'];
const MAX_CHROME = 110;
/** Source of truth is VISIBLE_HEADLINES in src/components/panels/NewsPanel.tsx.
 *  A script outside src/ cannot import it, so it is repeated here; the unit test
 *  in NewsPanel.test.tsx asserts the constant equals 8 to keep them locked. */
const VISIBLE_HEADLINES = 8;

const results = [];
const skipped = [];

function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}
function skip(name, why) {
  skipped.push(name);
  console.log(`SKIP  ${name} — ${why}`);
}

/** Visible bounding boxes for a selector, rounded. */
const BOXES = (sel) =>
  [...document.querySelectorAll(sel)]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }));

async function boxes(page, sel) {
  return page.evaluate(BOXES, sel);
}

/**
 * A control can be the right size and still unreachable: an invisible overlay
 * on top of it swallows every tap. Size checks cannot see that. This exact
 * defect shipped in an early prototype of the sheet, where a transparent 44px
 * hit area sat over the tab row.
 */
async function blockedControls(page, scope = null) {
  return page.evaluate((scopeSel) => {
    const fixedAncestor = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).position === 'fixed') return n;
      }
      return null;
    };
    /** Can this element be scrolled out from under a fixed bar? */
    const hasScrollableAncestor = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (/auto|scroll/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
      }
      return document.documentElement.scrollHeight > window.innerHeight + 1;
    };

    const root = scopeSel ? document.querySelector(scopeSel) : document;
    if (!root) return ['scope not found: ' + scopeSel];
    const out = [];
    for (const el of root.querySelectorAll('a,button,[role=tab],input,select')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
      const top = document.elementFromPoint(cx, cy);
      if (!top || el.contains(top) || top.contains(el)) continue;

      const blockerLayer = fixedAncestor(top);
      const ownLayer = fixedAncestor(el);

      // A fixed bar overlapping page content is normal and expected — the user
      // scrolls it clear. Only flag it when the content CANNOT scroll clear,
      // which is permanent occlusion (e.g. map attribution pinned under the nav).
      if (blockerLayer && blockerLayer !== ownLayer && hasScrollableAncestor(el)) continue;

      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24);
      const why = blockerLayer && blockerLayer !== ownLayer ? 'PERMANENTLY under' : 'covered by';
      out.push(`${label} ${why} ${top.tagName}.${String(top.className).slice(0, 30)}`);
    }
    return out;
  }, scope);
}

async function run() {
  const browser = await chromium.launch();

  for (const [w, h] of VIEWPORTS) {
    for (const route of ROUTES) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 30000 });
      await page.waitForTimeout(1200);
      const tag = `${route}@${w}x${h}`;

      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const hdr = document.querySelector('header');
        const nav = document.querySelector('nav[aria-label="Primary"]');
        const navR = nav.getBoundingClientRect();
        const tap = [...document.querySelectorAll('a,button,[role=tab],input')]
          .map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 22), r: e.getBoundingClientRect() }))
          .filter((o) => o.r.width > 0 && o.r.height > 0)
          // MapLibre injects its own attribution links; they are third-party DOM.
          .filter((o) => !/CARTO|OpenStreetMap|Mapbox/i.test(o.t))
          .filter((o) => o.r.width < 44 || o.r.height < 44)
          .map((o) => `${o.t}(${Math.round(o.r.width)}x${Math.round(o.r.height)})`);
        const visible = (sel) =>
          [...document.querySelectorAll(sel)].filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }).length;
        return {
          chrome: Math.round((hdr ? hdr.getBoundingClientRect().height : 0) + navR.height),
          headerH: hdr ? Math.round(hdr.getBoundingClientRect().height) : 0,
          navTop: Math.round(navR.top),
          navBottom: Math.round(navR.bottom),
          ovfX: de.scrollWidth - window.innerWidth,
          screens: +(de.scrollHeight / window.innerHeight).toFixed(2),
          tap,
          bells: visible('[aria-label*="Notification" i]'),
          chips: visible('[data-testid^="status-chip"]'),
        };
      });

      // 1 — fixed chrome budget. The live site measured 275px of header alone.
      check(`${tag}: fixed chrome`, m.chrome <= MAX_CHROME, `${m.chrome}px = header ${m.headerH} + nav ${m.navBottom - m.navTop} (limit ${MAX_CHROME})`);

      // 10 — navigation present and fully on screen.
      check(`${tag}: bottom nav on screen`, m.navBottom <= h + 1 && m.navTop < h, `nav y=${m.navTop}..${m.navBottom}, viewport ${h}`);

      // 3 — horizontal overflow.
      check(`${tag}: no horizontal overflow`, m.ovfX === 0, `${m.ovfX}px`);

      // 4 — touch targets.
      check(`${tag}: tap targets >= 44px`, m.tap.length === 0, m.tap.length ? m.tap.join(', ') : 'all pass');

      // 5 — nothing covered by an overlay.
      const blocked = await blockedControls(page);
      check(`${tag}: controls hit-testable`, blocked.length === 0, blocked.length ? blocked.join('; ') : 'none covered');

      // 6 — duplicated controls expose exactly one instance.
      check(`${tag}: one visible notification bell`, m.bells === 1, `${m.bells} visible`);
      check(`${tag}: one visible status element`, m.chips === 1, `${m.chips} visible`);

      if (route === '/dashboard') {
        // 2 — the headline claim. Was 3.11 screens.
        check(`${tag}: total height`, m.screens <= 1.0, `${m.screens} screens (was 3.11 before this work)`);

        // 11 — the chips are absolutely positioned; if their container loses
        // `relative` they anchor elsewhere and are MISpositioned, not hidden,
        // so no visibility check would catch it.
        const [chip] = await boxes(page, '[aria-label="Search vessels"]').then(() => boxes(page, '.lg\\:hidden.absolute'));
        const [mapBox] = await boxes(page, '.maplibregl-map');
        if (chip && mapBox) {
          const inside =
            chip.x >= mapBox.x && chip.y >= mapBox.y &&
            chip.x + chip.w <= mapBox.x + mapBox.w &&
            chip.y + chip.h <= mapBox.y + mapBox.h;
          check(`${tag}: filter chips inside the map`, inside,
            `chips ${chip.w}x${chip.h}@${chip.x},${chip.y} vs map ${mapBox.w}x${mapBox.h}@${mapBox.x},${mapBox.y}`);
        } else {
          check(`${tag}: filter chips inside the map`, false, `chips ${chip ? 'found' : 'MISSING'}, map ${mapBox ? 'found' : 'MISSING'}`);
        }

        // 7 + 12 — the sheet cycles, its tabs are reachable in every open
        // detent, and its bottom edge meets the nav exactly at each one. That
        // last part is what guards --straits-nav-h: a hardcoded pixel offset
        // would drift here on a device with a safe-area inset.
        const sheet = page.locator('[data-testid="mobile-sheet"]');
        const handle = page.locator('[data-testid="mobile-sheet"] button[aria-expanded]').first();
        const seen = [];
        for (let i = 0; i < 3; i++) {
          const [sBox] = await boxes(page, '[data-testid="mobile-sheet"]');
          const [nBox] = await boxes(page, 'nav[aria-label="Primary"]');
          const detent = await sheet.getAttribute('data-detent');
          check(`${tag}: sheet meets nav at detent ${detent}`, sBox.y + sBox.h === nBox.y,
            `sheet bottom ${sBox.y + sBox.h}, nav top ${nBox.y}`);

          await handle.click();
          await page.waitForTimeout(360);
          seen.push(await sheet.getAttribute('data-detent'));

          if (seen[i] !== 'peek') {
            const tabs = page.locator('[data-testid="mobile-sheet"] [role="tab"]');
            const n = await tabs.count();
            let reachable = n === 3;
            for (let t = 0; t < n && reachable; t++) {
              reachable = await tabs.nth(t).isEnabled();
            }
            check(`${tag}: tabs reachable at detent ${seen[i]}`, reachable, `${n} tabs, all enabled: ${reachable}`);
          }
        }
        check(`${tag}: sheet cycles detents`, JSON.stringify(seen) === '["half","full","peek"]', seen.join(' -> '));

        // 9 — the intel feed had no cap at all; it grew with every poll.
        await handle.click();
        await page.waitForTimeout(360);
        await page.click('[data-testid="mobile-sheet"] [role="tab"]:has-text("Intel")');
        await page.waitForTimeout(600);
        const items = await page.$$eval('[data-testid="mobile-sheet"] [role="tabpanel"] a[href^="http"]', (a) => a.length);
        if (items === 0) {
          skip(`${tag}: intel capped`, 'no headlines returned by /api/news — cannot exercise the cap');
        } else {
          check(`${tag}: intel capped`, items <= VISIBLE_HEADLINES, `${items} items (cap ${VISIBLE_HEADLINES})`);
        }

        // Re-run the overlay hit test with the sheet open — the tab row is
        // exactly where an invisible handle overlay used to swallow taps.
        // Scoped to the sheet's own controls. A fully-opened sheet covering the
        // map underneath is what the user asked for by opening it; the defect
        // class this guards is an overlay INSIDE the sheet eating its own taps,
        // which is exactly what an early prototype's invisible handle did.
        const blockedOpen = await blockedControls(page, '[data-testid="mobile-sheet"]');
        check(`${tag}: sheet's own controls hit-testable when open`, blockedOpen.length === 0,
          blockedOpen.length ? blockedOpen.join('; ') : `none of the sheet's controls are covered`);
      }

      await page.close();
    }
  }

  // Desktop must be untouched by all of the above.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  const desktop = await page.evaluate(() => {
    const vis = (sel) =>
      [...document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    const bell = vis('[aria-label*="Notification" i]')[0];
    return {
      navHidden: vis('nav[aria-label="Primary"]').length === 0,
      sheetHidden: vis('[data-testid="mobile-sheet"]').length === 0,
      railVisible: vis('[data-testid="panel-rail"]').length === 1,
      navLinks: vis('header nav a').length,
      bellX: bell ? Math.round(bell.getBoundingClientRect().x) : -1,
    };
  });
  check('desktop@1440x900: bottom nav hidden', desktop.navHidden, `visible: ${!desktop.navHidden}`);
  check('desktop@1440x900: mobile sheet hidden', desktop.sheetHidden, `visible: ${!desktop.sheetHidden}`);
  check('desktop@1440x900: panel rail visible', desktop.railVisible, `rail visible: ${desktop.railVisible}`);
  check('desktop@1440x900: header nav intact', desktop.navLinks === 4, `${desktop.navLinks} visible nav links`);
  // The bell sat at x=1200 before this work; a regression moved it to x=479.
  check('desktop@1440x900: bell position unchanged', desktop.bellX === 1200, `bell x=${desktop.bellX} (expected 1200)`);

  await page.close();
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${BASE}`);
  if (skipped.length) console.log(`Skipped: ${skipped.join('; ')}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

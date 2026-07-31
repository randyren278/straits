/**
 * Stage 1 fleet layout verification.
 *
 * Asserts the measured claims from the design spec against a running server.
 * Screenshots cannot show below-the-fold content or post-interaction state, so
 * every check here is a number.
 *
 * Usage: npm run verify:fleet   (requires `npm run dev` on :3000)
 *        FLEET_URL=https://straits.randyren.org/fleet npm run verify:fleet
 */
import { chromium } from 'playwright';

const BASE = process.env.FLEET_URL ?? 'http://localhost:3000/fleet';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const PAGE_SIZE = 25;

const results = [];
const skipped = [];

function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

/**
 * A <tr role="button"> is neither focusable nor keyboard-operable by default,
 * so the dossier would be mouse-only without an explicit tabIndex and key
 * handling — a WCAG 2.1.1 failure.
 */
async function checkKeyboardReachable(page) {
  const rows = await page.$$eval('[role="tabpanel"] tr[role="button"]', (els) =>
    els.map((e) => e.getAttribute('tabindex')),
  );
  const unreachable = rows.filter((t) => t === null || Number(t) < 0).length;
  check(
    'dossier: rows are keyboard reachable',
    rows.length > 0 && unreachable === 0,
    `${rows.length} rows, ${unreachable} without a focusable tabindex`,
  );

  // Prove Enter actually activates, not just that the row can be focused.
  // Assert the toggle, since a row may already be open when this runs.
  const before = await page.$eval('[role="tabpanel"] tr[role="button"]', (el) => {
    el.focus();
    return el.getAttribute('aria-expanded');
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await page.$eval('[role="tabpanel"] tr[role="button"]', (el) => el.getAttribute('aria-expanded'));
  check('dossier: Enter toggles the dossier', before !== after, `aria-expanded ${before} → ${after}`);
}

async function tabIds(page) {
  return page.$$eval('[role="tab"]', (els) => els.map((e) => e.id.replace('fleet-tab-', '')));
}

async function openTab(page, id) {
  await page.click(`#fleet-tab-${id}`);
  await page.waitForTimeout(250);
}

async function metrics(page) {
  return page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    viewH: window.innerHeight,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    rows: document.querySelectorAll('[role="tabpanel"] tbody tr[data-imo]').length,
    cards: document.querySelectorAll('[role="tabpanel"] button[data-imo]').length,
    selected: document.querySelectorAll('[aria-selected="true"]').length,
    panels: document.querySelectorAll('[role="tabpanel"]').length,
  }));
}

async function run() {
  const browser = await chromium.launch();

  for (const [label, viewport] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[role="tablist"]', { timeout: 30000 });

    const ids = await tabIds(page);
    check(`${label}: tabs exist`, ids.length > 0, `${ids.length} tabs: ${ids.join(', ')}`);

    // Navigation must be reachable without scrolling — the original defect was
    // a tab strip equivalent sitting at y=2455.
    const navTop = await page.$eval('[role="tablist"]', (el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
    check(`${label}: navigation above the fold`, navTop < viewport.height, `tablist top at y=${navTop} (fold ${viewport.height})`);

    for (const id of ids) {
      await openTab(page, id);
      const m = await metrics(page);
      const screens = +(m.scrollH / m.viewH).toFixed(2);

      // The Sanctioned tab renders a taller card list on mobile — see the
      // page-size trade-off in the design spec.
      const limit = label === 'desktop' ? 1.5 : id === 'sanctioned' ? 3.5 : 2.2;

      check(`${label}/${id}: height`, screens <= limit, `${screens} screens (limit ${limit})`);
      check(`${label}/${id}: no horizontal overflow`, m.overflow === 0, `${m.overflow}px`);
      check(
        `${label}/${id}: rows capped`,
        m.rows <= PAGE_SIZE && m.cards <= PAGE_SIZE,
        `${m.rows} table rows, ${m.cards} cards (cap ${PAGE_SIZE})`,
      );
      check(`${label}/${id}: single selected tab`, m.selected === 1, `${m.selected} aria-selected`);
      check(`${label}/${id}: single mounted panel`, m.panels === 1, `${m.panels} tabpanel(s)`);

      // Only the active panel is mounted, so any aria-controls must resolve.
      const dangling = await page.$$eval('[role="tab"][aria-controls]', (els) =>
        els.map((e) => e.getAttribute('aria-controls')).filter((target) => !document.getElementById(target)),
      );
      check(`${label}/${id}: no dangling aria-controls`, dangling.length === 0, dangling.length ? dangling.join(', ') : 'all resolve');
    }

    // Focus must follow arrow-key selection, or roving tabindex strands the
    // keyboard user on a button that is no longer selected.
    await page.focus(`#fleet-tab-${ids[0]}`);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const focusFollowed = await page.evaluate(() => {
      const el = document.activeElement;
      return { id: el?.id ?? '(none)', selected: el?.getAttribute('aria-selected') };
    });
    check(
      `${label}: focus follows arrow-key selection`,
      focusFollowed.selected === 'true',
      `focus on ${focusFollowed.id} (aria-selected=${focusFollowed.selected})`,
    );

    if (label === 'mobile') {
      const heights = await page.$$eval('[role="tab"]', (els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().height)),
      );
      const min = Math.min(...heights);
      check('mobile: tab touch targets', min >= 44, `smallest tab ${min}px`);
    }

    await page.close();
  }

  // Interaction checks on desktop.
  const page = await browser.newPage({ viewport: DESKTOP });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('[role="tablist"]', { timeout: 30000 });

  const ids = await tabIds(page);
  const busiest = ids.find((i) => i !== 'sanctioned') ?? ids[0];
  await openTab(page, busiest);

  const risks = () =>
    page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (rows) =>
      rows.map((r) => {
        const cell = r.querySelectorAll('td')[3];
        const text = cell?.textContent?.trim() ?? '';
        return text === '—' ? null : Number(text);
      }),
    );

  const desc = await risks();
  const descOk = desc.filter((v) => v !== null).every((v, i, a) => i === 0 || a[i - 1] >= v);
  check('sort: default is risk descending', descOk, `first values ${desc.slice(0, 5).join(', ')}`);

  const nullsLastDesc = desc.every((v, i) => v !== null || desc.slice(i).every((x) => x === null));
  check('sort: nulls last when descending', nullsLastDesc, `${desc.filter((v) => v === null).length} nulls`);

  await page.click('[role="tabpanel"] th button:has-text("Risk Score")');
  await page.waitForTimeout(250);

  const asc = await risks();
  const ascOk = asc.filter((v) => v !== null).every((v, i, a) => i === 0 || a[i - 1] <= v);
  check('sort: click reverses to ascending', ascOk, `first values ${asc.slice(0, 5).join(', ')}`);

  const nullsLastAsc = asc.every((v, i) => v !== null || asc.slice(i).every((x) => x === null));
  check('sort: nulls last when ascending', nullsLastAsc, `${asc.filter((v) => v === null).length} nulls`);

  check('sort: order actually changed', JSON.stringify(desc) !== JSON.stringify(asc), 'desc !== asc');

  // Paging. TablePager renders nothing when everything fits on one page, which
  // is correct behaviour — a dataset under the page size simply cannot exercise
  // these checks, so skip rather than fail. A dataset that SHOULD page but
  // doesn't still fails, because the pager would be missing with >PAGE_SIZE rows.
  const totalRows = await page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (r) => r.length);
  const hasPager = (await page.$('[aria-label="Next page"]')) !== null;

  if (!hasPager && totalRows < PAGE_SIZE) {
    console.log(`SKIP  paging: only ${totalRows} rows in the busiest tab — under the ${PAGE_SIZE} page size, so no pager exists (correct)`);
    console.log('SKIP  dossier: closes on page change — requires a second page');
    skipped.push('paging checks (dataset smaller than one page)');

    // The dossier itself is still testable without paging.
    await page.click('[role="tabpanel"] tbody tr[data-imo]');
    await page.waitForTimeout(400);
    const expandedOnly = await page.$$eval('[role="tabpanel"] tr[aria-expanded="true"]', (e) => e.length);
    check('dossier: row expands', expandedOnly === 1, `${expandedOnly} expanded rows`);
    await checkKeyboardReachable(page);
  } else {
    check('paging: pager present when rows exceed page size', hasPager, `${totalRows} rows rendered, pager ${hasPager ? 'present' : 'MISSING'}`);

    const before = await page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (r) =>
      r.map((x) => x.getAttribute('data-imo')),
    );
    const label = await page.textContent('[role="tabpanel"] [aria-live="polite"]');
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(250);
    const after = await page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (r) =>
      r.map((x) => x.getAttribute('data-imo')),
    );
    const labelAfter = await page.textContent('[role="tabpanel"] [aria-live="polite"]');

    check('paging: row set changes', JSON.stringify(before) !== JSON.stringify(after), `${before.length} → ${after.length} rows`);
    check('paging: range label updates', label !== labelAfter, `"${label?.trim()}" → "${labelAfter?.trim()}"`);

    // Dossier still opens, and closes when the page changes.
    await page.click('[role="tabpanel"] tbody tr[data-imo]');
    await page.waitForTimeout(400);
    const expanded = await page.$$eval('[role="tabpanel"] tr[aria-expanded="true"]', (e) => e.length);
    check('dossier: row expands', expanded === 1, `${expanded} expanded rows`);

    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300);
    const stillExpanded = await page.$$eval('[role="tabpanel"] tr[aria-expanded="true"]', (e) => e.length);
    check('dossier: closes on page change', stillExpanded === 0, `${stillExpanded} expanded after paging`);
  }

  await page.close();

  // The reported screenshot showed SPOOFED POSITION orphaned on its own row at
  // 1180: flex-wrap fits seven tabs and drops the eighth. A 4-column grid
  // divides eight tabs into two rows of four at both tablet orientations.
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForSelector('[data-testid="fleet-tabs"] [role="tab"]', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const tag = `tablet@${w}x${h}`;

    const rows = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[data-testid="fleet-tabs"] [role="tab"]')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const byTop = new Map();
      for (const r of tabs) {
        const k = Math.round(r.top);
        byTop.set(k, (byTop.get(k) ?? 0) + 1);
      }
      return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
    });

    check(`${tag}: fleet tabs in exactly two rows`, rows.length === 2, `${rows.length} rows: [${rows}]`);

    // Every row is exactly 4 except possibly the last, which is 1-4. This is
    // the direct proof that a 4-column grid is active (rather than "each row
    // >= 4", which silently assumed exactly 8 tabs and would false-fail
    // whenever local seed data doesn't populate every anomaly category — a
    // dataset composition detail, not a layout defect). Still catches the
    // original bug: flex-wrap's 7+1 split fails here too (7 !== 4), and a
    // regression back to grid-cols-2 fails immediately on the first row.
    const fullRows = rows.slice(0, -1);
    const lastRow = rows[rows.length - 1];
    const isCompleteGridOfFour =
      fullRows.every((n) => n === 4) && (rows.length === 0 || (lastRow >= 1 && lastRow <= 4));
    check(`${tag}: tabs form complete rows of four`, isCompleteGridOfFour, `row counts [${rows}]`);

    await page.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${BASE}`);
  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.join('; ')}`);
    console.log('Re-run against a full dataset to exercise these — e.g. FLEET_URL=https://straits.randyren.org/fleet npm run verify:fleet');
  }
  if (failed.length > 0) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

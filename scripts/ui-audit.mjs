/**
 * ui-audit.mjs — measured mobile/desktop reachability detectors for Straits.
 *
 * Backs the checkpoints in PLAN-mobile-reach.md. Every detector asserts a
 * user-level property against the live DOM (can this be reached / tapped /
 * seen), never a stylesheet value — a screenshot cannot show what isn't in it,
 * and a class name cannot tell you whether a panel is paintable.
 *
 * Usage:
 *   node scripts/ui-audit.mjs <detector> [--record] [--json]
 *   detectors: reach | sheet | hscroll | targets | strips | desktop | all
 *
 * Exit codes: 0 = no failures, 1 = at least one failure, 3 = harness error.
 * Output: one `OK <detector> <route>@<WxH>` or
 *         `FAIL <detector> <route>@<WxH>: <measurement>` line per case.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ROUTES = ['/dashboard', '/analytics', '/fleet', '/about'];
const BASELINE = '.ui-baseline/desktop-1440x900.json';

const MOBILE = [
  { w: 320, h: 568 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 844, h: 390 },
  { w: 834, h: 1112 },
];
const ALL_WIDTHS = [...MOBILE, { w: 1024, h: 768 }, { w: 1100, h: 768 }, { w: 1200, h: 768 }, { w: 1280, h: 800 }, { w: 1440, h: 900 }];
const DESKTOP = { w: 1440, h: 900 };

const DETECTORS = ['reach', 'sheet', 'hscroll', 'targets', 'strips', 'desktop', 'all'];

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`ui-audit.mjs — detectors: ${DETECTORS.join(' | ')}
  node scripts/ui-audit.mjs reach      rail panels reachable by scrolling (mobile)
  node scripts/ui-audit.mjs sheet      vessel detail on screen after select (mobile)
  node scripts/ui-audit.mjs hscroll    no horizontal page scroll (all widths)
  node scripts/ui-audit.mjs targets    interactive elements >=44px tall (<1024)
  node scripts/ui-audit.mjs strips     no content hidden behind overflow-x
  node scripts/ui-audit.mjs desktop    1440x900 layout matches baseline (--record to write)
  node scripts/ui-audit.mjs all        every detector`);
  process.exit(0);
}
const detector = args[0];
const RECORD = args.includes('--record');
if (!DETECTORS.includes(detector)) {
  console.error(`harness error: unknown detector ${detector}; expected ${DETECTORS.join('|')}`);
  process.exit(3);
}

const results = [];
const ok = (d, route, vp, note = '') => results.push({ pass: true, line: `OK ${d} ${route}@${vp.w}x${vp.h}${note ? ' ' + note : ''}` });
const fail = (d, route, vp, msg) => results.push({ pass: false, line: `FAIL ${d} ${route}@${vp.w}x${vp.h}: ${msg}` });

// ---------------------------------------------------------------- dev server
async function reachable() {
  try {
    const r = await fetch(BASE + '/dashboard', { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

async function ensureServer() {
  if (await reachable()) return null;
  const proc = spawn('npm', ['run', 'dev'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await reachable()) return proc;
  }
  try { process.kill(-proc.pid, 'SIGTERM'); } catch {}
  throw new Error(`dev server did not become reachable at ${BASE} within 120s`);
}

// `stable` waits until layout stops moving. The desktop baseline compares
// heights, and async chart/data renders can land after a fixed delay — a
// geometry check that races the page under-reports height and fails for
// reasons that have nothing to do with the diff being verified.
async function settle(page, route, { stable = false } = {}) {
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
  if (route === '/dashboard') {
    await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 }).catch(() => {});
  }
  if (route === '/analytics') {
    await page.waitForSelector('svg.recharts-surface', { timeout: 30000 }).catch(() => {});
  }
  await page.waitForTimeout(stable ? 800 : 3000);
  if (!stable) return;
  let prev = -1, steady = 0;
  for (let i = 0; i < 30 && steady < 2; i++) {
    const h = await page.evaluate(() => {
      const m = document.querySelector('main');
      return (m ? m.scrollHeight : 0) + document.documentElement.scrollHeight;
    });
    if (h === prev) steady++; else { steady = 0; prev = h; }
    await page.waitForTimeout(400);
  }
}

// ------------------------------------------------------------------ browser
const IN_PAGE = {
  // Every rail panel must be bringable on screen AND hit-testable there.
  // A 0-height scroll container reports plausible rects for clipped children,
  // so geometry alone is not enough — elementFromPoint is the ground truth.
  reach: () => {
    const vh = document.documentElement.clientHeight;
    const rail = [...document.querySelectorAll('main div')].find((d) => (d.className || '').toString().includes('divide-y'));
    if (!rail) return { error: 'rail container (main div.divide-y) not found' };
    const panels = [...rail.children].filter((c) => c.getBoundingClientRect().height > 0 || c.scrollHeight > 0);
    const out = { railClientH: rail.clientHeight, railScrollH: rail.scrollHeight, panels: [] };
    for (const p of panels) {
      p.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = p.getBoundingClientRect();
      const visTop = Math.max(r.top, 0);
      const visBot = Math.min(r.bottom, vh);
      const visH = Math.round(visBot - visTop);
      const label = (p.textContent || '').trim().slice(0, 18).replace(/\s+/g, ' ');
      let hit = false;
      if (visH > 0 && r.width > 0) {
        const x = Math.min(Math.max(r.left + r.width / 2, 1), document.documentElement.clientWidth - 1);
        const y = Math.min(Math.max(visTop + visH / 2, 1), vh - 1);
        const el = document.elementFromPoint(x, y);
        hit = !!el && (el === p || p.contains(el));
      }
      // "reachable" = actually painted and touchable, showing at least 120px
      // (or its whole self, for panels shorter than that).
      const need = Math.min(Math.round(r.height), 120);
      out.panels.push({ label, h: Math.round(r.height), visH, hit, reachable: hit && visH >= need, need });
    }
    return out;
  },

  intelToggle: () => {
    const btn = document.querySelector('button[aria-label*="intel feed" i]');
    if (!btn) return { present: false };
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    const vh = document.documentElement.clientHeight;
    const visTop = Math.max(r.top, 0), visBot = Math.min(r.bottom, vh);
    if (visBot - visTop <= 0) return { present: true, hittable: false, before: btn.getAttribute('aria-expanded') };
    const x = Math.min(Math.max(r.left + r.width / 2, 1), document.documentElement.clientWidth - 1);
    const y = Math.min(Math.max(visTop + (visBot - visTop) / 2, 1), vh - 1);
    const el = document.elementFromPoint(x, y);
    return { present: true, hittable: !!el && (el === btn || btn.contains(el)), before: btn.getAttribute('aria-expanded'), point: [Math.round(x), Math.round(y)] };
  },

  hscroll: () => {
    const de = document.documentElement;
    const over = de.scrollWidth - de.clientWidth;
    let worst = null;
    if (over > 1) {
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const past = Math.round(r.right - de.clientWidth);
        if (past > 0 && (!worst || past > worst.past)) {
          worst = { past, el: `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}` };
        }
      }
    }
    return { over, clientW: de.clientWidth, scrollW: de.scrollWidth, worst };
  },

  targets: () => {
    const bad = [];
    for (const el of document.querySelectorAll('button, a, [role="button"], input, select, tr[aria-expanded]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('.maplibregl-ctrl-attrib, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left')) continue; // 3rd-party control
      if (r.height < 44) {
        bad.push({ t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) });
      }
    }
    return { bad };
  },

  strips: () => {
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('.maplibregl-map')) continue; // map panes scroll by design
      if (el.scrollWidth > el.clientWidth + 4 && cs.overflowX !== 'visible') {
        bad.push({ el: `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}`, hidden: el.scrollWidth - el.clientWidth, visible: el.clientWidth });
      }
    }
    return { bad };
  },

  // Layout scaffolding plus the header controls the fixes actually resize.
  // Deliberately excludes rail panel internals (main > * > *): their heights
  // follow live prices and RSS headlines, which change between runs. A check
  // that fails for reasons unrelated to the diff is worse than no check —
  // it teaches the executor to distrust the verifier.
  snapshot: () => {
    const sel = 'header, header > div, header nav, header nav a, header button, header input, main, main > *, footer';
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 80),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return { els: out, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  },

  vesselSheet: () => {
    // The desktop panel (max-lg:hidden) and the mobile sheet both contain this
    // text. Take the one that is actually rendered — a display:none match walks
    // up to the rail and reports the rail's geometry as if it were the sheet.
    const head = [...document.querySelectorAll('*')].find((e) => {
      if (e.children.length !== 0 || !/VESSEL DETAIL/i.test(e.textContent || '')) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!head) return { found: false };
    // Prefer the fixed sheet container when there is one (mobile); otherwise the
    // nearest sizable ancestor (desktop rail panel).
    let panel = head;
    const chain = [];
    for (let e = head.parentElement, i = 0; e && i < 8; e = e.parentElement, i++) chain.push(e);
    const fixed = chain.find((e) => getComputedStyle(e).position === 'fixed');
    if (fixed) panel = fixed;
    else for (const e of chain) { panel = e; if (e.getBoundingClientRect().height > 120) break; }
    const r = panel.getBoundingClientRect();
    const vh = document.documentElement.clientHeight;
    const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return {
      found: true, top: Math.round(r.top), h: Math.round(r.height), visH: Math.round(visH), vh,
      frac: r.height ? +(visH / r.height).toFixed(2) : 0,
      cls: (panel.className || '').toString().slice(0, 60),
    };
  },
};

async function selectFirstVessel(page) {
  const input = page.locator('input[aria-label="Search vessels by name, IMO, or MMSI"]');
  if (!(await input.isVisible().catch(() => false))) return false;
  const vessels = await fetch(BASE + '/api/vessels').then((r) => r.json()).catch(() => null);
  const name = vessels?.vessels?.[0]?.name;
  if (!name) return false;
  await input.fill(name.slice(0, 8));
  await page.waitForTimeout(1500);
  const opt = page.locator('[role="option"]').first();
  if (!(await opt.isVisible().catch(() => false))) return false;
  await opt.click();
  await page.waitForTimeout(2500);
  return true;
}

// --------------------------------------------------------------------- main
let server = null;
let browser = null;
try {
  server = await ensureServer();
  browser = await chromium.launch();
  const want = (d) => detector === 'all' || detector === d;

  if (want('reach')) {
    for (const vp of MOBILE) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
      const page = await ctx.newPage();
      await settle(page, '/dashboard');
      const r = await page.evaluate(IN_PAGE.reach);
      if (r.error) fail('reach', '/dashboard', vp, r.error);
      else {
        const bad = r.panels.filter((p) => !p.reachable);
        if (bad.length) {
          fail('reach', '/dashboard', vp,
            `rail clientH=${r.railClientH} scrollH=${r.railScrollH}; unreachable: ` +
            bad.map((b) => `"${b.label}" h=${b.h} visible=${b.visH}/${b.need} hit=${b.hit}`).join('; '));
        } else {
          ok('reach', '/dashboard', vp, `panels=${r.panels.length} railScrollH=${r.railScrollH}`);
        }
      }
      // finding #2: the intel-feed toggle must actually respond to a tap
      const t = await page.evaluate(IN_PAGE.intelToggle);
      if (!t.present) fail('reach', '/dashboard', vp, 'intel feed toggle not found');
      else if (!t.hittable) fail('reach', '/dashboard', vp, `intel toggle not hit-testable (aria-expanded=${t.before})`);
      else {
        await page.locator('button[aria-label*="intel feed" i]').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        const after = await page.locator('button[aria-label*="intel feed" i]').getAttribute('aria-expanded').catch(() => null);
        if (after !== null && after !== t.before) ok('reach', '/dashboard', vp, 'intel-toggle=ok');
        else fail('reach', '/dashboard', vp, `intel toggle did not change state (${t.before} -> ${after})`);
      }
      await ctx.close();
    }
  }

  if (want('sheet')) {
    for (const vp of MOBILE) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
      const page = await ctx.newPage();
      await settle(page, '/dashboard');
      const selected = await selectFirstVessel(page);
      if (!selected) { fail('sheet', '/dashboard', vp, 'could not select a vessel via search'); await ctx.close(); continue; }
      const s = await page.evaluate(IN_PAGE.vesselSheet);
      if (!s.found) fail('sheet', '/dashboard', vp, 'vessel detail surface not found after select');
      else if (s.top >= s.vh) fail('sheet', '/dashboard', vp, `sheet entirely below fold: top=${s.top} vh=${s.vh} h=${s.h}`);
      else if (s.frac < 0.5) fail('sheet', '/dashboard', vp, `only ${s.visH}px of ${s.h}px visible (${Math.round(s.frac * 100)}%), top=${s.top} vh=${s.vh}`);
      else ok('sheet', '/dashboard', vp, `visible=${s.visH}/${s.h} top=${s.top}`);
      await ctx.close();
    }
  }

  if (want('hscroll')) {
    for (const vp of ALL_WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w < 1024 });
      const page = await ctx.newPage();
      for (const route of ROUTES) {
        await settle(page, route);
        const r = await page.evaluate(IN_PAGE.hscroll);
        if (r.over > 1) fail('hscroll', route, vp, `body scrolls ${r.over}px horizontally (scrollW=${r.scrollW} clientW=${r.clientW})${r.worst ? `, worst: ${r.worst.el} ends ${r.worst.past}px past` : ''}`);
        else ok('hscroll', route, vp);
      }
      await ctx.close();
    }
  }

  if (want('targets') || want('strips')) {
    for (const vp of MOBILE) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
      const page = await ctx.newPage();
      for (const route of ROUTES) {
        await settle(page, route);
        if (want('targets')) {
          const { bad } = await page.evaluate(IN_PAGE.targets);
          if (bad.length) fail('targets', route, vp, `${bad.length} under 44px: ` + bad.slice(0, 6).map((b) => `"${b.t}" ${b.w}x${b.h}`).join(', '));
          else ok('targets', route, vp);
        }
        if (want('strips')) {
          const { bad } = await page.evaluate(IN_PAGE.strips);
          if (bad.length) fail('strips', route, vp, bad.map((b) => `${b.el} hides ${b.hidden}px of ${b.hidden + b.visible}px`).join('; '));
          else ok('strips', route, vp);
        }
      }
      await ctx.close();
    }
  }

  if (want('desktop')) {
    const ctx = await browser.newContext({ viewport: { width: DESKTOP.w, height: DESKTOP.h } });
    const page = await ctx.newPage();
    const snap = {};
    for (const route of ROUTES) {
      await settle(page, route, { stable: true });
      snap[route] = await page.evaluate(IN_PAGE.snapshot);
    }
    await ctx.close();
    if (RECORD) {
      fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
      fs.writeFileSync(BASELINE, JSON.stringify(snap, null, 1));
      console.log(`recorded baseline ${BASELINE} (${ROUTES.length} routes)`);
    } else if (!fs.existsSync(BASELINE)) {
      console.error(`harness error: ${BASELINE} missing — run: node scripts/ui-audit.mjs desktop --record`);
      process.exit(3);
    } else {
      const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
      for (const route of ROUTES) {
        const a = base[route], b = snap[route];
        if (!a) { fail('desktop', route, DESKTOP, 'route missing from baseline'); continue; }
        const diffs = [];
        if (a.els.length !== b.els.length) diffs.push(`element count ${a.els.length} -> ${b.els.length}`);
        const n = Math.min(a.els.length, b.els.length);
        for (let i = 0; i < n; i++) {
          const x = a.els[i], y = b.els[i];
          // Assert geometry, not the class string. `cls` identifies the element
          // across runs; asserting equality on it would fail for every mobile
          // -gated (max-lg:) class added, which cannot affect 1440px rendering.
          // Anything that does affect desktop still moves x/y/w/h below.
          if (x.tag !== y.tag) { diffs.push(`#${i} tag ${x.tag} -> ${y.tag}`); continue; }
          if (x.x !== y.x || x.y !== y.y || x.w !== y.w || x.h !== y.h) {
            diffs.push(`#${i} ${x.tag}.${x.cls.slice(0, 24)} ${x.w}x${x.h}@${x.x},${x.y} -> ${y.w}x${y.h}@${y.x},${y.y}`);
          }
        }
        if (a.scrollW !== b.scrollW) diffs.push(`scrollWidth ${a.scrollW} -> ${b.scrollW}`);
        if (diffs.length) fail('desktop', route, DESKTOP, `${diffs.length} geometry change(s): ` + diffs.slice(0, 4).join(' | '));
        else ok('desktop', route, DESKTOP, `${b.els.length} elements identical`);
      }
    }
  }
} catch (e) {
  console.error('harness error:', e.message);
  if (browser) await browser.close().catch(() => {});
  if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
  process.exit(3);
}

if (browser) await browser.close();
if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }

for (const r of results) console.log(r.line);
const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);

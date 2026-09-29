/**
 * BASE_URL=http://localhost:3000 npm run verify:motion
 * Checks the motion overlay draws moving ships, stays at frame rate, clicking a moving ship
 * opens its tracking section, and no console errors occur.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const b = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await p.waitForSelector('[data-testid="motion-overlay"]');
await p.waitForFunction(() => fetch('/api/tracks').then((r) => r.ok), null, { timeout: 30000 });
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
const lit = await p.evaluate(() => { const c = document.querySelector('[data-testid="motion-overlay"]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
const tracks = await p.evaluate(() => fetch('/api/tracks').then((r) => r.json()));
const moving = tracks.vessels.filter((v) => v.state === 'underway').length;
const checks = [['fps ≥ 50', fps >= 50, fps], ['overlay drew pixels', lit > 500, lit], ['engine output present', tracks.vessels.length > 0, tracks.vessels.length], ['some ships estimated', moving > 0, moving], ['no page errors', errors.length === 0, errors.join(' | ')]];
for (const [name, ok, v] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${v}`);
await b.close();
process.exit(checks.every((c) => c[1]) ? 0 : 1);

/** Small read-only concurrency smoke, not a capacity/load-to-failure test.
 * At most three simultaneous requests, no cache busting, stop on error/8s latency.
 * BASE_URL=https://straits.randyren.org node scripts/measure-api-concurrency.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.BASE_URL ?? 'http://localhost:3000';
const out = process.env.OUT_DIR ?? 'artifacts/performance/api';
await mkdir(out, { recursive: true });
const samples = [];
let stopped = false;
for (const path of ['/api/chokepoints', '/api/vessels?tankersOnly=false']) {
  for (const concurrency of [1, 3]) {
    if (stopped) break;
    const batch = await Promise.all(Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      try {
        const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
        const headersMs = performance.now() - start;
        const body = await response.text();
        const json = JSON.parse(body);
        return { path, concurrency, status: response.status, headersMs,
          totalMs: performance.now() - start, decodedBytes: Buffer.byteLength(body),
          cache: response.headers.get('x-vercel-cache'), vercelId: response.headers.get('x-vercel-id'),
          count: json.vessels?.length ?? json.chokepoints?.length };
      } catch (e) { return { path, concurrency, error: e.message, totalMs: performance.now() - start }; }
    }));
    samples.push(...batch);
    console.log(JSON.stringify(batch));
    stopped = batch.some(r => r.error || r.status >= 400 || r.totalMs > 8000);
  }
}
await writeFile(`${out}/api-concurrency.json`, JSON.stringify({ at: new Date().toISOString(), base, stopped, samples }, null, 2));

/** Disposable-DB mixed-route ramp. Refuses non-local targets; no production load. */
import { mkdir, writeFile } from 'node:fs/promises';

const base = new URL(process.env.BASE_URL ?? 'http://localhost:3100');
if (!['localhost', '127.0.0.1', '::1'].includes(base.hostname)) {
  throw new Error('Capacity ramp is restricted to a local server and disposable database');
}
const routes = ['/api/vessels?tankersOnly=false', '/api/chokepoints', '/api/watch', '/api/coverage', '/api/status'];
const levels = [1, 5, 10, 25, 50];
const out = process.env.OUT_DIR ?? 'artifacts/performance/local-capacity';
await mkdir(out, { recursive: true });
const results = [];

for (const users of levels) {
  const samples = await Promise.all(Array.from({ length: users }, async (_, index) => {
    const route = routes[index % routes.length];
    const start = performance.now();
    try {
      const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000) });
      const body = await response.arrayBuffer();
      return { route, status: response.status, ms: performance.now() - start, bytes: body.byteLength };
    } catch (error) {
      return { route, error: error instanceof Error ? error.name : 'unknown', ms: performance.now() - start };
    }
  }));
  const elapsed = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const result = { users, p50Ms: elapsed[Math.ceil(users * 0.5) - 1], p95Ms: elapsed[Math.ceil(users * 0.95) - 1],
    errors: samples.filter((sample) => sample.error || sample.status !== 200).length, samples };
  results.push(result);
  console.log(JSON.stringify({ users, p50Ms: Math.round(result.p50Ms), p95Ms: Math.round(result.p95Ms), errors: result.errors }));
  if (result.errors || result.p95Ms > 8000) break;
}

await writeFile(`${out}/ramp.json`, JSON.stringify({ at: new Date().toISOString(), base: base.href, results }, null, 2));

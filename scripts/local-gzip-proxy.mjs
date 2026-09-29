/** Local-only proxy to model Vercel's compressed JSON transfer in lab probes.
 * ORIGIN=http://localhost:3100 PORT=3200 node scripts/local-gzip-proxy.mjs
 */
import http from 'node:http';
import { gzipSync } from 'node:zlib';

const origin = new URL(process.env.ORIGIN ?? 'http://localhost:3100');
const port = Number(process.env.PORT ?? 3200);

http.createServer((request, response) => {
  const upstream = http.request(new URL(request.url ?? '/', origin), {
    method: request.method,
    headers: { ...request.headers, host: origin.host },
  }, (remote) => {
    const compress = request.url?.startsWith('/api/vessels?') && remote.statusCode === 200 && request.headers['accept-encoding']?.includes('gzip');
    if (!compress) {
      response.writeHead(remote.statusCode ?? 502, remote.headers);
      remote.pipe(response);
      return;
    }

    const chunks = [];
    remote.on('data', (chunk) => chunks.push(chunk));
    remote.on('end', () => {
      const body = gzipSync(Buffer.concat(chunks));
      const headers = { ...remote.headers, 'content-encoding': 'gzip', 'content-length': body.length };
      delete headers['transfer-encoding'];
      response.writeHead(remote.statusCode ?? 502, headers);
      response.end(body);
    });
  });
  upstream.on('error', () => { response.writeHead(502); response.end(); });
  request.pipe(upstream);
}).listen(port, () => console.log(`Lab gzip proxy: http://localhost:${port} -> ${origin}`));

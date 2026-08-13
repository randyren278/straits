// ais-key-check.mjs — verify AISSTREAM_API_KEY actually delivers messages.
//
// Connects to AISStream with a worldwide bounding box (no chokepoint filter)
// so a failure can't be blamed on a quiet region — global AIS traffic is
// thousands of messages/second, so any working key sees a message within
// seconds. Exits 0 on the first message received, 1 on timeout/error.
//
// Usage: npx tsx --env-file=.env.harvester scripts/harvester/ais-key-check.mjs

import WebSocket from 'ws';

const TIMEOUT_MS = 20_000;
const key = process.env.AISSTREAM_API_KEY;

if (!key) {
  console.error('AISSTREAM_API_KEY is not set');
  process.exit(1);
}

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
let settled = false;

const finish = (ok, reason) => {
  if (settled) return;
  settled = true;
  console.log(ok ? `OK — ${reason}` : `FAIL — ${reason}`);
  try { ws.close(); } catch { /* already closing */ }
  process.exit(ok ? 0 : 1);
};

ws.on('open', () => {
  console.log('Connected. Subscribing worldwide...');
  ws.send(JSON.stringify({
    APIKey: key,
    BoundingBoxes: [[[-90, -180], [90, 180]]],
  }));
});

ws.on('message', (data) => {
  const preview = data.toString().slice(0, 200);
  finish(true, `received a message within ${TIMEOUT_MS / 1000}s: ${preview}`);
});

ws.on('error', (err) => finish(false, `websocket error: ${err.message}`));
ws.on('close', (code, reason) => {
  if (!settled) finish(false, `closed before any message (code ${code}) ${reason.toString()}`);
});

setTimeout(() => finish(false, `no message within ${TIMEOUT_MS / 1000}s — key is dead/quota-exhausted/revoked`), TIMEOUT_MS);

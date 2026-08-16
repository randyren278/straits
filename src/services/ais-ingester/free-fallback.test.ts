import { describe, expect, it, vi } from 'vitest';
import { fetchFreeAisFallback } from './free-fallback';

const bounds = [{ minLat: 23, minLon: 47, maxLat: 30, maxLon: 57.5 }];

function payload({ stale = false, mmsi = 123456789 }: { stale?: boolean; mmsi?: number } = {}): ArrayBuffer {
  const name = new TextEncoder().encode('TEST');
  const buffer = new ArrayBuffer(16 + 2 + 4 + 4 + 4 + 2 + name.length);
  const view = new DataView(buffer);
  view.setUint16(1, 12); // 16-byte header; the reference MMSI is at byte 12.
  view.setInt32(8, 1);
  view.setInt32(12, 0);
  view.setInt16(16, 0x0A50 | (stale ? 4 : 0)); // heading index 10, tanker category
  view.setInt32(18, mmsi);
  view.setInt32(22, Math.round(25.25 * 600_000));
  view.setInt32(26, Math.round(54.5 * 600_000));
  view.setInt8(30, 0);
  view.setInt8(31, name.length);
  new Uint8Array(buffer, 32).set(name);
  return buffer;
}

describe('fetchFreeAisFallback', () => {
  it('decodes a live Middle East map fix and sends a bounded region request', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(payload(), { status: 200 }));
    const now = new Date('2026-08-16T13:30:00Z');

    await expect(fetchFreeAisFallback(bounds, fetcher, now)).resolves.toEqual([
      expect.objectContaining({ mmsi: '123456789', latitude: 25.25, longitude: 54.5, heading: 113, name: 'TEST', shipType: 80, time: now }),
    ]);
    expect(fetcher.mock.calls[0][0]).toContain('bbox=28200000,13800000,34500000,18000000');
  });

  it('rejects stale-only and failed responses rather than claiming healthy coverage', async () => {
    await expect(fetchFreeAisFallback(bounds, vi.fn().mockResolvedValue(new Response(payload({ stale: true }), { status: 200 })))).rejects.toThrow('no current Middle East positions');
    await expect(fetchFreeAisFallback(bounds, vi.fn().mockResolvedValue(new Response('', { status: 429 })))).rejects.toThrow('HTTP 429');
  });
});

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { meterPool, rollEgressHistory, sumBytes, egressBudgetWarning, formatMB } from './egress-meter';

function fakeClient(stream: unknown) {
  return { connection: { stream } };
}

describe('meterPool', () => {
  it('sums wire bytes from the TCP socket under each TLS connection', () => {
    const pool = new EventEmitter();
    const meter = meterPool(pool as never);
    const a = { bytesRead: 100, _parent: { bytesRead: 130 } };
    const b = { bytesRead: 50, _parent: { bytesRead: 70 } };
    pool.emit('connect', fakeClient(a));
    pool.emit('connect', fakeClient(b));
    a._parent.bytesRead = 1130;
    expect(meter.totalBytes()).toBe(1200);
  });

  it('falls back to the stream itself on a plain TCP connection', () => {
    const pool = new EventEmitter();
    const meter = meterPool(pool as never);
    pool.emit('connect', fakeClient({ bytesRead: 42 }));
    expect(meter.totalBytes()).toBe(42);
  });

  it('keeps counting a connection after the pool has closed it', () => {
    const pool = new EventEmitter();
    const meter = meterPool(pool as never);
    const s = { bytesRead: 10, _parent: { bytesRead: 500 } };
    pool.emit('connect', fakeClient(s));
    pool.emit('remove', fakeClient(s));
    expect(meter.totalBytes()).toBe(500);
  });

  it('ignores a client without a connection stream', () => {
    const pool = new EventEmitter();
    const meter = meterPool(pool as never);
    pool.emit('connect', {});
    expect(meter.totalBytes()).toBe(0);
  });
});

describe('rollEgressHistory', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');

  it('appends this run and drops samples older than 24h', () => {
    const prev = [
      { at: '2026-10-06T11:00:00.000Z', bytes: 9 },
      { at: '2026-10-06T13:00:00.000Z', bytes: 5 },
    ];
    const out = rollEgressHistory(prev, { at: '2026-10-07T12:00:00.000Z', bytes: 7 }, now);
    expect(out).toEqual([
      { at: '2026-10-06T13:00:00.000Z', bytes: 5 },
      { at: '2026-10-07T12:00:00.000Z', bytes: 7 },
    ]);
  });

  it('replaces a sample already recorded for the same run instead of double counting it', () => {
    const prev = [{ at: '2026-10-07T12:00:00.000Z', bytes: 3 }];
    const out = rollEgressHistory(prev, { at: '2026-10-07T12:00:00.000Z', bytes: 8 }, now);
    expect(out).toEqual([{ at: '2026-10-07T12:00:00.000Z', bytes: 8 }]);
  });

  it('discards malformed history from a corrupt or older status.json', () => {
    const prev = [null, 'x', { at: 'nope', bytes: 1 }, { at: '2026-10-07T11:00:00.000Z', bytes: -4 }, { at: '2026-10-07T11:30:00.000Z', bytes: 2 }];
    const out = rollEgressHistory(prev, { at: '2026-10-07T12:00:00.000Z', bytes: 1 }, now);
    expect(out).toEqual([
      { at: '2026-10-07T11:30:00.000Z', bytes: 2 },
      { at: '2026-10-07T12:00:00.000Z', bytes: 1 },
    ]);
  });

  it('starts fresh when there is no history', () => {
    expect(rollEgressHistory(undefined, { at: '2026-10-07T12:00:00.000Z', bytes: 4 }, now))
      .toEqual([{ at: '2026-10-07T12:00:00.000Z', bytes: 4 }]);
  });
});

describe('sumBytes', () => {
  it('totals the samples', () => {
    expect(sumBytes([{ at: 'a', bytes: 2 }, { at: 'b', bytes: 3 }])).toBe(5);
  });
});

describe('egressBudgetWarning', () => {
  it('is silent within budget', () => {
    expect(egressBudgetWarning(99_000_000, 100_000_000)).toBeNull();
  });

  it('names the 24h total and the budget when over', () => {
    expect(egressBudgetWarning(312_400_000, 100_000_000))
      .toBe('Supabase egress 312.4 MB in 24h exceeds the 100.0 MB budget');
  });
});

describe('formatMB', () => {
  it('formats bytes as decimal megabytes with one decimal', () => {
    expect(formatMB(8_249_000)).toBe('8.2 MB');
    expect(formatMB(0)).toBe('0.0 MB');
  });
});

/**
 * Tests for the harvester's bounded DB retry.
 * Fake timers keep the backoff sleeps from making the suite slow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withDbRetry, DB_RETRY_ATTEMPTS } from './db-retry';

describe('withDbRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the value without retrying when the statement succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withDbRetry('stmt', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recovers when a transient failure is followed by a success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Connection terminated due to connection timeout'))
      .mockResolvedValue('ok');

    const promise = withDbRetry('stmt', fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('recovers on the final attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('blip'))
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue('ok');

    const promise = withDbRetry('stmt', fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(DB_RETRY_ATTEMPTS);
  });

  it('rethrows the last error after exhausting attempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(new Error('final'));

    const promise = withDbRetry('stmt', fn);
    const assertion = expect(promise).rejects.toThrow('final');
    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(DB_RETRY_ATTEMPTS);
  });

  it('backs off exponentially (1s then 2s) rather than hammering', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    const delays: number[] = [];
    const spy = vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);

    await expect(withDbRetry('stmt', fn)).rejects.toThrow('down');
    expect(delays).toEqual([1000, 2000]);
    spy.mockRestore();
  });
});

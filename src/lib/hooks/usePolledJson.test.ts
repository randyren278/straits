import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolledJson } from './usePolledJson';

describe('usePolledJson', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches exactly once for two subscribers sharing a key', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const a = renderHook(() => usePolledJson('shared-key', fetcher, 1000));
    const b = renderHook(() => usePolledJson('shared-key', fetcher, 1000));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a.result.current).toEqual({ ok: true });
    expect(b.result.current).toEqual({ ok: true });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // One interval shared by both subscribers, not one per subscriber.
    expect(fetcher).toHaveBeenCalledTimes(2);

    a.unmount();
    b.unmount();
  });

  it('clears the interval once the last subscriber unmounts', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const a = renderHook(() => usePolledJson('teardown-key', fetcher, 1000));
    const b = renderHook(() => usePolledJson('teardown-key', fetcher, 1000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    a.unmount();

    // b is still subscribed, so the interval must still be running.
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    b.unmount();

    // No subscribers left — further ticks must not trigger any more fetches.
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('gives a late subscriber the cached value synchronously', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const a = renderHook(() => usePolledJson('late-key', fetcher, 1000));
    await act(async () => {
      await Promise.resolve();
    });
    expect(a.result.current).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Mount a second subscriber well after the first fetch landed. It must
    // read the cached value on its very first render, not `null`, and must
    // not trigger a second fetch just by mounting.
    const b = renderHook(() => usePolledJson('late-key', fetcher, 1000));
    expect(b.result.current).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
  });
});

'use client';

/**
 * Shares one background poller across every component polling the same key.
 *
 * StatusChip and NotificationBell both need to be mounted twice (once per
 * breakpoint, hidden with CSS rather than JS) so exactly one is ever in the
 * accessibility tree at a time. Left to their own effects, each mounted copy
 * would open its own `setInterval` and double the request rate. This hook
 * keeps a module-level registry keyed by `key`: one in-flight request and one
 * interval per key no matter how many components subscribe, ref-counted so
 * the interval is torn down when the last subscriber unmounts. A component
 * that mounts after the first fetch has already landed reads the cached
 * value synchronously instead of waiting out a full period.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

type Listener = () => void;

interface RegistryEntry<T> {
  data: T | null;
  subscribers: number;
  timerId: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  controller: AbortController | null;
  failures: number;
  stop: (() => void) | null;
  listeners: Set<Listener>;
}

const registry = new Map<string, RegistryEntry<unknown>>();

function getEntry<T>(key: string): RegistryEntry<T> {
  let entry = registry.get(key) as RegistryEntry<T> | undefined;
  if (!entry) {
    entry = { data: null, subscribers: 0, timerId: null, inFlight: null, controller: null, failures: 0, stop: null, listeners: new Set() };
    registry.set(key, entry as RegistryEntry<unknown>);
  }
  return entry;
}

function poll<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): Promise<void> {
  const entry = getEntry<T>(key);
  if (entry.inFlight && !entry.controller?.signal.aborted) return entry.inFlight;
  const controller = new AbortController();
  entry.controller = controller;
  const run = fetcher(controller.signal)
    .then((data) => {
      if (controller.signal.aborted) return;
      entry.data = data;
      entry.failures = 0;
      entry.listeners.forEach((listener) => listener());
    })
    .catch(() => {
      if (!controller.signal.aborted) entry.failures += 1;
      // Retain the last value on a transient failure; retry with backoff.
    })
    .finally(() => {
      if (entry.inFlight === run) entry.inFlight = null;
      if (entry.controller === controller) entry.controller = null;
    });
  entry.inFlight = run;
  return run;
}

function clearTimer(entry: RegistryEntry<unknown>): void {
  if (entry.timerId !== null) clearTimeout(entry.timerId);
  entry.timerId = null;
}

/**
 * Poll `fetcher` on a shared interval keyed by `key`. Pass `null` as `key` to
 * skip polling entirely (e.g. while a prerequisite like a user id is still
 * loading) — the hook returns `null` and subscribes to nothing until a real
 * key is supplied.
 */
export function usePolledJson<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number
): T | null {
  // Refs must not be written during render, so the "latest fetcher" is
  // captured after commit — well before any interval tick could read it.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (key === null) return () => {};

      const entry = getEntry<T>(key);
      entry.listeners.add(onStoreChange);
      entry.subscribers += 1;

      if (entry.subscribers === 1) {
        let active = true;
        const schedule = () => {
          if (!active || document.hidden) return;
          const backoff = Math.min(2 ** entry.failures, 5);
          const jitter = intervalMs < 10_000 ? 1 : 0.9 + Math.random() * 0.2;
          entry.timerId = setTimeout(run, Math.min(intervalMs * backoff * jitter, 300_000));
        };
        const run = () => {
          if (!active || document.hidden) return;
          void poll(key, fetcherRef.current).finally(schedule);
        };
        const onVisibility = () => {
          clearTimer(entry);
          if (document.hidden) entry.controller?.abort();
          else run();
        };
        entry.stop = () => {
          active = false;
          clearTimer(entry);
          entry.controller?.abort();
          document.removeEventListener('visibilitychange', onVisibility);
        };
        document.addEventListener('visibilitychange', onVisibility);
        run();
      }

      return () => {
        entry.listeners.delete(onStoreChange);
        entry.subscribers -= 1;
        if (entry.subscribers === 0) {
          entry.stop?.();
          entry.stop = null;
        }
      };
    },
    [key, intervalMs]
  );

  const getSnapshot = useCallback(() => (key === null ? null : getEntry<T>(key).data), [key]);
  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

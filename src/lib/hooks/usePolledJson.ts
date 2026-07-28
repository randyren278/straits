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
  intervalId: ReturnType<typeof setInterval> | null;
  inFlight: Promise<void> | null;
  listeners: Set<Listener>;
}

const registry = new Map<string, RegistryEntry<unknown>>();

function getEntry<T>(key: string): RegistryEntry<T> {
  let entry = registry.get(key) as RegistryEntry<T> | undefined;
  if (!entry) {
    entry = { data: null, subscribers: 0, intervalId: null, inFlight: null, listeners: new Set() };
    registry.set(key, entry as RegistryEntry<unknown>);
  }
  return entry;
}

function poll<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  const entry = getEntry<T>(key);
  if (entry.inFlight) return entry.inFlight;
  const run = fetcher()
    .then((data) => {
      entry.data = data;
      entry.listeners.forEach((listener) => listener());
    })
    .catch(() => {
      // Leave the last known value in place rather than flashing unknown on a transient failure.
    })
    .finally(() => {
      entry.inFlight = null;
    });
  entry.inFlight = run;
  return run;
}

/**
 * Poll `fetcher` on a shared interval keyed by `key`. Pass `null` as `key` to
 * skip polling entirely (e.g. while a prerequisite like a user id is still
 * loading) — the hook returns `null` and subscribes to nothing until a real
 * key is supplied.
 */
export function usePolledJson<T>(
  key: string | null,
  fetcher: () => Promise<T>,
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
        const run = () => poll(key, fetcherRef.current);
        run();
        entry.intervalId = setInterval(run, intervalMs);
      }

      return () => {
        entry.listeners.delete(onStoreChange);
        entry.subscribers -= 1;
        if (entry.subscribers === 0 && entry.intervalId !== null) {
          clearInterval(entry.intervalId);
          entry.intervalId = null;
        }
      };
    },
    [key, intervalMs]
  );

  const getSnapshot = useCallback(() => (key === null ? null : getEntry<T>(key).data), [key]);
  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

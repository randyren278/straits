'use client';

/**
 * SSR-safe localStorage hook.
 * Returns [value, setValue] like useState. On the server and first client
 * render, `value` is always `initialValue` so server/client markup matches.
 * The persisted localStorage value is read inside useEffect (after mount)
 * and applied to state. `setValue` persists to localStorage, guarded by a
 * typeof window check.
 */
import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);

  // Read the persisted value after mount to avoid hydration mismatches.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        // Strings are stored raw (preserving legacy format); other types as JSON.
        setValue(
          (typeof initialValue === 'string' ? stored : JSON.parse(stored)) as T,
        );
      }
    } catch (err) {
      console.error(`[useLocalStorage] Failed to read "${key}":`, err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          key,
          typeof next === 'string' ? next : JSON.stringify(next),
        );
      } catch (err) {
        console.error(`[useLocalStorage] Failed to write "${key}":`, err);
      }
    },
    [key],
  );

  return [value, persist];
}

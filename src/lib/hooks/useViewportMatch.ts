'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Match the same layout tier as CSS without mounting hidden data panels. */
export function useViewportMatch(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

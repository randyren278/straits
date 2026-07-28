/**
 * Bottom-sheet open-height state.
 *
 * `cycle` is what the drag handle calls — it wraps back to peek so a user who
 * keeps tapping always gets back to the map. `expand` clamps at full instead,
 * for callers that must not accidentally close the sheet.
 */
import { useCallback, useState } from 'react';

export type Detent = 'peek' | 'half' | 'full';

const ORDER: Detent[] = ['peek', 'half', 'full'];

export function useSheetDetent() {
  const [detent, setDetent] = useState<Detent>('peek');

  const cycle = useCallback(() => {
    setDetent((prev) => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length]);
  }, []);

  const expand = useCallback(() => {
    setDetent((prev) => ORDER[Math.min(ORDER.indexOf(prev) + 1, ORDER.length - 1)]);
  }, []);

  const collapse = useCallback(() => setDetent('peek'), []);

  return { detent, cycle, expand, collapse, isOpen: detent !== 'peek' };
}

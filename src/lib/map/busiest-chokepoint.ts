/** Where the map should open: the chokepoint with the most ships moving right now. */
import { CHOKEPOINTS, type Chokepoint } from '@/lib/geo/chokepoints-constants';

export function busiestChokepoint(
  ships: Array<{ mmsi: string; lat: number; lon: number }>,
  isMoving: (mmsi: string) => boolean,
): { chokepoint: Chokepoint; moving: number } | null {
  let best: { chokepoint: Chokepoint; moving: number } | null = null;
  for (const cp of Object.values(CHOKEPOINTS)) {
    const b = cp.bounds;
    let moving = 0;
    for (const s of ships) {
      if (s.lat >= b.minLat && s.lat <= b.maxLat && s.lon >= b.minLon && s.lon <= b.maxLon && isMoving(s.mmsi)) moving++;
    }
    if (moving > 0 && (!best || moving > best.moving)) best = { chokepoint: cp, moving };
  }
  return best;
}

import { describe, expect, it } from 'vitest';
import { busiestChokepoint } from './busiest-chokepoint';

describe('busiestChokepoint', () => {
  it('picks the chokepoint with the most moving ships, not the most ships', () => {
    const ships = [
      ...Array.from({ length: 30 }, (_, k) => ({ mmsi: `h${k}`, lat: 25, lon: 56.5 })),     // Hormuz, all anchored
      ...Array.from({ length: 5 }, (_, k) => ({ mmsi: `s${k}`, lat: 30.5, lon: 32.4 })),     // Suez, all moving
    ];
    const r = busiestChokepoint(ships, (m) => m.startsWith('s'));
    expect(r?.chokepoint.id).toBe('suez');
    expect(r?.moving).toBe(5);
  });

  it('returns null when nothing is moving anywhere', () => {
    expect(busiestChokepoint([{ mmsi: 'a', lat: 25, lon: 56.5 }], () => false)).toBeNull();
  });
});

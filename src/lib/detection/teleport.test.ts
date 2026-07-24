/**
 * Teleport (Spoofed Position) Detection Tests
 *
 * Verifies the kinematic teleport detector flags physically impossible
 * implied speeds (>50 knots) and leaves normal transits untouched.
 */
import { describe, it, expect } from 'vitest';
import { detectTeleport, impliedSpeedKnots, type TimedPosition } from './teleport';

describe('impliedSpeedKnots', () => {
  it('returns 0 for non-positive time delta', () => {
    const a: TimedPosition = { lat: 25, lon: 55, time: new Date('2026-01-01T00:00:00Z') };
    const b: TimedPosition = { lat: 26, lon: 56, time: new Date('2026-01-01T00:00:00Z') };
    expect(impliedSpeedKnots(a, b)).toBe(0);
  });
});

describe('detectTeleport', () => {
  it('flags a >50kt implied-speed jump as spoofed_position', () => {
    // ~111 km north (1 deg latitude) in 6 minutes → ~600 kn implied speed
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
      { lat: 26.0, lon: 55.0, time: new Date('2026-01-01T00:06:00Z') },
    ];
    const result = detectTeleport(positions);
    expect(result).not.toBeNull();
    expect(result!.impliedSpeedKnots).toBeGreaterThan(50);
    expect(result!.from).toEqual({ lat: 25.0, lon: 55.0 });
    expect(result!.to).toEqual({ lat: 26.0, lon: 55.0 });
  });

  it('does not flag a normal 12kt transit', () => {
    // 12 kn for 1 hour ≈ 22.2 km ≈ 0.2 deg latitude
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
      { lat: 25.2, lon: 55.0, time: new Date('2026-01-01T01:00:00Z') },
    ];
    const result = detectTeleport(positions);
    expect(result).toBeNull();
  });

  it('returns null for fewer than two positions', () => {
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
    ];
    expect(detectTeleport(positions)).toBeNull();
  });

  it('reports the worst jump across multiple pairs', () => {
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
      { lat: 25.1, lon: 55.0, time: new Date('2026-01-01T00:30:00Z') }, // normal
      { lat: 30.0, lon: 55.0, time: new Date('2026-01-01T00:36:00Z') }, // teleport
    ];
    const result = detectTeleport(positions);
    expect(result).not.toBeNull();
    expect(result!.to).toEqual({ lat: 30.0, lon: 55.0 });
  });
});

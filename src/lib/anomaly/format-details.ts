/**
 * Format an anomaly's type-specific detail numbers into a short, human-readable line.
 *
 * The `details` JSONB shape varies by anomaly type (see src/types/anomaly.ts).
 * This helper reads the fields relevant to each type and returns a compact
 * terminal-style string (e.g. "Δ 42° off route", "gap 3h 20m").
 *
 * Defensive by design: missing/malformed fields are omitted, and an unknown
 * type or empty details returns null so callers can skip rendering.
 */
import type { AnomalyType } from '@/types/anomaly';

/** Format a minute count as "Xh Ym" (or "Ym" when under an hour). */
function formatGap(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatAnomalyDetails(
  type: AnomalyType,
  details: Record<string, unknown> | null | undefined
): string | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;

  switch (type) {
    case 'deviation': {
      const deg = d.deviationDegrees;
      if (typeof deg !== 'number') return null;
      const dest = typeof d.destination === 'string' && d.destination ? ` (${d.destination})` : '';
      return `Δ ${Math.round(deg)}° off route${dest}`;
    }
    case 'going_dark': {
      const gap = d.gapMinutes;
      if (typeof gap !== 'number') return null;
      const zone = typeof d.coverageZone === 'string' && d.coverageZone ? ` in ${d.coverageZone}` : '';
      return `gap ${formatGap(gap)}${zone}`;
    }
    case 'repeat_going_dark': {
      const count = d.goingDarkCount;
      if (typeof count !== 'number') return null;
      const window = typeof d.windowDays === 'number' ? ` in ${d.windowDays}d` : '';
      return `${count} dark events${window}`;
    }
    case 'sts_transfer': {
      const name = typeof d.otherName === 'string' && d.otherName ? d.otherName : null;
      const imo = typeof d.otherImo === 'string' && d.otherImo ? d.otherImo : null;
      const dist = typeof d.distanceKm === 'number' ? `${d.distanceKm.toFixed(2)} km` : null;
      const partner = name || (imo ? `IMO ${imo}` : null);
      if (!partner && !dist) return null;
      if (partner && dist) return `STS w/ ${partner} @ ${dist}`;
      if (partner) return `STS w/ ${partner}`;
      return `STS @ ${dist}`;
    }
    case 'spoofed_position': {
      const speed = d.impliedSpeedKnots;
      if (typeof speed !== 'number') return null;
      return `implied ${Math.round(speed)} kt (impossible)`;
    }
    case 'loitering': {
      const radius = typeof d.radiusKm === 'number' ? `${d.radiusKm.toFixed(1)} km radius` : null;
      const dur = typeof d.durationHours === 'number' ? `${d.durationHours.toFixed(1)}h` : null;
      if (radius && dur) return `${dur} within ${radius}`;
      if (dur) return dur;
      if (radius) return radius;
      return null;
    }
    case 'speed': {
      const kn = d.speedKnots;
      if (typeof kn !== 'number') return null;
      return `${kn.toFixed(1)} kn (drifting)`;
    }
    default:
      return null;
  }
}

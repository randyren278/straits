import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_COLOR_EXPRESSION,
  IDENTITY_STROKE_COLOR_EXPRESSION,
  freshnessOpacityExpression,
  FRESHNESS_STOPS,
  LEGEND_ACTIVITY,
  LEGEND_IDENTITY,
  ACTIVITY_COLORS,
  IDENTITY_COLORS,
  RECEDE_FACTOR,
} from './marker-style';

describe('marker vocabulary', () => {
  it('keeps activity (fill) and identity (outline) on separate channels', () => {
    // Fill never consults the sanctions fields; outline never consults anomaly fields.
    expect(JSON.stringify(ACTIVITY_COLOR_EXPRESSION)).not.toContain('isSanctioned');
    expect(JSON.stringify(ACTIVITY_COLOR_EXPRESSION)).not.toContain('sanctionRiskCategory');
    expect(JSON.stringify(IDENTITY_STROKE_COLOR_EXPRESSION)).not.toContain('anomalyType');
  });

  it('gives every legend swatch a color that the paint expression actually uses', () => {
    const fill = JSON.stringify(ACTIVITY_COLOR_EXPRESSION);
    for (const { color } of LEGEND_ACTIVITY) expect(fill).toContain(color);
    const stroke = JSON.stringify(IDENTITY_STROKE_COLOR_EXPRESSION);
    for (const { color } of LEGEND_IDENTITY) expect(stroke).toContain(color);
  });

  it('does not reuse one hue for two meanings inside a channel', () => {
    const activity = Object.values(ACTIVITY_COLORS);
    expect(new Set(activity).size).toBe(activity.length);
    const identity = Object.values(IDENTITY_COLORS);
    expect(new Set(identity).size).toBe(identity.length);
  });

  it('fades contacts as their fix ages, monotonically', () => {
    for (let i = 1; i < FRESHNESS_STOPS.length; i++) {
      expect(FRESHNESS_STOPS[i][0]).toBeGreaterThan(FRESHNESS_STOPS[i - 1][0]);
      expect(FRESHNESS_STOPS[i][1]).toBeLessThanOrEqual(FRESHNESS_STOPS[i - 1][1]);
    }
    expect(JSON.stringify(freshnessOpacityExpression(null))).toContain('ageHours');
  });

  it('recedes the field around a selected contact without touching the contact itself', () => {
    const expr = freshnessOpacityExpression('123456789') as unknown[];
    expect(expr[0]).toBe('case');
    expect(JSON.stringify(expr[1])).toContain('123456789');
    expect(expr[2]).toBe(1);
    expect(JSON.stringify(expr[3])).toContain(String(RECEDE_FACTOR));
  });
});

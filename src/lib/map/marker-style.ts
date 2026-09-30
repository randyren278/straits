/**
 * Marker vocabulary for the vessel layer — three independent channels.
 *
 *   fill    = ACTIVITY   what the contact is doing now (active anomaly)
 *   outline = IDENTITY   what lists it is on (sanctions / shadow / detained)
 *   opacity = FRESHNESS  how old the fix is
 *
 * Before this, red meant both "sanctioned" and "going dark confirmed", purple
 * meant both "shadow fleet" and "route deviation", and a six-day-old fix drew
 * exactly like one from a minute ago. Keeping the channels separate means a
 * sanctioned tanker that goes dark reads as red fill *and* red outline —
 * both facts visible, neither hiding the other.
 *
 * Client-safe. MapLibre expressions are plain JSON; MapLegend renders the same
 * constants so the legend can never drift from the paint.
 */
import type { ExpressionSpecification } from 'maplibre-gl';

export const ACTIVITY_COLORS = {
  goingDarkConfirmed: '#ef4444',
  goingDarkSuspected: '#eab308',
  loitering: '#f97316',
  stsTransfer: '#ec4899',
  speed: '#3b82f6',
  deviation: '#a855f7',
  spoofed: '#14b8a6',
  normal: '#8d939b',
} as const;

/** Ships at rest with nothing flagged: a quiet grey that darkens as tracking thins (matches the track-engine mockup). */
export const REST_GREYS = ['#b8bcc2', ACTIVITY_COLORS.normal, '#5d636b', '#6b7280'] as const;

export const IDENTITY_COLORS = {
  sanctioned: '#ef4444',
  shadowFleet: '#a855f7',
  detained: '#fb7185',
  listed: '#f59e0b',
  none: '#6b7280',
} as const;

/** Freshness stops: hours → opacity. Matches VESSEL_STALENESS_INTERVAL (7d). */
export const FRESHNESS_STOPS: ReadonlyArray<readonly [hours: number, opacity: number]> = [
  [0, 1],
  [1, 1],
  [24, 0.65],
  [72, 0.5],
  [168, 0.4],
];

/** How far the non-selected field recedes while a contact is locked. */
export const RECEDE_FACTOR = 0.45;

export const LEGEND_ACTIVITY: ReadonlyArray<{ label: string; color: string }> = [
  { label: 'Going dark · confirmed', color: ACTIVITY_COLORS.goingDarkConfirmed },
  { label: 'Going dark · suspected', color: ACTIVITY_COLORS.goingDarkSuspected },
  { label: 'Loitering', color: ACTIVITY_COLORS.loitering },
  { label: 'STS transfer', color: ACTIVITY_COLORS.stsTransfer },
  { label: 'Speed anomaly', color: ACTIVITY_COLORS.speed },
  { label: 'Route deviation', color: ACTIVITY_COLORS.deviation },
  { label: 'Spoofed position', color: ACTIVITY_COLORS.spoofed },
  { label: 'Normal traffic', color: ACTIVITY_COLORS.normal },
];

export const LEGEND_IDENTITY: ReadonlyArray<{ label: string; color: string }> = [
  { label: 'Sanctioned', color: IDENTITY_COLORS.sanctioned },
  { label: 'Shadow fleet', color: IDENTITY_COLORS.shadowFleet },
  { label: 'Detained (port state)', color: IDENTITY_COLORS.detained },
  { label: 'Listed · other', color: IDENTITY_COLORS.listed },
];

/** Fill: active anomaly type, else neutral. */
export const ACTIVITY_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['all', ['==', ['get', 'anomalyType'], 'going_dark'], ['==', ['get', 'anomalyConfidence'], 'confirmed']],
  ACTIVITY_COLORS.goingDarkConfirmed,
  ['==', ['get', 'anomalyType'], 'going_dark'],
  ACTIVITY_COLORS.goingDarkSuspected,
  ['==', ['get', 'anomalyType'], 'repeat_going_dark'],
  ACTIVITY_COLORS.goingDarkConfirmed,
  ['==', ['get', 'anomalyType'], 'loitering'],
  ACTIVITY_COLORS.loitering,
  ['==', ['get', 'anomalyType'], 'sts_transfer'],
  ACTIVITY_COLORS.stsTransfer,
  ['==', ['get', 'anomalyType'], 'speed'],
  ACTIVITY_COLORS.speed,
  ['==', ['get', 'anomalyType'], 'deviation'],
  ACTIVITY_COLORS.deviation,
  ['==', ['get', 'anomalyType'], 'spoofed_position'],
  ACTIVITY_COLORS.spoofed,
  ['match', ['coalesce', ['get', 'tier'], 0], 0, REST_GREYS[0], 2, REST_GREYS[2], 3, REST_GREYS[3], REST_GREYS[1]],
];

/** Outline: list membership. None when the vessel is on no list. */
export const IDENTITY_STROKE_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['!=', ['get', 'isSanctioned'], true],
  IDENTITY_COLORS.none,
  ['==', ['get', 'sanctionRiskCategory'], 'sanction'],
  IDENTITY_COLORS.sanctioned,
  ['==', ['get', 'sanctionRiskCategory'], 'mare.shadow;poi'],
  IDENTITY_COLORS.shadowFleet,
  ['any',
    ['==', ['get', 'sanctionRiskCategory'], 'mare.detained'],
    ['==', ['get', 'sanctionRiskCategory'], 'mare.detained;reg.warn'],
  ],
  IDENTITY_COLORS.detained,
  IDENTITY_COLORS.listed,
];

export const IDENTITY_STROKE_WIDTH_EXPRESSION: ExpressionSpecification = [
  'case',
  ['==', ['get', 'isSanctioned'], true],
  1.5,
  0,
];

/**
 * Dot radius: DOT_RADIUS px × tracking-tier size, scaling ×0.8 → ×1.9 with zoom (√2 per zoom
 * level), the same curve the motion overlay uses for chevrons. Untracked ships stay readable:
 * they are data, just older.
 */
export const DOT_RADIUS = 2.8;
export const DOT_TIER_SIZE = [1.25, 1, 0.85, 0.8] as const;
const TIER_SIZE: ExpressionSpecification = ['match', ['coalesce', ['get', 'tier'], 0], 0, DOT_TIER_SIZE[0], 1, DOT_TIER_SIZE[1], 2, DOT_TIER_SIZE[2], DOT_TIER_SIZE[3]];
export const VESSEL_RADIUS_EXPRESSION: ExpressionSpecification = [
  'interpolate', ['exponential', Math.SQRT2], ['zoom'],
  7.36, ['*', DOT_RADIUS * 0.8, TIER_SIZE],
  9.85, ['*', DOT_RADIUS * 1.9, TIER_SIZE],
];

/**
 * Opacity from fix age, and — while a contact is selected — the rest of the
 * field recedes by RECEDE_FACTOR so the acquired contact reads first.
 */
export function freshnessOpacityExpression(selectedMmsi: string | null): ExpressionSpecification {
  const freshness: ExpressionSpecification = [
    'interpolate', ['linear'],
    ['coalesce', ['get', 'ageHours'], 0],
    ...FRESHNESS_STOPS.flatMap(([h, o]) => [h, o]),
  ];
  if (!selectedMmsi) return freshness;
  return [
    'case',
    ['==', ['get', 'mmsi'], selectedMmsi],
    1,
    ['*', freshness, RECEDE_FACTOR],
  ];
}

/** Tracking-quality dimming: well tracked 1, tracked 0.85, sparse 0.7, untracked (no fix in 24 h) 0.75 × fix age. */
const TIER_FACTOR: ExpressionSpecification = ['match', ['coalesce', ['get', 'tier'], 0], 0, 1, 1, 0.85, 2, 0.7, 0.75];

/**
 * Dot opacity = freshness × tracking tier, and at wide zoom ships at rest recede to 70%
 * under the motion overlay's glow (the zoom interpolation must be the top-level expression).
 */
export function vesselOpacityExpression(selectedMmsi: string | null): ExpressionSpecification {
  const base: ExpressionSpecification = ['*', TIER_FACTOR, freshnessOpacityExpression(selectedMmsi)];
  return ['interpolate', ['linear'], ['zoom'], 8.2, ['*', 0.7, base], 9.2, base];
}

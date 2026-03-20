/**
 * AnomalyMatrix — Terminal-style heatmap grid (M007-S02)
 *
 * Renders a dense 3×6 grid showing anomaly counts at the intersection
 * of Ship Type (rows) × Anomaly Type (columns). Cell brightness scales
 * by count using pre-defined Tailwind classes.
 *
 * Bloomberg aesthetic: bg-black, amber accents, font-mono, sharp corners.
 */

import type { Anomaly, AnomalyType, ShipCategory } from '@/types/anomaly';

/** Column order — matches the 6 canonical anomaly types */
const COLUMN_ORDER: AnomalyType[] = [
  'going_dark',
  'loitering',
  'deviation',
  'speed',
  'repeat_going_dark',
  'sts_transfer',
];

/** Abbreviated column headers for the terminal grid */
const SHORT_LABELS: Record<AnomalyType, string> = {
  going_dark: 'DARK',
  loitering: 'LOITER',
  deviation: 'ROUTE',
  speed: 'DRIFT',
  repeat_going_dark: 'REPEAT',
  sts_transfer: 'STS',
};

/** Row order — ship categories */
const ROW_ORDER: ShipCategory[] = ['tanker', 'cargo', 'other'];

/** Display labels for ship category rows */
const ROW_LABELS: Record<ShipCategory, string> = {
  tanker: 'TANKER',
  cargo: 'CARGO',
  other: 'OTHER',
};

/**
 * Pre-defined Tailwind brightness tiers for cell backgrounds.
 * Selected by count thresholds — NEVER dynamically concatenated.
 * Tailwind v4 scanner requires these to be static string literals.
 */
const BRIGHTNESS_TIERS = [
  { min: 0, max: 0, className: 'bg-amber-500/5' },
  { min: 1, max: 2, className: 'bg-amber-500/15' },
  { min: 3, max: 5, className: 'bg-amber-500/30' },
  { min: 6, max: 9, className: 'bg-amber-500/50' },
  { min: 10, max: Infinity, className: 'bg-amber-500/80' },
] as const;

/** Select the brightness tier class for a given count */
function getBrightnessTier(count: number): string {
  for (const tier of BRIGHTNESS_TIERS) {
    if (count >= tier.min && count <= tier.max) {
      return tier.className;
    }
  }
  return BRIGHTNESS_TIERS[0].className;
}

interface AnomalyMatrixProps {
  anomalies: Anomaly[];
}

export function AnomalyMatrix({ anomalies }: AnomalyMatrixProps) {
  if (anomalies.length === 0) {
    return null;
  }

  // Aggregate counts: key = "shipCategory-anomalyType" → count
  const counts = new Map<string, number>();
  for (const anomaly of anomalies) {
    const category: ShipCategory = anomaly.shipCategory ?? 'other';
    const key = `${category}-${anomaly.anomalyType}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  /** Get the count for a given cell */
  const getCount = (row: ShipCategory, col: AnomalyType): number =>
    counts.get(`${row}-${col}`) ?? 0;

  return (
    <div data-testid="anomaly-matrix">
      <table className="w-full font-mono text-xs uppercase border-collapse">
        {/* Title row */}
        <caption className="text-left text-amber-500/60 text-[10px] tracking-widest mb-1">
          ANOMALY MATRIX
        </caption>
        <thead>
          <tr>
            {/* Empty top-left cell */}
            <th className="text-left text-gray-600 py-1 pr-3 font-normal" />
            {COLUMN_ORDER.map((col) => (
              <th
                key={col}
                className="text-center text-amber-500/50 py-1 px-1.5 font-normal tracking-wider"
              >
                {SHORT_LABELS[col]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_ORDER.map((row) => (
            <tr key={row}>
              <td className="text-left text-amber-500/50 py-1 pr-3 whitespace-nowrap">
                {ROW_LABELS[row]}
              </td>
              {COLUMN_ORDER.map((col) => {
                const count = getCount(row, col);
                const tierClass = getBrightnessTier(count);
                return (
                  <td
                    key={col}
                    className={`text-center text-amber-500 py-1 px-1.5 ${tierClass}`}
                  >
                    {count}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

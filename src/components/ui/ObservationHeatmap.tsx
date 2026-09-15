'use client';

/**
 * Observation heatmap — a contribution-chart view of the collection record.
 *
 * Every cell is one hour of one region. Amber intensity is contacts observed
 * that hour relative to the region's own busiest hour in the window (a region
 * is compared with itself, never with Suez). Two kinds of dark cell are kept
 * apart on purpose: "attempted, nothing heard" (a zero row exists) and "not
 * attempted" (no row — the harvester never ran), because only the second one
 * is our fault.
 *
 * Pure: takes hourly buckets, draws an SVG. Layouts:
 *   strip  — one row per region, hours left→right (24 h in the header, 7 d under a chart)
 *   weeks  — one region, days as rows × 24 hourly columns (the rail panel)
 */
import type { HourlyBucket } from '@/lib/db/coverage';

export interface HeatRow {
  id: string;
  label: string;
  hours: HourlyBucket[];
}

const AMBER = ['#3b2a08', '#7a5511', '#b8830f', '#f59e0b'];
const ATTEMPTED_EMPTY = '#1f2937';
const NOT_ATTEMPTED = '#0b0b0b';

export function fillHours(hours: HourlyBucket[], windowHours: number, now: Date): (HourlyBucket | null)[] {
  const end = new Date(now); end.setUTCMinutes(0, 0, 0);
  const byHour = new Map(hours.map((h) => [h.hour, h]));
  const out: (HourlyBucket | null)[] = [];
  for (let i = windowHours - 1; i >= 0; i--) {
    const t = new Date(end.getTime() - i * 3_600_000).toISOString();
    out.push(byHour.get(t) ?? null);
  }
  return out;
}

export function cellColor(cell: HourlyBucket | null, peak: number): string {
  if (!cell || cell.attempted === 0) return NOT_ATTEMPTED;
  if (cell.unique === 0) return ATTEMPTED_EMPTY;
  const ratio = peak > 0 ? cell.unique / peak : 1;
  return AMBER[Math.min(AMBER.length - 1, Math.floor(ratio * AMBER.length))];
}

export function cellTitle(label: string, cell: HourlyBucket | null, hourIso: string): string {
  const when = `${hourIso.slice(0, 10)} ${hourIso.slice(11, 16)}Z`;
  if (!cell || cell.attempted === 0) return `${label} · ${when} · not attempted (harvester did not run)`;
  if (cell.unique === 0) return `${label} · ${when} · attempted ${cell.attempted}×, nothing heard`;
  return `${label} · ${when} · ${cell.unique} contacts (aisstream ${cell.aisstream} · fallback ${cell.fallback}) · ${cell.attempted} windows`;
}

interface StripProps {
  rows: HeatRow[];
  windowHours: number;
  now?: Date;
  cell?: number;
  gap?: number;
  showLabels?: boolean;
  testId?: string;
}

export function ObservationStrip({ rows, windowHours, now = new Date(), cell = 9, gap = 2, showLabels = true, testId = 'observation-strip' }: StripProps) {
  const labelW = showLabels ? 46 : 0;
  const width = labelW + windowHours * (cell + gap);
  const height = rows.length * (cell + gap);
  const end = new Date(now); end.setUTCMinutes(0, 0, 0);
  return (
    <svg
      data-testid={testId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Observation record, last ${windowHours} hours, ${rows.length} regions`}
      className="block"
    >
      {rows.map((row, r) => {
        const filled = fillHours(row.hours, windowHours, now);
        const peak = Math.max(0, ...row.hours.map((h) => h.unique));
        const y = r * (cell + gap);
        return (
          <g key={row.id} data-testid={`heat-row-${row.id}`}>
            {showLabels && (
              <text x={0} y={y + cell - 1} fontSize={8} fill="#6b7280" fontFamily="var(--font-jetbrains), ui-monospace, monospace" letterSpacing=".06em">
                {row.label.toUpperCase()}
              </text>
            )}
            {filled.map((c, i) => {
              const hourIso = new Date(end.getTime() - (windowHours - 1 - i) * 3_600_000).toISOString();
              return (
                <rect
                  key={hourIso}
                  x={labelW + i * (cell + gap)}
                  y={y}
                  width={cell}
                  height={cell}
                  fill={cellColor(c, peak)}
                  stroke={!c || c.attempted === 0 ? '#1f2937' : undefined}
                  strokeWidth={!c || c.attempted === 0 ? 0.5 : undefined}
                  data-unique={c?.unique ?? -1}
                >
                  <title>{cellTitle(row.label, c, hourIso)}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

interface WeeksProps {
  row: HeatRow;
  days?: number;
  now?: Date;
  cell?: number;
  gap?: number;
}

/** One region, days as rows (newest at the bottom) × 24 hourly columns — fits a 320px rail. */
export function ObservationWeeks({ row, days = 7, now = new Date(), cell = 9, gap = 2 }: WeeksProps) {
  const windowHours = days * 24;
  const filled = fillHours(row.hours, windowHours, now);
  const peak = Math.max(0, ...row.hours.map((h) => h.unique));
  const end = new Date(now); end.setUTCMinutes(0, 0, 0);
  const labelW = 34;
  const top = 12;
  const step = cell + gap;
  const width = labelW + 24 * step;
  const height = top + days * step;
  const mono = 'var(--font-jetbrains), ui-monospace, monospace';
  // Row r holds the UTC day that is (days-1-r) days before the current hour's day.
  const dayStart = (r: number) => {
    const d = new Date(end); d.setUTCHours(0, 0, 0, 0);
    return new Date(d.getTime() - (days - 1 - r) * 86_400_000);
  };
  return (
    <svg data-testid={`observation-weeks-${row.id}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${row.label} observation record, last ${days} days by hour`} className="block">
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={labelW + h * step} y={top - 4} fontSize={8} fill="#6b7280" fontFamily={mono}>{String(h).padStart(2, '0')}Z</text>
      ))}
      {Array.from({ length: days }, (_, r) => (
        <text key={r} x={0} y={top + r * step + cell - 1} fontSize={8} fill="#6b7280" fontFamily={mono}>
          {dayStart(r).toISOString().slice(5, 10).replace('-', '/')}
        </text>
      ))}
      {filled.map((c, i) => {
        const hourIso = new Date(end.getTime() - (windowHours - 1 - i) * 3_600_000).toISOString();
        const d = new Date(hourIso);
        const hour = d.getUTCHours();
        const dayMs = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).getTime();
        const r = days - 1 - Math.round((dayStart(days - 1).getTime() - dayMs) / 86_400_000);
        if (r < 0) return null;
        const notAttempted = !c || c.attempted === 0;
        return (
          <rect key={hourIso} x={labelW + hour * step} y={top + r * step} width={cell} height={cell} fill={cellColor(c, peak)} stroke={notAttempted ? '#1f2937' : undefined} strokeWidth={notAttempted ? 0.5 : undefined} data-day={r} data-unique={c?.unique ?? -1}>
            <title>{cellTitle(row.label, c, hourIso)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-2 text-[9px] font-mono text-gray-500 uppercase tracking-wider">
      <span>less</span>
      {[NOT_ATTEMPTED, ATTEMPTED_EMPTY, ...AMBER].map((c) => (
        <span key={c} className="inline-block w-2 h-2" style={{ backgroundColor: c, outline: c === NOT_ATTEMPTED ? '1px solid #1f2937' : undefined }} />
      ))}
      <span>more</span>
      <span className="ml-2 normal-case tracking-normal text-gray-600">black = not attempted · grey = heard nothing</span>
    </div>
  );
}

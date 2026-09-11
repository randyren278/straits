/**
 * TrafficChart Component (HIST-01)
 *
 * Full-width chart displaying vessel traffic volume with optional oil price overlay.
 * Uses Recharts ComposedChart with dual Y-axis for independent scaling.
 */
'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TrafficWithPrices, TrafficCoverage, TimeRange } from '@/types/analytics';

/** An honest empty state: what is missing, what exists, and a way to get to it. */
export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface TrafficChartProps {
  /** Chart data with optional oil price overlay */
  data: TrafficWithPrices[];
  /** Chart title */
  title?: string;
  /** Whether to show oil price line */
  showPrice?: boolean;
  /** Oil price symbol label (WTI or BRENT) */
  priceLabel?: string;
  /** Chart height in pixels */
  height?: number;
  /** Coverage summary used to explain an empty chart. */
  coverage?: TrafficCoverage | null;
  /** The range the user asked for (for the empty-state copy). */
  range?: TimeRange;
  /** Optional action offered from the empty state (e.g. switch to a populated range). */
  action?: EmptyStateAction | null;
}

/**
 * Build the empty-state copy from what we know about coverage. Pure, so the
 * three cases — no history at all, history outside the range, history that the
 * ship-type filter removed — are testable without a chart.
 */
export function describeEmptyTraffic(
  coverage: TrafficCoverage | null | undefined,
  range: TimeRange | undefined,
): { headline: string; detail: string; suggestedRange: TimeRange | null } {
  const rangeLabel = range ? `the last ${range.replace('d', ' days')}` : 'the selected range';
  if (!coverage || coverage.observedDays === 0) {
    return {
      headline: `No observations in ${rangeLabel}`,
      detail: `No AIS fixes have been recorded in this zone for the last ${coverage?.lookbackDays ?? 90} days. Either the zone is outside monitored coverage or the feed was down for the whole window.`,
      suggestedRange: null,
    };
  }
  const span = coverage.firstObservation === coverage.lastObservation
    ? coverage.firstObservation
    : `${coverage.firstObservation} → ${coverage.lastObservation}`;
  // Pick the smallest range that reaches back to the first observed day.
  const ageDays = coverage.firstObservation
    ? Math.ceil((Date.now() - new Date(coverage.firstObservation).getTime()) / 86_400_000)
    : null;
  const suggestedRange: TimeRange | null =
    ageDays === null ? null : ageDays <= 7 ? '7d' : ageDays <= 30 ? '30d' : '90d';
  return {
    headline: `No observations in ${rangeLabel}`,
    detail: `Observations exist on ${coverage.observedDays} day${coverage.observedDays === 1 ? '' : 's'} (${span}). The current ship-type filter or range may be hiding them.`,
    suggestedRange: suggestedRange === range ? null : suggestedRange,
  };
}

// Chart color palette (consistent with dashboard dark theme)
const COLORS = {
  vesselCount: '#6b7280',    // Gray for all vessels
  tankerCount: '#f59e0b',    // Amber for tankers
  oilPrice: '#22c55e',       // Green for oil price
  grid: '#374151',           // Gray grid lines
  axis: '#9ca3af',           // Light gray axis labels
};

// JetBrains Mono for all Recharts SVG text (axes, legend, tooltip) to match the terminal aesthetic.
const MONO = 'var(--font-jetbrains), ui-monospace, monospace';

/**
 * Format date for X-axis labels (MMM DD)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrafficChart({
  data,
  title,
  showPrice = true,
  priceLabel = 'WTI',
  height = 400,
  coverage,
  range,
  action,
}: TrafficChartProps) {
  if (!data.length) {
    const empty = describeEmptyTraffic(coverage, range);
    return (
      <div
        data-testid="traffic-empty"
        className="flex flex-col items-center justify-center gap-2 bg-black border border-amber-500/20 px-6 text-center"
        style={{ height: Math.min(height, 220) }}
        role="status"
      >
        {title && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/70">{title}</span>
        )}
        <p className="text-gray-200 font-mono text-sm">{empty.headline}</p>
        <p className="text-gray-400 text-xs max-w-md leading-relaxed">{empty.detail}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1 border border-amber-500/60 text-amber-500 text-xs font-mono uppercase tracking-wider px-3 py-1.5 hover:bg-amber-500/10"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-black p-4 border border-amber-500/20" role="img" aria-label={title || 'Vessel traffic chart'}>
      {title && (
        <h3 className="text-xs font-mono uppercase tracking-widest text-amber-500 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="date"
            stroke={COLORS.axis}
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fontFamily: MONO }}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            width={36}
            stroke={COLORS.axis}
            tick={{ fontSize: 10, fontFamily: MONO }}
          />
          {showPrice && (
            <YAxis
              yAxisId="right"
              orientation="right"
              width={36}
              stroke={COLORS.axis}
              tick={{ fontSize: 10, fontFamily: MONO }}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#000000',
              border: '1px solid #374151',
              borderRadius: '0',
              fontFamily: MONO,
              fontSize: 11,
            }}
            labelFormatter={(label) => formatDate(String(label))}
          />
          <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="vesselCount"
            name="All Vessels"
            fill={COLORS.vesselCount}
            fillOpacity={0.2}
            stroke={COLORS.vesselCount}
            strokeWidth={2}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="tankerCount"
            name="Tankers"
            fill={COLORS.tankerCount}
            fillOpacity={0.4}
            stroke={COLORS.tankerCount}
            strokeWidth={2}
          />
          {showPrice && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="oilPrice"
              name={`${priceLabel} Price`}
              stroke={COLORS.oilPrice}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

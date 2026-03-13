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
import type { TrafficWithPrices } from '@/types/analytics';

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
}

// Chart color palette (consistent with dashboard dark theme)
const COLORS = {
  vesselCount: '#6b7280',    // Gray for all vessels
  tankerCount: '#f59e0b',    // Amber for tankers
  oilPrice: '#22c55e',       // Green for oil price
  grid: '#374151',           // Gray grid lines
  axis: '#9ca3af',           // Light gray axis labels
};

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
}: TrafficChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center bg-black"
        style={{ height }}
      >
        <p className="text-gray-400">No data available for selected range</p>
      </div>
    );
  }

  return (
    <div className="bg-black p-4">
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="date"
            stroke={COLORS.axis}
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            stroke={COLORS.axis}
            tick={{ fontSize: 12 }}
            label={{
              value: 'Vessels',
              angle: -90,
              position: 'insideLeft',
              fill: COLORS.axis,
              fontSize: 12,
            }}
          />
          {showPrice && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={COLORS.axis}
              tick={{ fontSize: 12 }}
              label={{
                value: `${priceLabel} (USD)`,
                angle: 90,
                position: 'insideRight',
                fill: COLORS.axis,
                fontSize: 12,
              }}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#000000',
              border: '1px solid #374151',
              borderRadius: '0',
            }}
            labelFormatter={(label) => formatDate(String(label))}
          />
          <Legend />
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

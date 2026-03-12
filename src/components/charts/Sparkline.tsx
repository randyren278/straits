/**
 * Sparkline Chart Component
 * Renders a small, inline area chart for displaying price trends.
 * Uses recharts for responsive SVG rendering.
 */
'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  /**
   * Data points for the chart. Each point must have a 'value' property.
   */
  data: { value: number }[];
  /**
   * Stroke and fill color for the area chart.
   * @default '#f59e0b' (amber)
   */
  color?: string;
  /**
   * Height of the chart in pixels.
   * @default 40
   */
  height?: number;
}

/**
 * Compact sparkline chart for inline price trend visualization.
 * Renders an area chart without axes or labels.
 */
export function Sparkline({ data, color = '#f59e0b', height = 40 }: SparklineProps) {
  if (!data.length) return <div style={{ height }} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

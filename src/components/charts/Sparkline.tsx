/**
 * Sparkline Chart Component
 * Renders a small, inline area chart for displaying price trends.
 * A tiny SVG keeps charting code out of the dashboard's first-load bundle.
 */
'use client';

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

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values.map((value, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 36 - ((value - min) / range) * 32;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const area = `M ${points.join(' L ')} L 100,40 L 0,40 Z`;

  return (
    <svg width="100%" height={height} viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Price trend sparkline">
      <path d={area} fill={color} fillOpacity={0.2} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

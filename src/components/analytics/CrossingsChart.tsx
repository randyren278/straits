'use client';

/**
 * Suez — observed crossings. Stacked daily bars from chokepoint_daily; a bar
 * click loads the voyages behind it. Styled to match TrafficChart exactly
 * (grid #374151, axis #9ca3af, tooltip border #374151, radius 0).
 *
 * The count is of contacts observed passing both gates — not cargo, not the
 * canal authority's transit ledger — and the card says so in its subtitle.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { DailyCrossingCounts } from '@/lib/analytics/crossings';

const MONO = 'var(--font-jetbrains), ui-monospace, monospace';
const COLORS = {
  northbound: '#f59e0b',
  southbound: '#c98a1a',
  waiting: '#4b5563',
  incomplete: '#1f2937',
  grid: '#374151',
  axis: '#9ca3af',
};

export const SPARSE_SAMPLING_THRESHOLD = 0.5;
export const SPARSE_SAMPLING_COPY = 'Sampling too sparse for most transits — most gate entries never see the far gate. Read completes as a floor, not a total.';

interface CrossingsChartProps {
  days: DailyCrossingCounts[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  /** incomplete ÷ (complete + incomplete) over the range, from the API. */
  incompleteRatio: number | null;
  height?: number;
}

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function CrossingsChart({ days, selectedDay, onSelectDay, incompleteRatio, height = 260 }: CrossingsChartProps) {
  const sparse = incompleteRatio !== null && incompleteRatio > SPARSE_SAMPLING_THRESHOLD;
  return (
    <div className="bg-black p-4 border border-amber-500/20" data-testid="crossings-card">
      <h3 className="text-xs font-mono uppercase tracking-widest text-amber-500">Suez — observed crossings</h3>
      <p className="text-[11px] text-gray-500 mt-1 mb-3">
        contacts observed passing both gates — not cargo, not canal-authority transit counts
      </p>
      {sparse && (
        <p data-testid="crossings-sparse" className="text-[11px] font-mono text-yellow-300 border-l-2 border-yellow-300/60 pl-2 mb-3">
          {SPARSE_SAMPLING_COPY} ({Math.round(incompleteRatio * 100)}% incomplete)
        </p>
      )}
      {days.length === 0 ? (
        <div data-testid="crossings-empty" className="flex items-center justify-center text-gray-400 text-xs font-mono" style={{ height: 120 }}>
          No crossing aggregates yet for this range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={days} onClick={(state) => { const d = state?.activeLabel; if (typeof d === 'string') onSelectDay(d); }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis dataKey="day" stroke={COLORS.axis} tickFormatter={formatDate} tick={{ fontSize: 10, fontFamily: MONO }} />
            <YAxis width={36} stroke={COLORS.axis} tick={{ fontSize: 10, fontFamily: MONO }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(245,158,11,0.08)' }}
              contentStyle={{ backgroundColor: '#000000', border: '1px solid #374151', borderRadius: '0', fontFamily: MONO, fontSize: 11 }}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
            {(['northbound', 'southbound', 'waiting', 'incomplete'] as const).map((key) => (
              <Bar key={key} dataKey={key} name={key} stackId="d" fill={COLORS[key]} stroke={key === 'incomplete' ? COLORS.waiting : undefined} strokeDasharray={key === 'incomplete' ? '3 2' : undefined} cursor="pointer">
                {days.map((d) => (
                  <Cell key={d.day} opacity={selectedDay && selectedDay !== d.day ? 0.45 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      {days.length > 0 && (
        // One button per day mirrors the bars for keyboard users and for the DOM
        // verification script — Recharts SVG cells carry no stable ids.
        <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label="Select a day">
          {days.map((d) => (
            <button
              key={d.day}
              type="button"
              data-testid={`crossing-bar-${d.day}`}
              aria-pressed={selectedDay === d.day}
              onClick={() => onSelectDay(d.day)}
              className={`text-[10px] font-mono px-2 py-1 border ${selectedDay === d.day ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-gray-700 text-gray-400 hover:bg-amber-500/5'}`}
            >
              {formatDate(d.day)} · {d.northbound + d.southbound}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

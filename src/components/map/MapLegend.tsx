'use client';

/**
 * Compact, expandable map legend.
 *
 * Reads the same constants the vessel layer paints with (marker-style.ts),
 * so it cannot drift from the map. Collapsed it is one 44px chip; expanded it
 * explains the three channels — fill (activity), outline (identity), opacity
 * (freshness) — plus the chokepoint and coverage overlays.
 */
import { useState } from 'react';
import { LEGEND_ACTIVITY, LEGEND_IDENTITY, FRESHNESS_STOPS, ACTIVITY_COLORS, IDENTITY_COLORS } from '@/lib/map/marker-style';

function Dot({ fill, stroke, opacity = 1 }: { fill: string; stroke: string; opacity?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-3 h-3 rounded-full shrink-0"
      style={{ backgroundColor: fill, boxShadow: `0 0 0 1.5px ${stroke}`, opacity }}
    />
  );
}

export function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div data-testid="map-legend" className="absolute left-3 bottom-3 z-20 phone:bottom-[calc(var(--straits-nav-h)+100px)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="straits-map-legend"
        className="min-h-[44px] px-2.5 bg-black/85 border border-amber-500/30 text-[10px] font-mono uppercase tracking-widest text-amber-500 hover:bg-amber-500/10 flex items-center gap-2"
      >
        <span className="flex items-center gap-1" aria-hidden="true">
          <Dot fill={ACTIVITY_COLORS.normal} stroke={IDENTITY_COLORS.none} />
          <Dot fill={ACTIVITY_COLORS.goingDarkConfirmed} stroke={IDENTITY_COLORS.sanctioned} />
        </span>
        Legend
        <span className="text-amber-500/60">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div
          id="straits-map-legend"
          className="mt-1 w-[248px] max-h-[60dvh] overflow-y-auto bg-black/92 border border-amber-500/30 p-3 text-[11px] font-mono text-gray-300 space-y-3"
        >
          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-amber-500 mb-1.5">Fill · activity</h3>
            <ul className="space-y-1">
              {LEGEND_ACTIVITY.map(({ label, color }) => (
                <li key={label} className="flex items-center gap-2">
                  <Dot fill={color} stroke={IDENTITY_COLORS.none} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-amber-500 mb-1.5">Outline · identity</h3>
            <ul className="space-y-1">
              {LEGEND_IDENTITY.map(({ label, color }) => (
                <li key={label} className="flex items-center gap-2">
                  <Dot fill={ACTIVITY_COLORS.normal} stroke={color} />
                  <span>{label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <Dot fill={ACTIVITY_COLORS.normal} stroke={IDENTITY_COLORS.none} />
                <span className="text-gray-500">Not on any list</span>
              </li>
            </ul>
            <p className="mt-1.5 text-[10px] text-gray-500 leading-snug">
              Fill and outline are independent: a sanctioned hull that goes dark shows both.
            </p>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-amber-500 mb-1.5">Opacity · fix age</h3>
            <ul className="flex items-center gap-3">
              {FRESHNESS_STOPS.filter(([h]) => h > 0).map(([hours, opacity]) => (
                <li key={hours} className="flex flex-col items-center gap-0.5">
                  <Dot fill={ACTIVITY_COLORS.normal} stroke={IDENTITY_COLORS.none} opacity={opacity} />
                  <span className="text-[9px] text-gray-500">{hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10px] text-gray-500 leading-snug">
              Faded contacts are last-known positions, not live ones. Select one to see its observation time.
            </p>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-amber-500 mb-1.5">Overlays</h3>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-4 h-2.5 border border-dashed border-amber-500/70 bg-amber-500/10" />
                <span>Chokepoint zone</span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-4 h-2.5 border border-dotted border-amber-500/40" />
                <span>Monitored coverage</span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-3 h-3 rounded-full border border-amber-500 bg-amber-500/10" />
                <span>Selected contact</span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-4 h-0.5 bg-amber-500" />
                <span>24h track</span>
              </li>
            </ul>
            <p className="mt-1.5 text-[10px] text-gray-500 leading-snug">
              Empty sea outside the coverage outline means unwatched, not empty.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

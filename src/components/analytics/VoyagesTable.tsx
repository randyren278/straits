'use client';

/**
 * The voyages behind one day's bar. Every counted crossing is a row; an
 * incomplete one says why. When the day's raw positions are already pruned
 * the table says so instead of pretending the aggregate has no support.
 */
import type { VoyageRow } from '@/app/api/chokepoints/[id]/crossings/route';

interface VoyagesTableProps {
  day: string | null;
  voyages: VoyageRow[] | null;
  reason: string | null;
  loading?: boolean;
}

const hhmm = (iso: string) => new Date(iso).toISOString().slice(11, 16);
const duration = (min: number | null) => (min === null ? '—' : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}m`);
const ROUTE: Record<VoyageRow['direction'], string> = { southbound: 'Port Said → Suez', northbound: 'Suez → Port Said' };

export function VoyagesTable({ day, voyages, reason, loading = false }: VoyagesTableProps) {
  return (
    <div className="bg-black border border-t-0 border-amber-500/20" data-testid="voyages-table">
      <div className="px-4 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest text-amber-500">
          Voyages counted{day ? ` — ${day}` : ''}
        </span>
        {voyages && <span className="text-[10px] font-mono text-gray-500" data-testid="voyages-count">{voyages.length} rows</span>}
      </div>
      {!day && <p className="px-4 py-3 text-xs text-gray-500 font-mono">Select a day to see the contacts behind its bar.</p>}
      {day && loading && <p className="px-4 py-3 text-xs text-gray-500 font-mono">loading…</p>}
      {day && !loading && voyages === null && (
        <p className="px-4 py-3 text-xs text-gray-400 font-mono" data-testid="voyages-pruned">
          {reason === 'raw positions pruned'
            ? 'raw positions for this day are pruned — daily totals retained'
            : reason ?? 'no voyage detail available'}
        </p>
      )}
      {day && !loading && voyages && voyages.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-500 font-mono">No gate entries observed on this day.</p>
      )}
      {day && !loading && voyages && voyages.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-xs font-normal uppercase tracking-widest text-amber-500">
                <th className="text-left px-4 py-2 font-normal">MMSI</th>
                <th className="text-left px-4 py-2 font-normal">Route</th>
                <th className="text-left px-4 py-2 font-normal">Gate in</th>
                <th className="text-left px-4 py-2 font-normal">Gate out</th>
                <th className="text-left px-4 py-2 font-normal">Duration</th>
                <th className="text-left px-4 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {voyages.map((v, i) => (
                <tr key={`${v.mmsi}-${v.gateInAt}-${i}`} data-testid="voyage-row" className="border-t border-amber-500/10 hover:bg-amber-500/5">
                  <td className="px-4 py-2 text-gray-200">{v.mmsi}</td>
                  <td className="px-4 py-2 text-gray-300">{v.status === 'waiting' ? `waiting (${v.direction})` : ROUTE[v.direction]}</td>
                  <td className="px-4 py-2 text-gray-400">{hhmm(v.gateInAt)}</td>
                  <td className="px-4 py-2 text-gray-400">{v.gateOutAt ? hhmm(v.gateOutAt) : '—'}</td>
                  <td className="px-4 py-2 text-gray-400">{duration(v.durationMinutes)}</td>
                  <td className={`px-4 py-2 ${v.status === 'complete' ? 'text-green-400' : v.status === 'waiting' ? 'text-gray-400' : 'text-yellow-300'}`}>
                    {v.status}{v.reason ? ` · ${v.reason}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

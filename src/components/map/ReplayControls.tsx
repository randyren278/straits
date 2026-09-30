'use client';
/**
 * Rewind: a "Replay 24h" pill on the map that becomes a time rail — play/pause, the replay
 * clock, a scrubber over the last 24 h (plus the hour of live estimates after the last
 * harvest), playback speed and a way back to live. Esc returns to live.
 */
import { useEffect } from 'react';
import { History, Pause, Play, Radio } from 'lucide-react';
import { REPLAY_SPEEDS, useReplayStore } from '@/stores/replay';

const clock = (tMin: number) => new Date(tMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const ago = (min: number) => {
  const m = Math.round(Math.abs(min)), h = Math.floor(m / 60), r = m % 60;
  return `${min < 0 ? '−' : '+'}${h ? `${h}h ` : ''}${String(r).padStart(h ? 2 : 1, '0')}m`;
};

export function ReplayControls() {
  const { active, status, playing, t, speed, data, enter, exit, setPlaying, seek, setSpeed } = useReplayStore();

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, exit]);

  if (!active || !data) {
    return (
      <button
        type="button"
        data-testid="replay-open"
        onClick={() => void enter()}
        disabled={status === 'loading'}
        className="absolute z-20 right-3 bottom-3 phone:bottom-[calc(var(--straits-nav-h)+100px)] desk:right-auto desk:left-1/2 desk:-translate-x-1/2 min-h-[44px] px-3 bg-black/85 border border-amber-500/50 text-[11px] font-mono uppercase tracking-widest text-amber-500 hover:bg-amber-500/10 flex items-center gap-2 disabled:opacity-60"
      >
        <History className="w-4 h-4" />
        {status === 'loading' ? 'Loading 24h…' : status === 'error' ? 'Replay unavailable · retry' : 'Replay 24h'}
      </button>
    );
  }

  const end = data.to + 60, rel = t - data.to, estimated = rel > 0;
  const ticks = [-24, -18, -12, -6, 0];
  return (
    <>
      <div data-testid="replay-banner" className="pointer-events-none absolute z-20 top-3 left-1/2 -translate-x-1/2 phone:top-[60px] bg-black/85 border border-amber-500/50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-amber-500">
        Replay · {clock(t)} <span className="text-gray-400">{estimated ? 'estimated' : ago(rel)}</span>
      </div>
      <div
        data-testid="replay-rail"
        className="absolute z-20 left-1/2 -translate-x-1/2 bottom-3 phone:bottom-[calc(var(--straits-nav-h)+96px)] w-[min(820px,calc(100%-24px))] bg-black/90 border border-amber-500/40 px-3 py-2 font-mono flex items-center gap-3 phone:flex-wrap phone:gap-2"
      >
        <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="min-h-[36px] min-w-[36px] border border-amber-500/50 text-amber-500 flex items-center justify-center hover:bg-amber-500/10">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <div className="w-[76px] shrink-0 leading-tight">
          <div className="text-sm text-white tabular-nums">{clock(t)}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500">{estimated ? 'live estimate' : ago(rel)}</div>
        </div>
        <div className="relative flex-1 min-w-[160px] phone:order-last phone:basis-full">
          {/* Past the last harvest the replay runs on estimates: hatched, like the mockup. */}
          <div aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 h-2 right-0 bg-[repeating-linear-gradient(135deg,rgba(245,158,11,0.25)_0_2px,transparent_2px_6px)]"
            style={{ width: `${(60 / (end - data.from)) * 100}%` }} />
          <input
            type="range" min={data.from} max={end} step={1} value={t}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Replay time" aria-valuetext={`${clock(t)}, ${estimated ? 'estimated' : ago(rel)}`}
            className="relative w-full accent-amber-500 cursor-pointer"
          />
          <div aria-hidden="true" className="relative h-3 text-[9px] text-gray-500">
            {ticks.map((h) => (
              <span key={h} className={`absolute whitespace-nowrap ${h === -24 ? '' : '-translate-x-1/2'}`} style={{ left: `${((data.to + h * 60 - data.from) / (end - data.from)) * 100}%` }}>
                {h === 0 ? 'NOW' : `${h}H`}
              </span>
            ))}
          </div>
        </div>
        <div className="flex" role="group" aria-label="Playback speed">
          {REPLAY_SPEEDS.map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} aria-pressed={speed === s}
              className={`min-h-[36px] px-2 text-[10px] uppercase tracking-wider border -ml-px first:ml-0 ${speed === s ? 'border-amber-500 text-amber-500 bg-amber-500/10 z-10' : 'border-gray-700 text-gray-400 hover:text-gray-200'}`}>
              {s}m/s
            </button>
          ))}
        </div>
        <button type="button" onClick={exit} data-testid="replay-live"
          className="min-h-[36px] px-2.5 border border-green-500/50 text-green-400 text-[10px] uppercase tracking-widest flex items-center gap-1.5 hover:bg-green-500/10">
          <Radio className="w-3.5 h-3.5" /> Live
        </button>
      </div>
    </>
  );
}

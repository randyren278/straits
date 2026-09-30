/**
 * Rewind: plays the last 24 h of tracks. The clock (`t`, minutes since epoch) advances in the
 * motion overlay's animation frame via `tick`; the rail reads it. Data loads on first use
 * (the rewind button, or selecting a ship for its day-long wake) and is cached.
 */
import { create } from 'zustand';
import { ReplayModel } from '@/lib/tracks/replay';
import type { ReplayResponse } from '@/lib/tracks/types';
import { useTrackStore } from './tracks';

export const REPLAY_SPEEDS = [2, 6, 20] as const;   // replay minutes per second

interface ReplayStore {
  data: ReplayResponse | null;
  model: ReplayModel | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  active: boolean;
  playing: boolean;
  t: number;
  speed: number;
  /** Eased 0..1 so play/pause ramps instead of snapping. */
  rate: number;
  load: () => Promise<void>;
  enter: () => Promise<void>;
  exit: () => void;
  setPlaying: (b: boolean) => void;
  seek: (t: number) => void;
  setSpeed: (s: number) => void;
  tick: (dtSeconds: number, reducedMotion: boolean) => void;
  rebuild: () => void;
}

let inflight: Promise<void> | null = null;

export const useReplayStore = create<ReplayStore>((set, get) => ({
  data: null, model: null, status: 'idle', active: false, playing: false, t: 0, speed: 6, rate: 0,

  load: () => {
    if (get().data) return Promise.resolve();
    if (inflight) return inflight;
    set({ status: 'loading' });
    inflight = fetch('/api/tracks/replay')
      .then((r) => { if (!r.ok) throw new Error(`replay ${r.status}`); return r.json() as Promise<ReplayResponse>; })
      .then((data) => {
        set({ data, status: 'ready' });
        get().rebuild();
      })
      .catch(() => set({ status: 'error' }))
      .finally(() => { inflight = null; });
    return inflight;
  },

  rebuild: () => {
    const { data } = get();
    if (data) set({ model: new ReplayModel(data, useTrackStore.getState().byMmsi) });
  },

  enter: async () => {
    await get().load();
    const { data } = get();
    if (!data) return;
    set({ active: true, playing: true, rate: 0, t: data.from });
  },
  exit: () => set({ active: false, playing: false, rate: 0 }),
  setPlaying: (playing) => {
    const { data, t } = get();
    // Playing from the end starts the day over.
    if (playing && data && t >= data.to + 59) set({ t: data.from });
    set({ playing });
  },
  seek: (t) => {
    const { data } = get();
    if (!data) return;
    set({ t: Math.max(data.from, Math.min(data.to + 60, t)), playing: false, rate: 0 });
  },
  setSpeed: (speed) => set({ speed }),
  tick: (dt, reducedMotion) => {
    const { active, playing, rate, t, speed, data } = get();
    if (!active || !data) return;
    const r = reducedMotion ? (playing ? 1 : 0) : rate + ((playing ? 1 : 0) - rate) * Math.min(1, dt * 7);
    if (r < 0.001 && !playing) { if (rate !== 0) set({ rate: 0 }); return; }
    // The replay runs an hour past the last harvest, on the live estimates.
    const end = data.to + 60, next = Math.min(end, t + dt * speed * r);
    set({ rate: r, t: next, ...(next >= end ? { playing: false } : {}) });
  },
}));

// Estimated paths past each ship's last fix come from the live feed; keep them current.
useTrackStore.subscribe((s, prev) => { if (s.byMmsi !== prev.byMmsi) useReplayStore.getState().rebuild(); });

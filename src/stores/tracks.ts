import { create } from 'zustand';
import { Nowcaster } from '@/lib/tracks/nowcast';
import type { TrackPayload, TracksResponse } from '@/lib/tracks/types';

interface TrackStore {
  nowcaster: Nowcaster;
  byMmsi: Map<string, TrackPayload>;
  backtest: TracksResponse['backtest'];
  learned: TracksResponse['learned'];
  showStale: boolean;
  setShowStale: (b: boolean) => void;
  /** Ships whose last real fix changed on the latest refresh → performance.now() when seen. */
  pings: Map<string, number>;
  ingest: (r: TracksResponse) => void;
}

export const useTrackStore = create<TrackStore>((set, get) => ({
  nowcaster: new Nowcaster(),
  byMmsi: new Map(),
  backtest: null,
  learned: null,
  showStale: true,
  setShowStale: (showStale) => set({ showStale }),
  pings: new Map(),
  ingest: (r) => {
    const prev = get().byMmsi, at = performance.now(), pings = new Map<string, number>();
    // The first load is not news; after that, every fresh fix pulses once.
    if (prev.size) for (const v of r.vessels) { const p = prev.get(v.mmsi); if (!p || p.lastRealAt !== v.lastRealAt) pings.set(v.mmsi, at); }
    get().nowcaster.ingest(r.vessels, Date.now() / 60000);
    set({ byMmsi: new Map(r.vessels.map((v) => [v.mmsi, v])), backtest: r.backtest, learned: r.learned, ...(pings.size ? { pings } : {}) });
  },
}));

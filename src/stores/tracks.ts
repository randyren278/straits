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
  ingest: (r: TracksResponse) => void;
}

export const useTrackStore = create<TrackStore>((set, get) => ({
  nowcaster: new Nowcaster(),
  byMmsi: new Map(),
  backtest: null,
  learned: null,
  showStale: true,
  setShowStale: (showStale) => set({ showStale }),
  ingest: (r) => {
    get().nowcaster.ingest(r.vessels, Date.now() / 60000);
    set({ byMmsi: new Map(r.vessels.map((v) => [v.mmsi, v])), backtest: r.backtest, learned: r.learned });
  },
}));

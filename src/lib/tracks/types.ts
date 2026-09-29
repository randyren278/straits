/** Track engine wire types, shared by the harvester, the API and the client. */
export interface TrackPayload {
  mmsi: string; tier: 0 | 1 | 2; score: number; parts: [number, number, number, number, number];
  state: 'underway' | 'rest'; sog: number; cog: number; lastRealAt: number;   // minutes since epoch
  method: 'hybrid' | 'sea' | 'damped' | null; tau: number | null;           // tau: slow-down minutes for 'damped'
  uncert: number;                                                               // nm per minute
  path: number[] | null; trail: number[] | null;                                 // codec-encoded [t, lat, lon]
  cleaning: { kept: number; rejected: number; inland: number; rerouted: number };
}
export interface TracksResponse {
  generatedAt: string; vessels: TrackPayload[];
  backtest: { n: number; hold: number; estimate: number } | null;
  learned: { choice: string[]; contexts: string[] } | null;
}

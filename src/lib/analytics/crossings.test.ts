import { describe, it, expect } from 'vitest';
import { computeCrossings, aggregateDaily, aggregateDailyRange, dayRange, type TrackPoint } from './crossings';

const T0 = Date.parse('2026-09-12T00:00:00Z');
const at = (minutes: number, lat: number, lon: number): TrackPoint => ({ time: new Date(T0 + minutes * 60_000), latitude: lat, longitude: lon });

// Reference fixes: inside each gate, mid-canal, and the anchorages.
const PORT_SAID = { lat: 31.30, lon: 32.33 };
const SUEZ = { lat: 29.95, lon: 32.55 };
const CANAL = { lat: 30.60, lon: 32.33 };
const PS_ANCHOR = { lat: 31.55, lon: 32.30 };
const MED = { lat: 32.20, lon: 32.00 };

/** A clean southbound passage: Port Said → canal → Suez, ~12 h. */
function southbound(offsetMin = 0): TrackPoint[] {
  return [
    at(offsetMin + 0, PORT_SAID.lat, PORT_SAID.lon),
    at(offsetMin + 10, PORT_SAID.lat - 0.02, PORT_SAID.lon),
    at(offsetMin + 240, CANAL.lat, CANAL.lon),
    at(offsetMin + 480, CANAL.lat - 0.3, CANAL.lon + 0.1),
    at(offsetMin + 720, SUEZ.lat, SUEZ.lon),
    at(offsetMin + 730, SUEZ.lat - 0.05, SUEZ.lon),
  ];
}

const tracks = (entries: Record<string, TrackPoint[]>) => new Map(Object.entries(entries));

describe('computeCrossings', () => {
  it('counts a clean gate-to-gate passage once, with the right direction', () => {
    const out = computeCrossings(tracks({ a: southbound() }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ mmsi: 'a', status: 'complete', direction: 'southbound' });
    expect(out[0].gateInAt.toISOString()).toBe('2026-09-12T00:10:00.000Z');
    expect(out[0].gateOutAt?.toISOString()).toBe('2026-09-12T12:00:00.000Z');
  });

  it('a stationary contact inside a gate never becomes a transit', () => {
    const track = Array.from({ length: 200 }, (_, i) => at(i * 10, SUEZ.lat, SUEZ.lon));
    expect(computeCrossings(tracks({ still: track })).filter((c) => c.status !== 'waiting')).toEqual([]);
  });

  it('a stationary contact in an anchorage for ≥ 6 h is "waiting", not a transit', () => {
    const track = Array.from({ length: 50 }, (_, i) => at(i * 10, PS_ANCHOR.lat + (i % 2) * 0.002, PS_ANCHOR.lon));
    const out = computeCrossings(tracks({ w: track }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ status: 'waiting', direction: 'southbound' });
  });

  it('a short anchorage stop (< 6 h) is not "waiting"', () => {
    const track = Array.from({ length: 20 }, (_, i) => at(i * 10, PS_ANCHOR.lat, PS_ANCHOR.lon));
    expect(computeCrossings(tracks({ w: track }))).toEqual([]);
  });

  it('oscillating across a gate boundary is one visit — the passage is counted once', () => {
    const wobble: TrackPoint[] = [];
    // Bounce in and out of the Port Said box edge (31.20) by ~1 km for an hour.
    for (let i = 0; i < 6; i++) wobble.push(at(i * 10, i % 2 ? 31.195 : 31.21, 32.33));
    const track = [...wobble, at(240, CANAL.lat, CANAL.lon), at(720, SUEZ.lat, SUEZ.lon)];
    const out = computeCrossings(tracks({ b: track }));
    expect(out.filter((c) => c.status === 'complete')).toHaveLength(1);
    expect(out.filter((c) => c.status === 'incomplete')).toHaveLength(0);
  });

  it('a feed gap mid-corridor with no far-gate fix yields an incomplete journey, not a transit', () => {
    const track = [
      at(0, PORT_SAID.lat, PORT_SAID.lon),
      at(240, CANAL.lat, CANAL.lon),
      // track ends here — feed gap
    ];
    const out = computeCrossings(tracks({ gap: track }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ status: 'incomplete', direction: 'southbound', gateOutAt: null });
    expect(out[0].reason).toMatch(/track ended/);
  });

  it('gate-in with no far gate for 48 h is incomplete with the timeout reason', () => {
    const track = [
      at(0, PORT_SAID.lat, PORT_SAID.lon),
      at(240, CANAL.lat, CANAL.lon),
      at(60 * 50, MED.lat, MED.lon),
    ];
    const out = computeCrossings(tracks({ late: track }));
    expect(out[0]).toMatchObject({ status: 'incomplete' });
    expect(out[0].reason).toMatch(/48h/);
  });

  it('a call at Port Said that leaves back to sea without entering the canal is nothing', () => {
    const track = [at(0, PORT_SAID.lat, PORT_SAID.lon), at(60, PORT_SAID.lat, PORT_SAID.lon), at(300, MED.lat, MED.lon)];
    expect(computeCrossings(tracks({ call: track }))).toEqual([]);
  });

  it('a physically impossible gate-to-gate time is not a transit', () => {
    const track = [at(0, PORT_SAID.lat, PORT_SAID.lon), at(30, CANAL.lat, CANAL.lon), at(60, SUEZ.lat, SUEZ.lon)];
    const out = computeCrossings(tracks({ teleport: track }));
    expect(out.filter((c) => c.status === 'complete')).toHaveLength(0);
  });

  it('two transits by one vessel on different days count as two, in both directions', () => {
    const south = southbound(0);
    const north = [
      at(3000, SUEZ.lat, SUEZ.lon),
      at(3240, CANAL.lat, CANAL.lon),
      at(3720, PORT_SAID.lat, PORT_SAID.lon),
    ];
    const out = computeCrossings(tracks({ v: [...south, ...north] })).filter((c) => c.status === 'complete');
    expect(out.map((c) => c.direction)).toEqual(['southbound', 'northbound']);
  });

  it('unsorted input is sorted before evaluation', () => {
    const shuffled = [...southbound()].reverse();
    expect(computeCrossings(tracks({ a: shuffled })).filter((c) => c.status === 'complete')).toHaveLength(1);
  });
});

describe('aggregateDaily', () => {
  it('buckets completes by gate-out day and others by their start, with distinct MMSIs', () => {
    const a = southbound(0);                 // gate-out 2026-09-12 12:00
    const b = southbound(60 * 20);           // gate-out 2026-09-13 08:00
    const gap = [at(60 * 30, PORT_SAID.lat, PORT_SAID.lon), at(60 * 34, CANAL.lat, CANAL.lon)]; // 2026-09-13
    const days = aggregateDaily(computeCrossings(tracks({ a, b, gap })));
    expect(days).toEqual([
      { day: '2026-09-12', northbound: 0, southbound: 1, waiting: 0, incomplete: 0, distinctMmsi: 1 },
      { day: '2026-09-13', northbound: 0, southbound: 1, waiting: 0, incomplete: 1, distinctMmsi: 2 },
    ]);
  });
});

describe('window discipline', () => {
  it('a window that starts mid-passage loses the transit — which is why partial windows are never written', () => {
    const full = southbound(0);
    const truncated = full.filter((p) => p.time.getTime() >= T0 + 120 * 60_000); // window opens at 02:00
    expect(computeCrossings(tracks({ a: full })).filter((c) => c.status === 'complete')).toHaveLength(1);
    expect(computeCrossings(tracks({ a: truncated })).filter((c) => c.status === 'complete')).toHaveLength(0);
  });

  it('aggregateDailyRange zero-fills every requested day and drops days outside the range', () => {
    const out = aggregateDailyRange(computeCrossings(tracks({ a: southbound(0) })), ['2026-09-11', '2026-09-12']);
    expect(out).toEqual([
      { day: '2026-09-11', northbound: 0, southbound: 0, waiting: 0, incomplete: 0, distinctMmsi: 0 },
      { day: '2026-09-12', northbound: 0, southbound: 1, waiting: 0, incomplete: 0, distinctMmsi: 1 },
    ]);
    expect(aggregateDailyRange(computeCrossings(tracks({ a: southbound(0) })), ['2026-09-13'])[0].southbound).toBe(0);
  });

  it('dayRange counts back from the end day inclusive', () => {
    expect(dayRange('2026-09-15', 3)).toEqual(['2026-09-13', '2026-09-14', '2026-09-15']);
  });
});

describe('edge cases from review', () => {
  it('far gate reached implausibly fast is labelled as such, not as "track ended"', () => {
    const track = [at(0, PORT_SAID.lat, PORT_SAID.lon), at(30, CANAL.lat, CANAL.lon), at(60, SUEZ.lat, SUEZ.lon)];
    const out = computeCrossings(tracks({ teleport: track }));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('incomplete');
    expect(out[0].reason).toMatch(/physically implausible/);
  });

  it('a false start (gate → canal → back to the same gate → canal → far gate) is exactly one transit', () => {
    const track = [
      at(0, PORT_SAID.lat, PORT_SAID.lon),
      at(60, CANAL.lat + 0.5, CANAL.lon),   // poked into the corridor
      at(120, PORT_SAID.lat, PORT_SAID.lon), // came back
      at(180, PORT_SAID.lat, PORT_SAID.lon),
      at(420, CANAL.lat, CANAL.lon),
      at(900, SUEZ.lat, SUEZ.lon),
    ];
    const out = computeCrossings(tracks({ v: track }));
    expect(out.filter((c) => c.status === 'complete')).toHaveLength(1);
    expect(out.filter((c) => c.status === 'incomplete')).toHaveLength(0);
  });

  it('a 9-hour edge-to-edge passage at a normal canal speed is a transit', () => {
    const track = [at(0, 31.21, 32.33), at(240, CANAL.lat, CANAL.lon), at(540, 30.04, 32.55)];
    expect(computeCrossings(tracks({ slow: track })).filter((c) => c.status === 'complete')).toHaveLength(1);
  });

  it('the same vessel can wait at the anchorage and then transit — both are recorded', () => {
    const wait = Array.from({ length: 40 }, (_, i) => at(i * 10, PS_ANCHOR.lat, PS_ANCHOR.lon)); // 6.5 h
    const track = [...wait, ...southbound(500)];
    const out = computeCrossings(tracks({ w: track }));
    expect(out.map((c) => c.status).sort()).toEqual(['complete', 'waiting']);
  });
});

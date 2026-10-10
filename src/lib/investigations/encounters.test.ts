import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ pool: { query } }));

import { encounterId, isValidEncounterId, isValidEncounterImo, loadEncounterCase, loadRecentEncounterLeads } from './encounters';

const NOW = new Date('2026-10-10T12:00:00.000Z');
const vessel = { imo: '9000001', name: 'NORTH STAR', mmsi: '123456789', flag: 'PA' };
const recent = {
  partner_imo: '9000002', partner_name: 'SOUTH STAR', partner_mmsi: '987654321',
  first_seen_us: '1791532800123456',
  first_seen_at: new Date('2026-10-09T08:00:00.123Z'),
  last_seen_at: new Date('2026-10-09T09:00:00Z'),
  min_distance_km: 0.42, self_sanctioned: false, partner_sanctioned: true,
};
const older = {
  partner_imo: '9000003', partner_name: null, partner_mmsi: null,
  first_seen_us: '1791446400000123',
  first_seen_at: new Date('2026-10-08T08:00:00Z'),
  last_seen_at: new Date('2026-10-08T09:00:00Z'),
  min_distance_km: null, self_sanctioned: null, partner_sanctioned: null,
};

function fix(time: string, mmsi = vessel.mmsi) {
  return { time: new Date(time), mmsi, latitude: 24.5, longitude: 56.5, speed: 0.2, source: 'aisstream', low_confidence: false };
}

function queueCase(rows: Array<typeof recent | typeof older> = [recent], tracks: Array<unknown[]> = [[], [], [], []]) {
  query.mockResolvedValueOnce({ rows: [vessel] }).mockResolvedValueOnce({ rows });
  for (const positions of tracks) query.mockResolvedValueOnce({ rows: positions });
}

beforeEach(() => query.mockReset());

describe('encounter case evidence', () => {
  it('offers eight recent leads with microsecond-precise event links', async () => {
    query.mockResolvedValueOnce({ rows: [{
      imo: vessel.imo, name: vessel.name, partner_imo: recent.partner_imo,
      partner_name: recent.partner_name, first_seen_us: recent.first_seen_us,
      first_seen_at: recent.first_seen_at, last_seen_at: recent.last_seen_at,
      min_distance_km: recent.min_distance_km,
    }] });
    expect(await loadRecentEncounterLeads()).toEqual([{
      imo: vessel.imo, name: vessel.name, partnerImo: recent.partner_imo,
      partnerName: recent.partner_name, lastSeenAt: recent.last_seen_at.toISOString(),
      minDistanceKm: recent.min_distance_km, eventId: encounterId(recent.partner_imo, recent.first_seen_us),
    }]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("last_seen_at >= NOW() - INTERVAL '7 days'");
    expect(sql).toContain('LIMIT 8');
    expect(sql.indexOf('LIMIT 8')).toBeLessThan(sql.indexOf('JOIN vessels self'));
  });

  it('validates bounded IMO and microsecond event identifiers', () => {
    expect(isValidEncounterImo('9000001')).toBe(true);
    expect(isValidEncounterImo('9000001 OR 1=1')).toBe(false);
    expect(isValidEncounterId(encounterId(recent.partner_imo, recent.first_seen_us))).toBe(true);
    expect(isValidEncounterId('9000002-1791532800123')).toBe(false);
  });

  it('returns an honest empty case when the vessel has no recorded encounters', async () => {
    query.mockResolvedValueOnce({ rows: [vessel] }).mockResolvedValueOnce({ rows: [] });
    expect(await loadEncounterCase(vessel.imo, undefined, NOW)).toEqual({
      kind: 'found', data: { vessel, encounters: [], selectedSummary: null, selected: null },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('keeps verified IMO fixes separate from provisional current-MMSI fixes', async () => {
    queueCase([recent, older], [
      [fix('2026-10-09T08:20:00Z'), fix('2026-10-09T08:10:00Z')],
      [fix('2026-10-09T08:15:00Z', recent.partner_mmsi)],
      [fix('2026-10-09T08:18:00Z')],
      [fix('2026-10-09T08:16:00Z', recent.partner_mmsi)],
    ]);
    const result = await loadEncounterCase(vessel.imo, undefined, NOW);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.data.encounters).toHaveLength(2);
    expect(result.data.selectedSummary?.id).toBe(encounterId(recent.partner_imo, recent.first_seen_us));
    expect(result.data.selected?.selfPositions.map((p) => p.time)).toEqual([
      '2026-10-09T08:10:00.000Z', '2026-10-09T08:20:00.000Z',
    ]);
    expect(result.data.selected?.selfPositions.every((p) => p.identityBasis === 'imo')).toBe(true);
    expect(result.data.selected?.selfCandidatePositions).toMatchObject([{ identityBasis: 'current_mmsi' }]);
    expect(result.data.selected?.partnerPositions).toMatchObject([{ identityBasis: 'imo' }]);
    expect(result.data.selected?.partnerCandidatePositions).toMatchObject([{ identityBasis: 'current_mmsi' }]);
    expect(query.mock.calls.slice(2).map((call) => call[1][0])).toEqual([
      vessel.imo, recent.partner_imo, vessel.mmsi, recent.partner_mmsi,
    ]);
    expect(String(query.mock.calls[2][0])).toContain('WHERE imo = $1');
    expect(String(query.mock.calls[4][0])).toContain('WHERE imo IS NULL AND mmsi = $1');
  });

  it('resolves an older deep link by exact pair and microsecond key outside the latest-20 sidebar', async () => {
    query.mockResolvedValueOnce({ rows: [vessel] })
      .mockResolvedValueOnce({ rows: [recent] })
      .mockResolvedValueOnce({ rows: [older] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const id = encounterId(older.partner_imo, older.first_seen_us);
    const result = await loadEncounterCase(vessel.imo, id, NOW);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.data.encounters.map((event) => event.id)).toEqual([encounterId(recent.partner_imo, recent.first_seen_us)]);
    expect(result.data.selectedSummary?.id).toBe(id);
    expect(result.data.selected?.id).toBe(id);
    const exactQuery = query.mock.calls[2];
    expect(String(exactQuery[0])).toContain('r.first_seen_at = to_timestamp($3::numeric / 1000000)');
    expect(exactQuery[1]).toEqual([vessel.imo, older.partner_imo, older.first_seen_us]);
    expect(query).toHaveBeenCalledTimes(6); // partner MMSI is unknown, so that branch is skipped
  });

  it('rejects a well-formed event that is absent from the exact ledger lookup', async () => {
    query.mockResolvedValueOnce({ rows: [vessel] }).mockResolvedValueOnce({ rows: [recent] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await loadEncounterCase(vessel.imo, encounterId(older.partner_imo, older.first_seen_us), NOW))
      .toEqual({ kind: 'event_not_found' });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('keeps an archived encounter visible when raw positions are beyond seven-day retention', async () => {
    const archived = { ...older, first_seen_at: new Date('2026-09-20T08:00:00Z'), last_seen_at: new Date('2026-09-20T09:00:00Z') };
    query.mockResolvedValueOnce({ rows: [vessel] }).mockResolvedValueOnce({ rows: [archived] });
    const result = await loadEncounterCase(vessel.imo, undefined, NOW);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.data.selected).toMatchObject({
      selfPositions: [], partnerPositions: [], selfCandidatePositions: [], partnerCandidatePositions: [],
      selfTrackStatus: 'no_imo_fixes', partnerTrackStatus: 'no_imo_fixes',
      positionWindow: { startsAt: '2026-09-19T20:00:00.000Z', endsAt: '2026-09-20T21:00:00.000Z' },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('marks truncated branches and reports the time span of returned newest-250 fixes', async () => {
    const many = Array.from({ length: 251 }, (_, index) =>
      fix(new Date(Date.parse('2026-10-09T08:00:00Z') - index * 60_000).toISOString()),
    );
    queueCase([recent], [many, [], [fix('2026-10-09T07:00:00Z')], []]);
    const result = await loadEncounterCase(vessel.imo, undefined, NOW);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.data.selected?.selfPositions).toHaveLength(250);
    expect(result.data.selected?.selfPositionsMeta).toEqual({
      truncated: true,
      earliestReturnedAt: many[249].time.toISOString(),
      latestReturnedAt: many[0].time.toISOString(),
    });
    expect(result.data.selected?.selfCandidatePositionsMeta).toEqual({
      truncated: false,
      earliestReturnedAt: '2026-10-09T07:00:00.000Z',
      latestReturnedAt: '2026-10-09T07:00:00.000Z',
    });
    for (const call of query.mock.calls.slice(2)) {
      expect(String(call[0])).toContain('LIMIT 251');
      expect(call[1][1]).toEqual(new Date('2026-10-08T20:00:00.123Z'));
      expect(call[1][2]).toEqual(new Date('2026-10-09T21:00:00.000Z'));
    }
  });

  it('clamps an instantaneous recent encounter display window at now', async () => {
    const instant = { ...recent, first_seen_at: new Date('2026-10-10T11:30:00Z'), last_seen_at: new Date('2026-10-10T11:30:00Z') };
    queueCase([instant]);
    const result = await loadEncounterCase(vessel.imo, undefined, NOW);
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    const window = result.data.selected?.positionWindow;
    expect(window?.endsAt).toBe(NOW.toISOString());
    expect(Date.parse(window!.endsAt)).toBeGreaterThan(Date.parse(window!.startsAt));
  });
});

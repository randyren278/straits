'use client';

/**
 * Chokepoint Pulse card: daily crossings chart + the voyages behind a day.
 * Loads /api/chokepoints/suez/crossings for the range, then again with ?day=
 * when a bar is picked. Only Suez has a crossing model today.
 */
import { useEffect, useRef, useState } from 'react';
import { CrossingsChart } from './CrossingsChart';
import { VoyagesTable } from './VoyagesTable';
import type { DailyCrossingCounts } from '@/lib/analytics/crossings';
import type { VoyageRow } from '@/app/api/chokepoints/[id]/crossings/route';
import type { TimeRange } from '@/types/analytics';

interface CrossingsResponse {
  days: DailyCrossingCounts[];
  voyages: VoyageRow[] | null;
  reason: string | null;
}

export function incompleteRatioOf(days: readonly DailyCrossingCounts[]): number | null {
  const complete = days.reduce((s, d) => s + d.northbound + d.southbound, 0);
  const incomplete = days.reduce((s, d) => s + d.incomplete, 0);
  return complete + incomplete === 0 ? null : incomplete / (complete + incomplete);
}

/** Keyed on `range` by the parent so a range change resets the selection. */
export function ChokepointPulse({ range }: { range: TimeRange }) {
  const [days, setDays] = useState<DailyCrossingCounts[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [voyages, setVoyages] = useState<VoyageRow[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chokepoints/suez/crossings?range=${range}`)
      .then((r) => r.json() as Promise<CrossingsResponse>)
      .then((json) => { if (!cancelled) setDays(json.days ?? []); })
      .catch(() => { if (!cancelled) setDays([]); });
    return () => { cancelled = true; };
  }, [range]);

  const selectDay = (day: string) => {
    const seq = ++requestSeq.current;
    setSelectedDay(day);
    setLoadingDay(true);
    setVoyages(null);
    setReason(null);
    fetch(`/api/chokepoints/suez/crossings?range=${range}&day=${day}`)
      .then((r) => r.json() as Promise<CrossingsResponse>)
      .then((json) => {
        if (seq !== requestSeq.current) return; // a later click superseded this one
        setVoyages(json.voyages ?? null); setReason(json.reason ?? null);
      })
      .catch(() => { if (seq === requestSeq.current) { setVoyages(null); setReason('failed to load voyages'); } })
      .finally(() => { if (seq === requestSeq.current) setLoadingDay(false); });
  };

  return (
    <div data-testid="chokepoint-pulse">
      <CrossingsChart
        days={days}
        selectedDay={selectedDay}
        onSelectDay={selectDay}
        incompleteRatio={incompleteRatioOf(days)}
      />
      <VoyagesTable day={selectedDay} voyages={voyages} reason={reason} loading={loadingDay} />
    </div>
  );
}

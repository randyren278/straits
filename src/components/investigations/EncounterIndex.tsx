'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Lead {
  eventId: string;
  imo: string;
  name: string;
  partnerImo: string;
  partnerName: string | null;
  lastSeenAt: string;
  minDistanceKm: number | null;
}

interface SearchResult { imo: string | null; mmsi: string; name: string }

function utc(value: string): string {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? 'Time unavailable' : `${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(time)} UTC`;
}

export function EncounterIndex() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/investigations/encounters', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Recent leads unavailable');
        const payload = await response.json();
        if (!controller.signal.aborted) { setLeads(Array.isArray(payload.leads) ? payload.leads : []); setState('ready'); }
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    })();
    return () => controller.abort();
  }, []);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (/^\d{7}$/.test(value)) { router.push(`/investigations/encounters/${value}`); return; }
    if (value.length < 2) { setMatches([]); return; }
    setSearching(true);
    setMatches(null);
    try {
      const response = await fetch(`/api/vessels/search?q=${encodeURIComponent(value)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Search failed');
      const payload = await response.json();
      setMatches((payload.results as SearchResult[]).filter((item) => item.imo && /^\d{7}$/.test(item.imo)));
    } catch { setMatches([]); } finally { setSearching(false); }
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 text-gray-100 phone:px-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
    <div className="border-b border-amber-500/30 pb-6"><p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">Canary / Investigation graph / 02</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-mono uppercase tracking-wider">Encounter Caseboard</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Explore recorded sustained proximity between vessels, then inspect the retained AIS fixes behind each lead. The relationship is a detector output; it does not prove a transfer.</p></div><Link href="/investigations" className="border border-gray-700 px-3 py-2 text-[10px] font-mono uppercase text-gray-400 hover:text-amber-300">← Claim Checker</Link></div></div>
    <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,0.8fr)]">
      <div className="border border-gray-800 bg-gray-950/60"><div className="flex items-baseline justify-between border-b border-gray-800 px-4 py-3"><h2 className="text-[10px] font-mono uppercase tracking-widest text-gray-200">Latest recorded links</h2><span className="text-[9px] font-mono uppercase text-gray-600">Dated leads</span></div>
        {state === 'loading' && <p role="status" className="p-8 text-xs text-gray-500">Loading the encounter ledger…</p>}
        {state === 'error' && <p role="alert" className="p-8 text-xs text-red-300">The encounter ledger is unavailable right now.</p>}
        {state === 'ready' && leads.length === 0 && <p className="p-8 text-xs text-gray-500">No recent ledger events are available. This does not establish that no vessels met.</p>}
        {state === 'ready' && leads.length > 0 && <ol className="divide-y divide-gray-900">{leads.map((lead, index) => <li key={lead.eventId}><Link href={`/investigations/encounters/${lead.imo}?event=${encodeURIComponent(lead.eventId)}`} className="group grid min-h-20 items-center gap-3 px-4 py-3 hover:bg-amber-500/5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"><span className="text-[10px] font-mono text-gray-700">{String(index + 1).padStart(2, '0')}</span><span><span className="block text-sm font-mono text-gray-200 group-hover:text-amber-300">{lead.name} <span className="text-gray-600">↔</span> {lead.partnerName ?? lead.partnerImo}</span><span className="mt-1 block text-[10px] text-gray-600">{lead.imo} / {lead.partnerImo} · {utc(lead.lastSeenAt)}</span></span><span className="text-[9px] font-mono uppercase text-amber-400">{lead.minDistanceKm === null ? 'Separation unavailable' : `${lead.minDistanceKm.toFixed(2)} km minimum`} ↗</span></Link></li>)}</ol>}
      </div>
      <aside className="space-y-4"><div className="border border-gray-800 bg-gray-950/60 p-4"><p className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Open a vessel case</p><h2 className="mt-2 text-sm font-mono text-gray-200">Search the observed fleet</h2><form onSubmit={(event) => void search(event)} className="mt-4 flex gap-2"><input aria-label="Vessel name or IMO" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or 7-digit IMO" className="min-w-0 flex-1 border border-gray-700 bg-black px-3 py-2 text-xs text-gray-200 placeholder:text-gray-700 focus:border-amber-500 focus:outline-none" /><button type="submit" disabled={searching} className="border border-amber-500/50 px-3 py-2 text-[10px] font-mono uppercase text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">{searching ? 'Finding…' : 'Find'}</button></form>{matches && <div className="mt-3 divide-y divide-gray-900 border-t border-gray-800">{matches.length ? matches.map((match) => <Link key={`${match.imo}-${match.mmsi}`} href={`/investigations/encounters/${match.imo}`} className="flex justify-between gap-2 py-3 text-xs text-gray-300 hover:text-amber-300"><span>{match.name}</span><span className="font-mono text-gray-600">{match.imo}</span></Link>) : <p className="py-3 text-xs text-gray-600">No vessel with a verified IMO matched. Try a full IMO.</p>}</div>}</div><div className="border-l-2 border-amber-500/40 bg-gray-950/60 p-4"><p className="text-[9px] font-mono uppercase tracking-wider text-amber-400">Reading the evidence</p><p className="mt-2 text-xs leading-5 text-gray-500">A ledger edge means the detector recorded sustained closeness. The case view keeps that event interval separate from raw fixes, shows each AIS source and time, and leaves gaps visible. Older tracks can disappear under retention while the event record remains.</p></div></aside>
    </section>
  </main>;
}

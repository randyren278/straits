'use client';

/**
 * Command palette — ⌘K / Ctrl+K from anywhere.
 *
 * Jumps: a vessel (by name / IMO / MMSI), a chokepoint, a page, the field
 * manual, or a filter toggle. Vessel and chokepoint jumps land on the
 * dashboard through the same investigation-link parameters a shared URL
 * uses, so the palette and the address bar agree.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Command, Ship, MapPin, BookOpen, BarChart3, List, Filter } from 'lucide-react';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import { serializeInvestigation } from '@/lib/dashboard/investigation-link';
import { useVesselStore } from '@/stores/vessel';

interface VesselHit {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface CommandEntry {
  id: string;
  group: 'Vessels' | 'Chokepoints' | 'Go to' | 'Filters';
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const onDashboard = pathname === '/dashboard';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VesselHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setActive(0);
      // Focus after the dialog paints.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced vessel search.
  useEffect(() => {
    if (!open || query.trim().length < 2) { setHits([]); return; }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vessels/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await res.json();
        setHits((data.results ?? []).slice(0, 6));
      } catch {
        // Aborted or failed; static commands still work.
      }
    }, 200);
    return () => { clearTimeout(t); controller.abort(); };
  }, [query, open]);

  const goDashboard = (qs: string) => {
    router.push(`/dashboard${qs}`);
  };

  const entries = useMemo<CommandEntry[]>(() => {
    const store = useVesselStore.getState();
    const q = query.trim().toLowerCase();
    const list: CommandEntry[] = [];

    for (const h of hits) {
      list.push({
        id: `vessel-${h.mmsi}`,
        group: 'Vessels',
        label: h.name ?? `MMSI ${h.mmsi}`,
        hint: [h.imo ? `IMO ${h.imo}` : null, h.flag].filter(Boolean).join(' · '),
        icon: Ship,
        run: () => {
          if (onDashboard) {
            if (h.latitude !== null && h.longitude !== null) store.setMapCenter({ lat: h.latitude, lon: h.longitude, zoom: 10 });
            if (h.imo) store.setTargetVesselImo(h.imo);
          } else if (h.imo) {
            goDashboard(serializeInvestigation({ vessel: h.imo }));
          } else {
            goDashboard('');
          }
        },
      });
    }

    for (const cp of Object.values(CHOKEPOINTS)) {
      if (q && !cp.name.toLowerCase().includes(q) && !cp.id.includes(q)) continue;
      list.push({
        id: `cp-${cp.id}`,
        group: 'Chokepoints',
        label: cp.name,
        hint: 'Fly to zone',
        icon: MapPin,
        run: () => {
          const b = cp.bounds;
          if (onDashboard) store.setMapCenter({ lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2, zoom: 8 });
          else goDashboard(serializeInvestigation({ chokepoint: cp.id }));
        },
      });
    }

    const pages: Array<[string, string, CommandEntry['icon']]> = [
      ['Live map', '/dashboard', MapPin],
      ['Analytics', '/analytics', BarChart3],
      ['Fleet', '/fleet', List],
      ['Field manual', '/about', BookOpen],
    ];
    for (const [label, href, icon] of pages) {
      if (q && !label.toLowerCase().includes(q)) continue;
      list.push({ id: `go-${href}`, group: 'Go to', label, hint: href, icon, run: () => router.push(href) });
    }

    if (onDashboard) {
      const filters: Array<[string, () => void]> = [
        [store.tankersOnly ? 'Show all ship types' : 'Tankers only', () => store.setTankersOnly(!store.tankersOnly)],
        [store.anomalyFilter ? 'Show all contacts' : 'Anomalies only', () => store.setAnomalyFilter(!store.anomalyFilter)],
      ];
      for (const [label, run] of filters) {
        if (q && !label.toLowerCase().includes(q) && !'filter'.includes(q)) continue;
        list.push({ id: `filter-${label}`, group: 'Filters', label, icon: Filter, run });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, query, onDashboard, router]);

  useEffect(() => { setActive(0); }, [entries.length, query]);

  const choose = (entry: CommandEntry) => {
    setOpen(false);
    entry.run();
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, entries.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && entries[active]) { e.preventDefault(); choose(entries[active]); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        title="Jump to a vessel, chokepoint or page (⌘K)"
        className="hidden roomy:inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 px-2 py-1 border border-gray-800 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-amber-500 hover:border-amber-500/40"
      >
        <Command className="w-3 h-3" aria-hidden="true" />
        K
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center pt-[12vh] px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            data-testid="command-palette"
            className="w-full max-w-lg bg-black border border-amber-500/40 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-2 px-3 border-b border-amber-500/20">
              <Command className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Vessel name, IMO, MMSI · chokepoint · page"
                aria-label="Command"
                aria-activedescendant={entries[active] ? `cmd-${entries[active].id}` : undefined}
                className="flex-1 min-h-[44px] bg-transparent text-sm font-mono text-white placeholder:text-gray-600 outline-none"
              />
              <kbd className="text-[10px] font-mono text-gray-600">esc</kbd>
            </div>
            <ul role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
              {entries.length === 0 && (
                <li className="px-3 py-3 text-xs font-mono text-gray-500">
                  {query.trim().length < 2 ? 'Type to search vessels, or pick a destination.' : 'No matches.'}
                </li>
              )}
              {entries.map((entry, i) => {
                const Icon = entry.icon;
                const first = i === 0 || entries[i - 1].group !== entry.group;
                return (
                  <li key={entry.id} role="presentation">
                    {first && (
                      <div className="px-3 pt-2 pb-1 text-[9px] font-mono uppercase tracking-widest text-gray-600">{entry.group}</div>
                    )}
                    <button
                      id={`cmd-${entry.id}`}
                      role="option"
                      aria-selected={i === active}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(entry)}
                      className={`w-full text-left px-3 min-h-[40px] flex items-center gap-2 text-xs font-mono ${
                        i === active ? 'bg-amber-500/10 text-amber-400' : 'text-gray-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 text-gray-500" aria-hidden="true" />
                      <span className="truncate">{entry.label}</span>
                      {entry.hint && <span className="ml-auto text-[10px] text-gray-500 shrink-0">{entry.hint}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

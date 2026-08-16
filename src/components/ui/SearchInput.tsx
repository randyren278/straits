'use client';

/**
 * Autocomplete search input for vessel lookup.
 * Searches by vessel name, IMO, or MMSI with debounced API calls.
 * Requirements: MAP-06
 */
import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchResult {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface SearchInputProps {
  onSelectVessel?: (result: SearchResult) => void;
}

export function SearchInput({ onSelectVessel }: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Debounced search
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/vessels/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setActiveIndex(-1);
        // Selecting a result sets the query to that vessel's name, which
        // re-triggers this search. Without the guard the list reopens ~300ms
        // after the user picked something, so selection looked like a no-op.
        if (justSelectedRef.current) justSelectedRef.current = false;
        else setIsOpen(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    justSelectedRef.current = true;
    setQuery(result.name ?? result.mmsi);
    setIsOpen(false);
    onSelectVessel?.(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const trimmed = query.trim();
  const showEmptyState = focused && trimmed.length === 0;
  const showMinLength = trimmed.length === 1;

  return (
    <div className="relative phone:w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); setIsOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Name, IMO, or MMSI..."
          aria-label="Search vessels by name, IMO, or MMSI"
          className="w-56 phone:w-full pl-9 pr-8 py-1.5 phone:min-h-[44px] tablet:min-h-[44px] bg-black border border-gray-700 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />
        {loading && (
          <span
            data-testid="search-loading"
            aria-hidden="true"
            className="absolute right-8 top-1/2 -translate-y-1/2 w-3 h-3 border border-gray-700 border-t-amber-500 rounded-full animate-spin motion-reduce:animate-none"
          />
        )}
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white phone:min-h-[44px] phone:min-w-[44px] phone:inline-flex phone:items-center phone:justify-center tablet:min-h-[44px] tablet:min-w-[44px] tablet:inline-flex tablet:items-center tablet:justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-80 phone:w-full bg-black border border-amber-500/20 shadow-lg z-50 max-h-72 overflow-y-auto"
        >
          {/* Empty + focused. Previously rendered nothing, so there was no way
              to learn that IMO and MMSI are accepted at all. */}
          {showEmptyState && (
            <div className="p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500 mb-2">
                Search the fleet
              </p>
              <p className="text-xs text-gray-400 mb-3">
                By vessel name, IMO number, or MMSI. Two characters minimum.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['TENDUA', '9299862', 'front'].map((example) => (
                  <button
                    key={example}
                    type="button"
                    // mousedown, not click: the input's blur would close this
                    // panel before a click ever landed.
                    onMouseDown={(e) => { e.preventDefault(); setQuery(example); }}
                    className="px-2 py-1 phone:min-h-[44px] tablet:min-h-[44px] text-xs font-mono text-amber-500 border border-gray-700 hover:border-amber-500 hover:bg-amber-500/10 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Below the API's two-character floor. Names the exact gap. */}
          {showMinLength && !loading && (
            <p className="p-3 text-xs text-gray-400">
              <span className="text-white">1 more character</span> — search needs at least two.
            </p>
          )}

          {loading && (
            <div aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-3 py-2 border-b border-gray-800 last:border-b-0">
                  <span className="block h-2.5 bg-gray-800 animate-pulse motion-reduce:animate-none" />
                  <span className="block mt-1.5 h-2 w-3/5 bg-gray-800 animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          )}

          {!loading && trimmed.length >= 2 && results.length > 0 && (
            <>
              <p className="sticky top-0 bg-black flex items-baseline justify-between px-3 py-1.5 border-b border-amber-500/10 text-[10px] font-mono uppercase tracking-widest text-amber-500">
                <span>{results.length === 1 ? '1 vessel' : `${results.length} vessels`}</span>
                <span className="text-gray-500 tracking-normal normal-case">↑↓ move · ↵ open</span>
              </p>
              {results.map((result, i) => (
                <button
                  key={result.imo}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => handleSelect(result)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-900 transition-colors border-b border-gray-800 last:border-b-0 ${
                    i === activeIndex ? 'bg-gray-900' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{result.name}</span>
                    {/* A vessel the AIS feed has not placed is selectable, but
                        the user must know before they tap that the map will not
                        move. */}
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-1 border ${
                        result.latitude === null
                          ? 'text-gray-400 border-gray-600'
                          : 'text-green-500 border-green-500/50'
                      }`}
                    >
                      {result.latitude === null ? 'No fix' : 'Tracking'}
                    </span>
                  </span>
                  {/* Built by joining only the fields that exist. The old
                      template interpolated `flag` unconditionally, and flag is
                      null for most of the fleet, so nearly every row ended in a
                      dangling pipe. */}
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {[`IMO ${result.imo}`, `MMSI ${result.mmsi}`, result.flag]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              ))}
            </>
          )}

          {!loading && trimmed.length >= 2 && results.length === 0 && (
            <p className="p-3 text-xs text-gray-400">
              No vessel matches <span className="text-white">{trimmed}</span>.
              <br />
              IMO numbers always resolve exactly — try one of those.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

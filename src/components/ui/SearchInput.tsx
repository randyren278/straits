'use client';

/**
 * Autocomplete search input for vessel lookup.
 * Searches by vessel name, IMO, or MMSI with debounced API calls.
 * Requirements: MAP-06
 */
import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchResult {
  imo: string;
  mmsi: string;
  name: string;
  flag: string;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        setIsOpen(true);
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
    setQuery(result.name);
    setIsOpen(false);
    onSelectVessel?.(result);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search vessel..."
          className="w-48 pl-9 pr-8 py-1.5 bg-black border border-gray-700 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-72 bg-black border border-amber-500/20 shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {results.map((result) => (
            <button
              key={result.imo}
              onClick={() => handleSelect(result)}
              className="w-full px-3 py-2 text-left hover:bg-gray-900 transition-colors border-b border-gray-800 last:border-b-0"
            >
              <p className="text-sm text-white font-medium">{result.name}</p>
              <p className="text-xs text-gray-400">
                IMO: {result.imo} | {result.flag}
              </p>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-black border border-amber-500/20 shadow-lg z-50 p-3">
          <p className="text-sm text-gray-400">No vessels found</p>
        </div>
      )}
    </div>
  );
}

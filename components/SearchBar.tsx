'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

interface SearchBarProps {
  onLocationSelect: (lat: number, lon: number, name: string) => void;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function SearchBar({ onLocationSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExplicitSearch, setIsExplicitSearch] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: 'json',
        limit: '5',
        addressdetails: '1',
      });

      const response = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: {
          'User-Agent': 'Sandbars Surf Forecast App',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResult[] = await response.json();

      if (data.length > 0) {
        setResults(data);
      }
      setShowDropdown(true);

      if (data.length === 0) {
        setError('No locations found');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError('Search unavailable');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search-as-you-type
  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsExplicitSearch(false);

    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Reset keyboard selection when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        if (!showDropdown || results.length === 0) return;
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        if (!showDropdown || results.length === 0) return;
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        } else {
          setIsExplicitSearch(true);
          performSearch(query);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const name = result.display_name.split(',')[0];

    onLocationSelect(lat, lon, name);
    setQuery(name);
    setShowDropdown(false);
    setResults([]);
  };

  const formatResultName = (displayName: string): string => {
    const parts = displayName.split(',');
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return parts[0].trim();
  };

  return (
    <div
      ref={containerRef}
      data-testid="search-bar"
      className="relative w-full max-w-[320px]"
    >
      {/* Search Input */}
      <div className="flex items-center bg-surface rounded-md shadow-sm border border-border overflow-hidden">
        <div className="pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-text-tertiary animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
          )}
        </div>
        <input
          ref={inputRef}
          data-testid="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search locations..."
          className="flex-1 px-2.5 py-3 border-none outline-none bg-transparent text-sm text-text-primary placeholder:text-text-tertiary min-h-[44px]"
        />
        <button
          onClick={() => { setIsExplicitSearch(true); performSearch(query); }}
          disabled={isLoading || !query.trim()}
          className="px-3 py-2.5 border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-default flex items-center text-xs text-text-secondary hover:text-text-primary transition-colors duration-150"
          aria-label="Search"
        >
          Go
        </button>
      </div>

      {/* Results Dropdown with backdrop */}
      {showDropdown && (results.length > 0 || isLoading || (error && isExplicitSearch)) && (
        <>
          {/* Invisible backdrop to capture outside clicks */}
          <div
            className="fixed inset-0 z-[5]"
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(false);
            }}
          />
          <div
            data-testid="search-results"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-md shadow-sm border border-border overflow-hidden z-10"
          >
          {results.map((result, index) => (
            <button
              key={result.place_id}
              data-testid="search-result-item"
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleResultClick(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={[
                'flex items-start gap-2.5 w-full px-3.5 py-3 border-none text-left cursor-pointer text-sm border-b border-border last:border-b-0 transition-colors duration-100 min-h-[44px]',
                index === selectedIndex ? 'bg-surface-secondary' : 'bg-transparent',
              ].join(' ')}
            >
              <MapPin className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="min-w-0">
                <div className="font-medium text-text-primary truncate">
                  {formatResultName(result.display_name)}
                </div>
                <div className="text-xs text-text-tertiary">
                  {result.type}
                </div>
              </div>
            </button>
          ))}
          {isLoading && results.length === 0 && (
            <div className="px-3.5 py-3 text-sm text-text-secondary flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching...
            </div>
          )}
          {error && !isLoading && isExplicitSearch && results.length === 0 && (
            <div className="px-3.5 py-3 text-sm text-text-tertiary">
              {error}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Waves, Star, Loader2 } from 'lucide-react';
import { searchSpots, type Spot } from '@/lib/spots';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesService, type Favorite } from '@/lib/favorites-service';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

interface SearchResult {
  kind: 'spot' | 'place';
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  key: string;
  isFavorite?: boolean;
}

interface SearchBarProps {
  onLocationSelect: (lat: number, lon: number, name: string) => void;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function spotToResult(spot: Spot): SearchResult {
  return {
    kind: 'spot',
    name: spot.name,
    subtitle: [spot.region, spot.country].filter(Boolean).join(', '),
    lat: spot.latitude,
    lon: spot.longitude,
    key: `spot-${spot.id}`,
  };
}

function favoriteToResult(fav: Favorite): SearchResult {
  return {
    kind: 'spot',
    name: fav.name,
    subtitle: [fav.region, fav.country].filter(Boolean).join(', ') || 'Saved spot',
    lat: fav.lat,
    lon: fav.lng,
    key: `fav-${fav.id}`,
    isFavorite: true,
  };
}

function nominatimToResult(r: NominatimResult): SearchResult {
  const parts = r.display_name.split(',');
  return {
    kind: 'place',
    name: parts[0].trim(),
    subtitle: parts.slice(1, 3).map(s => s.trim()).join(', '),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    key: `place-${r.place_id}`,
  };
}

export default function SearchBar({ onLocationSelect }: SearchBarProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [spotResults, setSpotResults] = useState<SearchResult[]>([]);
  const [placeResults, setPlaceResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExplicitSearch, setIsExplicitSearch] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const allResults = [...spotResults, ...placeResults];

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);

    // Run spot search, favorites search, and Nominatim in parallel
    const spotPromise = Promise.all([
      searchSpots(searchQuery, 5),
      favoritesService.getFavorites(user?.id || null),
    ]).then(([spots, favorites]) => {
      if (signal.aborted) return;

      const catalogResults = spots.map(spotToResult);

      // Filter favorites by search query (case-insensitive)
      const q = searchQuery.toLowerCase();
      const favResults = favorites
        .filter(f => f.name.toLowerCase().includes(q))
        .map(favoriteToResult);

      // Merge: favorites first, then catalog spots (deduplicate by proximity)
      const merged = [...favResults];
      for (const cr of catalogResults) {
        const isDupe = merged.some(
          m => Math.abs(m.lat - cr.lat) < 0.01 && Math.abs(m.lon - cr.lon) < 0.01
        );
        if (!isDupe) merged.push(cr);
      }

      setSpotResults(merged.slice(0, 8));
      if (merged.length > 0) setShowDropdown(true);
    }).catch(() => {
      if (!signal.aborted) setSpotResults([]);
    });

    const placePromise = fetch(
      `${NOMINATIM_URL}?${new URLSearchParams({ q: searchQuery, format: 'json', limit: '5', addressdetails: '1' })}`,
      { headers: { 'User-Agent': 'Sandbars Surf Forecast App' }, signal },
    ).then(async r => {
      if (!r.ok) throw new Error('Search failed');
      const data: NominatimResult[] = await r.json();
      if (!signal.aborted) {
        setPlaceResults(data.map(nominatimToResult));
      }
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!signal.aborted) setPlaceResults([]);
    });

    await Promise.all([spotPromise, placePromise]);

    if (!signal.aborted) {
      setShowDropdown(true);
      setIsLoading(false);
    }
  }, []);

  // Debounced search-as-you-type
  useEffect(() => {
    if (query.length < 2) {
      setSpotResults([]);
      setPlaceResults([]);
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
  }, [spotResults, placeResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        if (!showDropdown || allResults.length === 0) return;
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < allResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        if (!showDropdown || allResults.length === 0) return;
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && allResults[selectedIndex]) {
          handleResultClick(allResults[selectedIndex]);
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
    onLocationSelect(result.lat, result.lon, result.name);
    setQuery(result.name);
    setShowDropdown(false);
    setSpotResults([]);
    setPlaceResults([]);
  };

  const hasResults = allResults.length > 0;
  const showEmpty = !isLoading && !hasResults && isExplicitSearch;

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
          onFocus={() => hasResults && setShowDropdown(true)}
          placeholder="Search spots or places..."
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

      {/* Results Dropdown */}
      {showDropdown && (hasResults || isLoading || showEmpty) && (
        <>
          {/* Backdrop for outside clicks */}
          <div
            className="fixed inset-0 z-[5]"
            onClick={(e) => { e.stopPropagation(); setShowDropdown(false); }}
          />
          <div
            data-testid="search-results"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-md shadow-sm border border-border overflow-hidden z-10 max-h-[360px] overflow-y-auto"
          >
            {/* Surf Spots section */}
            {spotResults.length > 0 && (
              <>
                <div className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Surf Spots
                </div>
                {spotResults.map((result) => {
                  const idx = allResults.indexOf(result);
                  return (
                    <button
                      key={result.key}
                      data-testid="search-result-item"
                      role="option"
                      aria-selected={idx === selectedIndex}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={[
                        'flex items-start gap-2.5 w-full px-3.5 py-2.5 border-none text-left cursor-pointer text-sm transition-colors duration-100 min-h-[44px]',
                        idx === selectedIndex ? 'bg-surface-secondary' : 'bg-transparent',
                      ].join(' ')}
                    >
                      {result.isFavorite ? (
                        <Star className="h-3.5 w-3.5 text-accent fill-accent shrink-0 mt-0.5" strokeWidth={1.5} />
                      ) : (
                        <Waves className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary truncate">{result.name}</div>
                        {result.subtitle && (
                          <div className="text-xs text-text-tertiary truncate">{result.subtitle}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {/* Divider between sections */}
            {spotResults.length > 0 && placeResults.length > 0 && (
              <div className="border-t border-border" />
            )}

            {/* Places section */}
            {placeResults.length > 0 && (
              <>
                <div className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Places
                </div>
                {placeResults.map((result) => {
                  const idx = allResults.indexOf(result);
                  return (
                    <button
                      key={result.key}
                      data-testid="search-result-item"
                      role="option"
                      aria-selected={idx === selectedIndex}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={[
                        'flex items-start gap-2.5 w-full px-3.5 py-2.5 border-none text-left cursor-pointer text-sm transition-colors duration-100 min-h-[44px]',
                        idx === selectedIndex ? 'bg-surface-secondary' : 'bg-transparent',
                      ].join(' ')}
                    >
                      <MapPin className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary truncate">{result.name}</div>
                        {result.subtitle && (
                          <div className="text-xs text-text-tertiary truncate">{result.subtitle}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {/* Loading state */}
            {isLoading && !hasResults && (
              <div className="px-3.5 py-3 text-sm text-text-secondary flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div className="px-3.5 py-3 text-sm text-text-tertiary">
                No spots or places found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

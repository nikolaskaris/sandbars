'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Cancel any in-flight request
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
        return; // Request was cancelled, ignore
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
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 320,
      }}
    >
      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          data-testid="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search locations..."
          style={{
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            fontFamily: 'system-ui, sans-serif',
            color: '#333',
          }}
        />
        <button
          onClick={() => { setIsExplicitSearch(true); performSearch(query); }}
          disabled={isLoading || !query.trim()}
          style={{
            padding: '10px 14px',
            border: 'none',
            background: 'transparent',
            cursor: isLoading || !query.trim() ? 'default' : 'pointer',
            opacity: isLoading || !query.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Search"
        >
          {isLoading ? (
            <span style={{ fontSize: 12, color: '#666' }}>Searching...</span>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#666"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </button>
      </div>

      {/* Results Dropdown */}
      {showDropdown && (results.length > 0 || isLoading || (error && isExplicitSearch)) && (
        <div
          data-testid="search-results"
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {results.map((result, index) => (
            <button
              key={result.place_id}
              data-testid="search-result-item"
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleResultClick(result)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                background: index === selectedIndex ? '#f0f0f0' : 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif',
                borderBottom: '1px solid #eee',
              }}
              onMouseEnter={(e) => {
                setSelectedIndex(index);
                e.currentTarget.style.background = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 2, color: '#333' }}>
                {formatResultName(result.display_name)}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>
                {result.type}
              </div>
            </button>
          ))}
          {isLoading && results.length === 0 && (
            <div
              style={{
                padding: '12px 14px',
                color: '#666',
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Searching...
            </div>
          )}
          {error && !isLoading && isExplicitSearch && results.length === 0 && (
            <div
              style={{
                padding: '12px 14px',
                color: '#666',
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

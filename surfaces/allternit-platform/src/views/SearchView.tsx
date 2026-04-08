'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlass,
  Clock,
  FileText,
  Code,
  BookOpen,
  X,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'History' | 'Files' | 'Code' | 'Documents';
  timestamp: string;
  icon: React.ReactNode;
}

interface RecentSearch {
  id: string;
  query: string;
}

interface SearchSuggestion {
  id: string;
  label: string;
}

type FilterType = 'All' | 'History' | 'Files' | 'Code' | 'Documents';

const recentSearches: RecentSearch[] = [];
const searchSuggestions: SearchSuggestion[] = [];

const getCategoryIcon = (category: FilterType) => {
  switch (category) {
    case 'History':
      return <Clock size={16} />;
    case 'Files':
      return <FileText size={16} />;
    case 'Code':
      return <Code size={16} />;
    case 'Documents':
      return <BookOpen size={16} />;
    default:
      return <MagnifyingGlass size={16} />;
  }
};


export function SearchView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const filters: FilterType[] = ['All', 'History', 'Files', 'Code', 'Documents'];

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);
      // TODO: wire to real search API endpoint
      setSearchResults([]);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleSearchClear();
      }
    },
    [handleSearchClear]
  );

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
  };

  const getFilteredResults = () => {
    if (activeFilter === 'All') {
      return searchResults;
    }
    return searchResults.filter((result) => result.category === activeFilter);
  };

  const groupedResults = getFilteredResults().reduce(
    (groups, result) => {
      const category = result.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(result);
      return groups;
    },
    {} as Record<FilterType, SearchResult[]>
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: `var(--bg-primary)`,
        color: `var(--text-primary)`,
      }}
    >
      <GlassSurface className="flex-shrink-0 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Search Input */}
          <div
            className="relative mb-4"
            style={{
              borderRadius: '8px',
              border: `1px solid var(--border-subtle)`,
              backgroundColor: `var(--bg-secondary)`,
            }}
          >
            <div className="flex items-center px-4 py-3">
              <MagnifyingGlass size={20} style={{ color: `var(--text-secondary)` }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search conversations, files, code, docs..."
                className="flex-1 ml-3 bg-transparent outline-none text-base"
                style={{
                  color: `var(--text-primary)`,
                  fontSize: '16px',
                  padding: '12px 0',
                }}
              />
              {searchQuery && (
                <button
                  onClick={handleSearchClear}
                  className="ml-2 p-1 hover:opacity-70 transition-opacity"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 flex-wrap">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  backgroundColor:
                    activeFilter === filter
                      ? `var(--accent-primary)`
                      : `var(--bg-secondary)`,
                  color:
                    activeFilter === filter
                      ? '#000'
                      : `var(--text-secondary)`,
                  border:
                    activeFilter === filter
                      ? 'none'
                      : `1px solid var(--border-subtle)`,
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </GlassSurface>

      {/* Content Area */}
      <div
        className="flex-1 overflow-y-auto p-6"
        style={{
          backgroundColor: `var(--bg-primary)`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          {!isSearching ? (
            <>
              {/* Recent Searches */}
              <div className="mb-8">
                <h2
                  className="text-sm font-semibold mb-4"
                  style={{
                    color: `var(--text-secondary)`,
                  }}
                >
                  Recent Searches
                </h2>
                <div className="space-y-2">
                  {recentSearches.map((search) => (
                    <button
                      key={search.id}
                      onClick={() => handleRecentSearchClick(search.query)}
                      className="w-full text-left p-3 rounded-lg transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: `var(--bg-secondary)`,
                        borderBottom: `1px solid var(--border-subtle)`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Clock
                          size={16}
                          style={{
                            color: `var(--text-secondary)`,
                          }}
                        />
                        <span style={{ color: `var(--text-primary)` }}>
                          {search.query}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Suggestions */}
              <div>
                <h2
                  className="text-sm font-semibold mb-4"
                  style={{
                    color: `var(--text-secondary)`,
                  }}
                >
                  Search Suggestions
                </h2>
                <div className="flex flex-wrap gap-2">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion.label)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all hover:opacity-80"
                      style={{
                        backgroundColor: `var(--bg-secondary)`,
                        color: `var(--text-secondary)`,
                        border: `1px solid var(--border-subtle)`,
                      }}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Search Results */}
              {Object.entries(groupedResults).length > 0 ? (
                <div className="space-y-8">
                  {Object.entries(groupedResults).map(([category, results]) => (
                    <div key={category}>
                      <h3
                        className="text-sm font-semibold mb-3"
                        style={{
                          color: `var(--text-secondary)`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {results.map((result) => (
                          <div
                            key={result.id}
                            className="p-4 rounded-lg transition-colors hover:opacity-80 cursor-pointer"
                            style={{
                              backgroundColor: `var(--bg-secondary)`,
                              borderBottom: `1px solid var(--border-subtle)`,
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div
                                  style={{
                                    color: `var(--accent-primary)`,
                                    marginTop: '2px',
                                  }}
                                >
                                  {result.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="font-medium"
                                    style={{
                                      color: `var(--text-primary)`,
                                    }}
                                  >
                                    {result.title}
                                  </p>
                                  <p
                                    className="text-xs mt-1"
                                    style={{
                                      color: `var(--text-tertiary)`,
                                    }}
                                  >
                                    {result.subtitle}
                                  </p>
                                </div>
                              </div>
                              <span
                                className="text-xs flex-shrink-0"
                                style={{
                                  color: `var(--text-tertiary)`,
                                }}
                              >
                                {result.timestamp}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-12"
                  style={{
                    color: `var(--text-secondary)`,
                  }}
                >
                  <MagnifyingGlass size={32} className="mx-auto mb-3 opacity-50" />
                  <p>No results found for "{searchQuery}"</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchView;

import { create } from 'zustand';
import type { SearchResult } from '../types';

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  recentSearches: string[];
  selectedFilters: string[];
}

interface SearchStore extends SearchState {
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  toggleFilter: (filter: string) => void;
  clearFilters: () => void;
}

const MAX_RECENT_SEARCHES = 10;

export const useSearchStore = create<SearchStore>((set, _get) => ({
  query: '',
  results: [],
  isSearching: false,
  recentSearches: [],
  selectedFilters: [],

  setQuery: (query: string) => set({ query }),
  
  setResults: (results: SearchResult[]) => set({ results }),
  
  setIsSearching: (isSearching: boolean) => set({ isSearching }),

  addRecentSearch: (query: string) => {
    if (!query.trim()) return;
    
    set((state) => {
      const filtered = state.recentSearches.filter((s) => s !== query);
      return {
        recentSearches: [query, ...filtered].slice(0, MAX_RECENT_SEARCHES),
      };
    });
  },

  clearRecentSearches: () => set({ recentSearches: [] }),

  toggleFilter: (filter: string) => {
    set((state) => ({
      selectedFilters: state.selectedFilters.includes(filter)
        ? state.selectedFilters.filter((f) => f !== filter)
        : [...state.selectedFilters, filter],
    }));
  },

  clearFilters: () => set({ selectedFilters: [] }),
}));

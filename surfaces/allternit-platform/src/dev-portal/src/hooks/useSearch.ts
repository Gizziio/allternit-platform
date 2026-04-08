import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import Fuse from 'fuse.js';
import { useSearchStore } from '../store/searchStore';
import type { SearchResult } from '../types';
import { searchIndex } from '../data/searchIndex';

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'content', weight: 0.3 },
    { name: 'excerpt', weight: 0.2 },
    { name: 'tags', weight: 0.1 },
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};

export function useSearch() {
  const { query, selectedFilters } = useSearchStore();

  const fuse = useMemo(() => {
    return new Fuse(searchIndex, FUSE_OPTIONS);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', query, selectedFilters],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query.trim()) {
        return [];
      }

      // Simulate network delay for realistic feel
      await new Promise((resolve) => setTimeout(resolve, 150));

      const searchResults = fuse.search(query);
      
      let filtered = searchResults.map((result) => ({
        ...result.item,
        score: result.score || 0,
      }));

      // Apply type filters
      if (selectedFilters.length > 0) {
        filtered = filtered.filter((item) => 
          selectedFilters.includes(item.type)
        );
      }

      return filtered.slice(0, 20);
    },
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  return {
    results: results || [],
    isLoading,
    hasResults: (results?.length || 0) > 0,
    totalResults: results?.length || 0,
  };
}

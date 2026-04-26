'use client';

import { useState, useEffect, useRef } from 'react';
import type { Publication } from '@/types/publication';
import {
  mapPublicationToDiscoveryItem,
  getHeroPriority,
  type DiscoveryItem,
} from './usePublicationMapper';

const POLL_INTERVAL_MS = 60_000;

export interface DiscoveryFeedState {
  heroItems: DiscoveryItem[];
  allItems: DiscoveryItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useDiscoveryFeed(): DiscoveryFeedState {
  const [state, setState] = useState<DiscoveryFeedState>({
    heroItems: [],
    allItems: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchFeed = async () => {
    try {
      const res = await fetch('/api/v1/discovery/feed');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw: Publication[] = await res.json();

      const published = raw.filter(p => p.status === 'published');

      const heroItems = [...published]
        .sort((a, b) => getHeroPriority(b) - getHeroPriority(a))
        .slice(0, 5)
        .map(mapPublicationToDiscoveryItem);

      const allItems = [...published]
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? b.createdAt).getTime() -
            new Date(a.publishedAt ?? a.createdAt).getTime(),
        )
        .map(mapPublicationToDiscoveryItem);

      setState({
        heroItems,
        allItems,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  };

  useEffect(() => {
    fetchFeed();
    timerRef.current = setInterval(fetchFeed, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  return state;
}

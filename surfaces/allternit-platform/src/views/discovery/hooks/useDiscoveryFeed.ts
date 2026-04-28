'use client';

import { useState, useEffect, useRef } from 'react';
import type { Publication } from '@/types/publication';
import { publications as seedPublications } from '@/data/research-content';
import {
  mapPublicationToDiscoveryItem,
  type DiscoveryItem,
} from './usePublicationMapper';

const POLL_INTERVAL_MS = 60_000;

// Static export fallback: load from public/discovery-feed.json
const STATIC_FEED_URL = '/discovery-feed.json';
// Remote fallback for desktop app: fetch fresh briefings from the live site
const REMOTE_FEED_URL = 'https://allternit.com/discovery-feed.json';

export interface DiscoveryFeedState {
  heroItems: DiscoveryItem[];
  allItems: DiscoveryItem[];
  publications: Publication[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

function getHeroPriority(item: DiscoveryItem): number {
  const TYPE_SCORE: Record<string, number> = {
    publication: 80,
    research: 70,
    article: 40,
    video: 30,
    gallery: 20,
  };

  let score = TYPE_SCORE[item.type] ?? 0;

  if (item.badge === 'Annual Report') score += 50;
  if (item.badge === 'Quarterly Index') score += 40;
  if (item.badge === 'Weekly Feature') score += 30;
  if (item.badge === 'Daily Brief') score += 25;

  return score;
}

async function loadPublications(): Promise<Publication[]> {
  // Try API route first (works in dev / standalone server mode)
  try {
    const apiRes = await fetch('/api/v1/discovery/feed');
    if (apiRes.ok) {
      const raw: Publication[] = await apiRes.json();
      return raw;
    }
  } catch {
    // API route unavailable (static export) — fall through
  }

  // Fallback 2: load static JSON feed (works on Cloudflare Pages / static export)
  try {
    const staticRes = await fetch(STATIC_FEED_URL);
    if (staticRes.ok) {
      const raw: Publication[] = await staticRes.json();
      return raw;
    }
  } catch {
    // Static feed unavailable — try remote
  }

  // Fallback 3: fetch from live site (desktop app always gets fresh briefings)
  try {
    const remoteRes = await fetch(REMOTE_FEED_URL, { cache: 'no-store' });
    if (remoteRes.ok) {
      const raw: Publication[] = await remoteRes.json();
      return raw;
    }
  } catch {
    // Remote unavailable — use seed data
  }

  return seedPublications;
}

export function useDiscoveryFeed(): DiscoveryFeedState {
  const [state, setState] = useState<DiscoveryFeedState>({
    heroItems: [],
    allItems: [],
    publications: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchFeed = async () => {
    try {
      const raw = await loadPublications();
      const published = raw.filter(p => p.status === 'published');
      const pubItems = published.map(mapPublicationToDiscoveryItem);

      const heroItems = [...pubItems]
        .sort((a, b) => getHeroPriority(b) - getHeroPriority(a))
        .slice(0, 5);

      setState({
        heroItems,
        allItems: pubItems,
        publications: published,
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

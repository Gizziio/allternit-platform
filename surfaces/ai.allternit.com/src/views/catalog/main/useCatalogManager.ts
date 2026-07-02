"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { 
  UdemyPublicCourse, 
  TierFilter, 
  PriceFilter, 
  LevelFilter 
} from './CatalogView.types';
import { A2LABS_CATEGORIES, CURATED_KEY } from './CatalogView.constants';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useCatalogManager');

export function useCatalogManager() {
  const [courses, setCourses] = useState<UdemyPublicCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('free');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [curatedCourses, setCuratedCourses] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['CORE', 'OPS', 'AGENTS']));
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [view, setView] = useState<'search' | 'browse' | 'curated'>('browse');
  const [selectedCourse, setSelectedCourse] = useState<UdemyPublicCourse | null>(null);

  // Load curated courses
  useEffect(() => {
    const saved = localStorage.getItem(CURATED_KEY);
    if (saved) {
      try {
        setCuratedCourses(new Set(JSON.parse(saved)));
      } catch (e) {
        logger.error({ err: e }, 'Failed to load curated courses:');
      }
    }
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const saveCurated = useCallback((ids: Set<number>) => {
    setCuratedCourses(ids);
    localStorage.setItem(CURATED_KEY, JSON.stringify([...ids]));
  }, []);

  const toggleCurated = useCallback((course: UdemyPublicCourse) => {
    const newCurated = new Set(curatedCourses);
    if (newCurated.has(course.id)) {
      newCurated.delete(course.id);
      showNotification(`Removed: ${course.title}`);
    } else {
      newCurated.add(course.id);
      showNotification(`✓ Curated for A://Labs: ${course.title}`);
    }
    saveCurated(newCurated);
  }, [curatedCourses, saveCurated, showNotification]);

  const searchCourses = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/udemy/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          page: 1,
          pageSize: 50,
          price: priceFilter,
          level: levelFilter === 'all' ? undefined : levelFilter,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setCourses(data.results || []);
      setView('search');
      showNotification(`Found ${data.count || 0} courses`);
    } catch (err: any) {
      logger.error({ err }, 'Search failed:');
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [priceFilter, levelFilter, showNotification]);

  const browseCategory = useCallback(async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setLoading(true);

    try {
      const category = A2LABS_CATEGORIES.find(c => c.id === categoryId);
      if (!category) {
        showNotification(`Unknown category: ${categoryId}`);
        return;
      }

      const query = category.searchQueries[0];
      
      const response = await fetch('/api/v1/udemy/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          page: 1,
          pageSize: 50,
          price: priceFilter,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      setCourses(data.results || []);
      setView('search');
      showNotification(`${category.label}: ${data.count || 0} courses`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [priceFilter, showNotification]);

  const toggleCategoryGroup = useCallback((tier: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(tier)) {
      newExpanded.delete(tier);
    } else {
      newExpanded.add(tier);
    }
    setExpandedCategories(newExpanded);
  }, [expandedCategories]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      if (levelFilter !== 'all' && course.level !== levelFilter && course.level !== 'All Levels') {
        return false;
      }
      if (priceFilter === 'free' && course.is_paid) {
        return false;
      }
      return true;
    });
  }, [courses, levelFilter, priceFilter]);

  return {
    courses,
    loading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    tierFilter,
    setTierFilter,
    priceFilter,
    setPriceFilter,
    levelFilter,
    setLevelFilter,
    curatedCourses,
    expandedCategories,
    error,
    setError,
    notification,
    showNotification,
    view,
    setView,
    selectedCourse,
    setSelectedCourse,
    toggleCurated,
    searchCourses,
    browseCategory,
    toggleCategoryGroup,
    filteredCourses,
  };
}

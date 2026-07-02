"use client";

import { useState, useCallback, useMemo } from 'react';
import type { MarketplaceItem, MarketplaceCategory } from './Marketplace.types';

const INITIAL_ITEMS: MarketplaceItem[] = [
  {
    id: 'agent-researcher-pro',
    name: 'Advanced Web Researcher',
    description: 'Specialized agent for deep technical research and data verification.',
    type: 'agent',
    author: 'Allternit Labs',
    rating: 4.8,
    installs: 12400,
    price: 'free',
    icon: '🕵️',
    category: 'agents',
    tags: ['research', 'web', 'data'],
  },
  {
    id: 'plugin-github-manager',
    name: 'GitHub Suite',
    description: 'Manage issues, PRs, and repository settings directly through Allternit.',
    type: 'plugin',
    author: 'DevTools Co',
    rating: 4.6,
    installs: 8900,
    price: 'free',
    icon: '🐙',
    category: 'plugins',
    tags: ['git', 'code', 'collaboration'],
  },
  {
    id: 'workflow-hiring-pipeline',
    name: 'Talent Acquisition Pipeline',
    description: 'Pre-configured DAG for managing candidate screening and technical reviews.',
    type: 'workflow',
    author: 'HR Automation',
    rating: 4.9,
    installs: 3200,
    price: 'enterprise',
    icon: '👥',
    category: 'workflows',
    tags: ['hr', 'recruitment', 'dag'],
  },
  {
    id: 'pack-financial-analysis',
    name: 'Finance Intelligence Pack',
    description: 'Comprehensive set of agents and tools for market analysis and reporting.',
    type: 'pack',
    author: 'Quant Labs',
    rating: 4.7,
    installs: 1500,
    price: 'paid',
    icon: '📈',
    category: 'knowledge',
    tags: ['finance', 'reporting', 'analysis'],
  },
];

export function useMarketplaceManager() {
  const [items] = useState<MarketplaceItem[]>(INITIAL_ITEMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>('all');
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  }, []);

  const handleInstall = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    notify(`Added ${item?.name || 'item'} to your workspace`);
  }, [items, notify]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, activeCategory]);

  return {
    items,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    showNotification,
    filteredItems,
    handleInstall,
  };
}

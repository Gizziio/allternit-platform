"use client";

import { useState, useCallback, useMemo } from 'react';
import type { Extension, ExtensionCategory } from './BrowserExtensions.types';

const INITIAL_EXTENSIONS: Extension[] = [
  {
    id: 'ai-page-analyzer',
    name: 'AI Page Analyzer',
    description: 'Deep structural analysis of webpage content for agentic extraction.',
    version: '1.2.4',
    icon: '🔍',
    author: 'Allternit Labs',
    category: 'ai',
    isInstalled: true,
    isEnabled: true,
    permissions: ['activeTab', 'storage'],
  },
  {
    id: 'form-automator',
    name: 'Smart Form Automator',
    description: 'Auto-detects and fills complex multi-step forms using agent context.',
    version: '0.9.1',
    icon: '📝',
    author: 'Allternit Labs',
    category: 'automation',
    isInstalled: true,
    isEnabled: false,
    permissions: ['activeTab', 'webNavigation'],
  },
  {
    id: 'mcp-bridge',
    name: 'MCP Browser Bridge',
    description: 'Exposes browser tabs as MCP resources to the local agent runtime.',
    version: '2.1.0',
    icon: '🌉',
    author: 'Anthropic',
    category: 'utilities',
    isInstalled: false,
    isEnabled: false,
    permissions: ['tabs', 'nativeMessaging'],
  },
  {
    id: 'tab-grouper',
    name: 'Focus Tab Grouper',
    description: 'Automatically organize tabs based on current research goals.',
    version: '1.0.5',
    icon: '📁',
    author: 'Community',
    category: 'productivity',
    isInstalled: false,
    isEnabled: false,
    permissions: ['tabs'],
  },
];

export function useExtensionsManager() {
  const [extensions, setExtensions] = useState<Extension[]>(INITIAL_EXTENSIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExtensionCategory>('all');
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExtensions(prev => prev.map(ext => {
      if (ext.id !== id) return ext;
      const nextState = !ext.isEnabled;
      notify(`${ext.name} ${nextState ? 'enabled' : 'disabled'}`);
      return { ...ext, isEnabled: nextState };
    }));
  }, [notify]);

  const handleInstall = useCallback((id: string) => {
    setExtensions(prev => prev.map(ext => {
      if (ext.id !== id) return ext;
      notify(`Installed ${ext.name}`);
      return { ...ext, isInstalled: true, isEnabled: true };
    }));
  }, [notify]);

  const handleUninstall = useCallback((id: string) => {
    setExtensions(prev => prev.map(ext => {
      if (ext.id !== id) return ext;
      notify(`Uninstalled ${ext.name}`);
      return { ...ext, isInstalled: false, isEnabled: false };
    }));
  }, [notify]);

  const filteredExtensions = useMemo(() => {
    return extensions.filter(ext => {
      const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ext.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || ext.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [extensions, searchQuery, activeCategory]);

  return {
    extensions,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    showNotification,
    filteredExtensions,
    handleToggle,
    handleInstall,
    handleUninstall,
  };
}

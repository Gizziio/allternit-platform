"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBrowserExtensionsStore } from '@/capsules/browser/browserExtensions.store';
import type { ExtensionCategory } from './BrowserExtensions.types';

export function useExtensionsManager() {
  const extensions = useBrowserExtensionsStore((state) => state.extensions);
  const toggleExtension = useBrowserExtensionsStore((state) => state.toggleExtension);
  const updateExtension = useBrowserExtensionsStore((state) => state.updateExtension);
  const removeExtension = useBrowserExtensionsStore((state) => state.removeExtension);
  const addExtension = useBrowserExtensionsStore((state) => state.addExtension);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExtensionCategory>('all');
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setShowNotification(message);
    window.setTimeout(() => setShowNotification(null), 3000);
  }, []);

  useEffect(() => {
    const api = window.allternit?.officeAddins;
    if (!api) return;
    void api.getStatus().then((statuses) => {
      (['word', 'excel', 'powerpoint'] as const).forEach((host) => {
        const status = statuses[host];
        updateExtension(`allternit-office-${host}`, {
          installStatus: status.health === 'installed' ? 'installed' : status.health === 'update-available' || status.health === 'needs-repair' ? 'error' : 'not-installed',
        });
      });
    }).catch(() => undefined);
  }, [updateExtension]);

  const handleToggle = useCallback((id: string) => {
    const extension = extensions.find((item) => item.id === id);
    if (!extension) return;
    toggleExtension(id);
    notify(`${extension.name} ${extension.enabled ? 'disabled' : 'enabled in the browser toolbar'}`);
  }, [extensions, notify, toggleExtension]);

  const handleInstall = useCallback((id: string) => {
    const extension = extensions.find((item) => item.id === id);
    if (!extension) return;
    if (extension.officeHost) {
      const viewType = extension.officeHost === 'word' ? 'addin-word' : extension.officeHost === 'excel' ? 'addin-excel' : 'addin-ppt';
      window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType } }));
      notify(`Opened ${extension.name} developer setup`);
      return;
    }
    updateExtension(id, { installStatus: 'installed', enabled: true });
    notify(`Installed and enabled ${extension.name}`);
  }, [extensions, notify, updateExtension]);

  const handleUninstall = useCallback((id: string) => {
    const extension = extensions.find((item) => item.id === id);
    if (!extension) return;
    if (extension.owned) {
      updateExtension(id, { enabled: false });
      notify(`${extension.name} disabled`);
      return;
    }
    removeExtension(id);
    notify(`Uninstalled ${extension.name}`);
  }, [extensions, notify, removeExtension, updateExtension]);

  const normalized = useMemo(() => extensions.map((extension) => ({
    ...extension,
    author: extension.author || (extension.owned ? 'Allternit' : 'Community'),
    category: extension.category || 'utilities',
    isInstalled: extension.installStatus === 'installed',
    isEnabled: extension.enabled,
    permissions: Object.keys(extension.permissions || {}),
    permissionDetails: extension.permissions,
  })), [extensions]);

  const filteredExtensions = useMemo(() => normalized.filter((extension) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || extension.name.toLowerCase().includes(query) || extension.description.toLowerCase().includes(query);
    const matchesCategory = activeCategory === 'all' || extension.category === activeCategory;
    return matchesSearch && matchesCategory;
  }), [activeCategory, normalized, searchQuery]);

  const addCustomExtension = useCallback((input: { name: string; description: string; icon?: string; storeUrl?: string }) => {
    addExtension({ name: input.name, description: input.description, icon: input.icon || 'E', version: '1.0.0', author: 'Custom', category: 'utilities', enabled: true, installStatus: 'installed', storeUrl: input.storeUrl, permissions: {} });
    notify(`Added and enabled ${input.name}`);
  }, [addExtension, notify]);

  const installMarketplaceExtension = useCallback((extension: { name: string; description: string; icon: string; version: string; author: string; category: Exclude<ExtensionCategory, 'all'>; storeUrl?: string }) => {
    const existing = extensions.find((item) => item.name === extension.name);
    if (existing) { updateExtension(existing.id, { installStatus: 'installed', enabled: true }); return; }
    addExtension({ ...extension, enabled: true, installStatus: 'installed', permissions: {} });
    notify(`Installed and enabled ${extension.name}`);
  }, [addExtension, extensions, notify, updateExtension]);

  return { extensions: normalized, searchQuery, setSearchQuery, activeCategory, setActiveCategory, showNotification, filteredExtensions, handleToggle, handleInstall, handleUninstall, addCustomExtension, installMarketplaceExtension };
}

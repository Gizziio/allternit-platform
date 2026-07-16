"use client";

import React, { useState } from 'react';
import {
  PuzzlePiece,
  MagnifyingGlass,
  Plus,
  ArrowSquareOut,
  Storefront,
} from '@phosphor-icons/react';
import { useExtensionsManager } from './browser-extensions/main/useExtensionsManager';
import { ExtensionCard } from './browser-extensions/main/ExtensionCard';
import { EmptyState } from '@/components/settings/EmptyState';
import { cn } from '@/lib/utils';
import type { ExtensionCategory } from './browser-extensions/main/BrowserExtensions.types';
import type { Extension } from './browser-extensions/main/BrowserExtensions.types';
import { ExtensionDetailView } from './browser-extensions/main/ExtensionDetailView';
import { EXTENSION_MARKETPLACE } from './browser-extensions/main/extension-marketplace';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from '@/components/ui/Modal';

export function BrowserExtensionsView() {
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [selectedMarketplaceExtension, setSelectedMarketplaceExtension] = useState<Extension | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const {
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
    addCustomExtension,
    installMarketplaceExtension,
  } = useExtensionsManager();

  const categories: { id: ExtensionCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'automation', label: 'Automation' },
    { id: 'ai', label: 'AI Powered' },
    { id: 'utilities', label: 'Utilities' },
    { id: 'office', label: 'Office' },
  ];
  const selectedExtension = selectedMarketplaceExtension ?? filteredExtensions.find((extension) => extension.id === selectedExtensionId)
    ?? extensions.find((extension) => extension.id === selectedExtensionId);

  if (selectedExtension) {
    return <ExtensionDetailView extension={selectedExtension as Extension} onBack={() => { setSelectedExtensionId(null); setSelectedMarketplaceExtension(null); }} onToggle={handleToggle} onInstall={(id) => { if (selectedMarketplaceExtension) installMarketplaceExtension(selectedMarketplaceExtension); else handleInstall(id); }} onUninstall={(id) => { handleUninstall(id); if (!selectedExtension.owned) setSelectedExtensionId(null); }} />;
  }

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-6 right-6 z-[100] p-3 px-5 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] shadow-2xl animate-in slide-in-from-right-4 duration-300">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{showNotification}</span>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="m-0 text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Extensions</h1>
          <button
            type="button"
            onClick={() => setShowMarketplace((value) => !value)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
          >
            <Storefront size={16} />
            {showMarketplace ? 'My Extensions' : 'Marketplace'}
          </button>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
          >
            <Plus size={16} weight="bold" />
            Upload Extension
          </button>
        </div>

        <div className="relative mt-6">
            <MagnifyingGlass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              aria-label="Search extensions"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search installed and available extensions…"
              className="h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
            />
        </div>

          <div className="mt-4 flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-3">
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                  activeCategory === cat.id
                    ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
      <div className="mt-8">
        {showMarketplace ? (
          <div>
            <div className="mb-5"><h2 className="text-lg font-semibold">Extension Marketplace</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Install curated browser capabilities into Allternit.</p></div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {EXTENSION_MARKETPLACE.map((extension) => <ExtensionCard key={extension.id} extension={extension} onOpen={() => setSelectedMarketplaceExtension(extension)} onToggle={() => undefined} onUninstall={() => undefined} onInstall={() => installMarketplaceExtension(extension)} />)}
            </div>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <EmptyState
              icon={<PuzzlePiece size={64} weight="thin" />}
              title="No extensions found"
              caption={searchQuery || activeCategory !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'Install browser extensions to give your agent new capabilities.'}
              ctaLabel={searchQuery || activeCategory !== 'all' ? 'Clear filters' : 'Browse marketplace'}
              primaryCta
              onCtaClick={() => {
                if (searchQuery || activeCategory !== 'all') {
                  setSearchQuery('');
                  setActiveCategory('all');
                } else {
                  setShowMarketplace(true);
                }
              }}
              className="border-0 bg-transparent"
            />
            <div className="mt-4 max-w-[520px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-center">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-1">Build your own extensions</h3>
              <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-4 leading-relaxed">
                Our SDK allows you to create native browser extensions that interact with agent context, handle page automation, and surface unique tools.
              </p>
              <button
                type="button"
                onClick={() => window.open('https://allternit.com/developers', '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-1.5 text-[var(--accent-primary)] text-[13px] font-semibold bg-transparent border-none cursor-pointer hover:underline"
              >
                Open Developer Documentation <ArrowSquareOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredExtensions.map((ext) => (
              <ExtensionCard
                key={ext.id}
                extension={ext}
                onToggle={handleToggle}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onOpen={(extension) => setSelectedExtensionId(extension.id)}
              />
            ))}
          </div>
        )}
      </div>
      </div>
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} size="medium">
        <ModalHeader title="Upload extension" onClose={() => setShowUpload(false)} />
        <ModalBody><div className="space-y-4"><label className="block text-sm text-[var(--text-secondary)]">Name<input value={uploadName} onChange={(e) => setUploadName(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[var(--text-primary)] outline-none" /></label><label className="block text-sm text-[var(--text-secondary)]">Description<textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-[var(--text-primary)] outline-none" /></label><label className="block text-sm text-[var(--text-secondary)]">Package or store URL<input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="https://…" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[var(--text-primary)] outline-none" /></label></div></ModalBody>
        <ModalFooter><ModalButton variant="secondary" onClick={() => setShowUpload(false)}>Cancel</ModalButton><ModalButton variant="primary" disabled={!uploadName.trim()} onClick={() => { addCustomExtension({ name: uploadName.trim(), description: uploadDescription.trim() || 'Custom browser extension', storeUrl: uploadUrl.trim() || undefined }); setUploadName(''); setUploadDescription(''); setUploadUrl(''); setShowUpload(false); }}>Add extension</ModalButton></ModalFooter>
      </Modal>
    </div>
  );
}

export default BrowserExtensionsView;

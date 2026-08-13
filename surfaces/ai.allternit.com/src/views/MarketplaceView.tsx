"use client";

import React, { useState } from 'react';
import {
  Storefront,
  ArrowRight,
  PuzzlePiece,
  X,
} from '@phosphor-icons/react';
import { useCapabilityMarketplace } from './marketplace/main/useCapabilityMarketplace';
import {
  CapabilityCard,
  CapabilityDetail,
  CapabilitySearchBar,
  CheckoutModal,
} from '@/components/marketplace';
import type { CheckoutItem } from '@/components/marketplace';
import { EmptyState } from '@/components/settings/EmptyState';
import type { CapabilityCategory } from '@/components/marketplace/CapabilitySearchBar';

export function MarketplaceView() {
  const {
    capabilities,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    notification,
    getStatus,
    handleInstall,
    handleUninstall,
    handleDetails,
    selectedCapability,
    selectedCapabilityId,
    setSelectedCapabilityId,
  } = useCapabilityMarketplace();

  const [checkoutItem, setCheckoutItem] = useState<CheckoutItem | null>(null);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);

  const handleInstallClick = (id: string) => {
    const cap = capabilities.find((c) => c.id === id);
    if (!cap) return;

    if (cap.pricing === 'free') {
      handleInstall(id);
    } else {
      setCheckoutItem({
        id: cap.id,
        name: cap.name,
        author: cap.author,
        pricing: cap.pricing,
        amountCents: cap.amountCents,
        currency: cap.currency,
        icon: cap.icon,
      });
    }
  };

  const handleCheckoutConfirm = async (item: CheckoutItem) => {
    setIsCheckoutProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsCheckoutProcessing(false);
    setCheckoutItem(null);
    handleInstall(item.id);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--shell-view-bg)] relative overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-[100] p-3 px-5 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-subtle)] shadow-2xl animate-in slide-in-from-right-4 duration-300">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{notification}</span>
        </div>
      )}

      {/* Header */}
      <header className="px-8 py-7 shrink-0 border-b border-solid border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-[var(--accent-primary)]/10 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20">
              <Storefront size={28} weight="duotone" className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold m-0 tracking-tight text-[var(--text-primary)]">
                Capability Marketplace
              </h1>
              <p className="text-[14px] text-[var(--text-secondary)] mt-1 m-0">
                Discover and install skills, tools, plugins, and connectors for your workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.open('https://allternit.com/developers', '_blank', 'noopener,noreferrer')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
          >
            Developer portal <ArrowRight size={16} />
          </button>
        </div>

        {/* Search and Category Filter */}
        <CapabilitySearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 pb-20">
        {capabilities.length === 0 ? (
          <EmptyState
            icon={<PuzzlePiece size={64} weight="thin" />}
            title="No capabilities found"
            caption={
              searchQuery || activeCategory !== 'all'
                ? 'Try adjusting your filters or searching for something else in the Allternit directory.'
                : 'The marketplace is empty right now. Check back soon for new capabilities.'
            }
            ctaLabel="Clear filters"
            primaryCta
            onCtaClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="bg-[var(--bg-secondary)] rounded-2xl border border-solid border-[var(--border-subtle)]"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {capabilities.map((cap) => (
              <CapabilityCard
                key={cap.id}
                id={cap.id}
                name={cap.name}
                description={cap.description}
                author={cap.author}
                version={cap.version}
                kind={cap.kind}
                pricing={cap.pricing}
                rating={cap.rating}
                installCount={cap.installCount}
                icon={cap.icon}
                tags={cap.tags}
                status={getStatus(cap.id)}
                onInstall={handleInstallClick}
                onUninstall={handleUninstall}
                onDetails={handleDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedCapability && (
        <div className="fixed inset-0 z-[150] flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedCapabilityId(null)}
          />
          <div className="relative ml-auto w-full max-w-2xl bg-[var(--bg-elevated)] border-l border-solid border-[var(--border-subtle)] shadow-2xl animate-in slide-in-from-right-4 duration-300">
            <CapabilityDetail
              capability={{
                ...selectedCapability,
                longDescription: selectedCapability.longDescription,
                tools: selectedCapability.tools,
                permissions: selectedCapability.permissions,
              }}
              status={getStatus(selectedCapability.id)}
              onClose={() => setSelectedCapabilityId(null)}
              onInstall={handleInstallClick}
              onUninstall={handleUninstall}
            />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutItem && (
        <CheckoutModal
          item={checkoutItem}
          isOpen={true}
          onClose={() => setCheckoutItem(null)}
          onConfirm={handleCheckoutConfirm}
          isProcessing={isCheckoutProcessing}
        />
      )}
    </div>
  );
}

export default MarketplaceView;

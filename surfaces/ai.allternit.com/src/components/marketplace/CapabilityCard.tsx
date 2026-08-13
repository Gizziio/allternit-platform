'use client';

import React from 'react';
import { Star, DownloadSimple, Check, X, Loader2 } from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CapabilityPricing = 'free' | 'paid' | 'subscription' | 'enterprise';
export type CapabilityStatus = 'installed' | 'not-installed' | 'installing' | 'error';

export interface CapabilityCardProps {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  kind: string;
  pricing: CapabilityPricing;
  rating?: number;
  installCount?: number;
  icon?: string;
  tags?: string[];
  status: CapabilityStatus;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
  onDetails?: (id: string) => void;
  className?: string;
}

const pricingLabels: Record<CapabilityPricing, string> = {
  free: 'Free',
  paid: 'Paid',
  subscription: 'Subscription',
  enterprise: 'Enterprise',
};

const pricingVariants: Record<CapabilityPricing, 'default' | 'secondary' | 'outline'> = {
  free: 'secondary',
  paid: 'default',
  subscription: 'outline',
  enterprise: 'default',
};

export function CapabilityCard({
  id,
  name,
  description,
  author,
  version,
  kind,
  pricing,
  rating,
  installCount,
  icon,
  tags,
  status,
  onInstall,
  onUninstall,
  onDetails,
  className,
}: CapabilityCardProps) {
  const isInstalled = status === 'installed';
  const isInstalling = status === 'installing';

  return (
    <Card
      className={cn(
        'overflow-hidden bg-white/5 border-white/10 hover:border-white/20 transition-all duration-300 group h-full flex flex-col cursor-pointer',
        className,
      )}
      onClick={() => onDetails?.(id)}
    >
      <CardContent className="p-5 flex flex-col h-full">
        {/* Header: icon + title + pricing badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="size-12 rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0 border border-solid border-white/5 shadow-inner">
              {icon ? (
                <span className="text-2xl">{icon}</span>
              ) : (
                <span className="text-lg font-bold text-zinc-500">{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                {name}
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium truncate">
                by {author} • v{version}
              </p>
            </div>
          </div>

          <Badge variant={pricingVariants[pricing]} className="text-[9px] font-bold uppercase tracking-widest h-5">
            {pricingLabels[pricing]}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-[13px] text-zinc-400 leading-relaxed mb-4 line-clamp-3 flex-1">
          {description}
        </p>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 rounded border border-white/5"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-4">
          {rating !== undefined && (
            <div className="flex items-center gap-1.5">
              <Star size={14} weight="fill" className="text-yellow-500" />
              {rating.toFixed(1)}
            </div>
          )}
          {installCount !== undefined && (
            <div className="flex items-center gap-1.5">
              <DownloadSimple size={14} weight="bold" />
              {installCount.toLocaleString()}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 rounded">{kind}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          {isInstalled ? (
            <>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onUninstall?.(id);
                }}
                variant="outline"
                size="sm"
                className="flex-1 font-semibold h-9"
                disabled={isInstalling}
              >
                <X size={14} weight="bold" className="mr-1.5" />
                Uninstall
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onDetails?.(id);
                }}
                variant="ghost"
                size="sm"
                className="font-semibold h-9"
              >
                Details
              </Button>
            </>
          ) : (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onInstall?.(id);
              }}
              className="w-full font-bold h-9 bg-white/10 hover:bg-[var(--accent-primary)] hover:text-[var(--ui-text-inverse)] transition-all duration-300 border-none shadow-sm"
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <Loader2 size={14} weight="bold" className="mr-1.5 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Check size={14} weight="bold" className="mr-1.5" />
                  Add to Workspace
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

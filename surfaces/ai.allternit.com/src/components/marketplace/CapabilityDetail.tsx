'use client';

import React from 'react';
import { X, Star, DownloadSimple, Calendar, User, Tag, ArrowSquareOut, Shield, CircleNotch, Check } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CapabilityPricing, CapabilityStatus } from './CapabilityCard';

export interface CapabilityDetailData {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  author: string;
  version: string;
  kind: string;
  pricing: CapabilityPricing;
  rating?: number;
  installCount?: number;
  icon?: string;
  tags?: string[];
  repository?: string;
  homepage?: string;
  license?: string;
  permissions?: Array<{
    resource: string;
    access: string;
    description: string;
  }>;
  tools?: Array<{
    name: string;
    description: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CapabilityDetailProps {
  capability: CapabilityDetailData;
  status: CapabilityStatus;
  onClose?: () => void;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
  className?: string;
}

export function CapabilityDetail({
  capability,
  status,
  onClose,
  onInstall,
  onUninstall,
  className,
}: CapabilityDetailProps) {
  const isInstalled = status === 'installed';
  const isInstalling = status === 'installing';

  return (
    <div className={cn('flex flex-col h-full bg-[var(--shell-view-bg)]', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-6 border-b border-solid border-[var(--border-subtle)]">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="size-16 rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0 border border-solid border-white/5 shadow-inner">
            {capability.icon ? (
              <span className="text-3xl">{capability.icon}</span>
            ) : (
              <span className="text-2xl font-bold text-zinc-500">
                {capability.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-bold text-[var(--text-primary)] m-0 mb-1">
              {capability.name}
            </h2>
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <User size={14} weight="bold" />
              <span>{capability.author}</span>
              <span>•</span>
              <span>v{capability.version}</span>
              <span>•</span>
              <Badge variant={capability.pricing === 'free' ? 'secondary' : 'default'} className="text-[9px]">
                {capability.pricing}
              </Badge>
            </div>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="shrink-0"
          >
            <X size={18} weight="bold" />
          </Button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 p-6 border-b border-solid border-[var(--border-subtle)]">
        {isInstalled ? (
          <>
            <Button
              onClick={() => onUninstall?.(capability.id)}
              variant="outline"
              size="sm"
              className="font-semibold h-10 px-6"
              disabled={isInstalling}
            >
              Uninstall
            </Button>
            <Badge variant="secondary" className="text-[11px]">
              <Check size={14} weight="bold" className="mr-1" />
              Installed
            </Badge>
          </>
        ) : (
          <Button
            onClick={() => onInstall?.(capability.id)}
            className="font-bold h-10 px-6 bg-[var(--accent-primary)] hover:brightness-110 transition-all"
            disabled={isInstalling}
          >
            {isInstalling ? (
              <>
                <CircleNotch size={16} weight="bold" className="mr-2 animate-spin" />
                Installing...
              </>
            ) : (
              'Install Capability'
            )}
          </Button>
        )}
        {(capability.repository || capability.homepage) && (
          <div className="ml-auto flex gap-2">
            {capability.homepage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(capability.homepage, '_blank', 'noopener,noreferrer')}
              >
                <ArrowSquareOut size={14} weight="bold" className="mr-1.5" />
                Website
              </Button>
            )}
            {capability.repository && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(capability.repository, '_blank', 'noopener,noreferrer')}
              >
                <ArrowSquareOut size={14} weight="bold" className="mr-1.5" />
                Source
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {capability.rating !== undefined && (
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                  <Star size={14} weight="bold" />
                  Rating
                </div>
                <div className="text-[18px] font-bold text-[var(--text-primary)]">
                  {capability.rating.toFixed(1)}
                </div>
              </div>
            )}
            {capability.installCount !== undefined && (
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                  <DownloadSimple size={14} weight="bold" />
                  Installs
                </div>
                <div className="text-[18px] font-bold text-[var(--text-primary)]">
                  {capability.installCount.toLocaleString()}
                </div>
              </div>
            )}
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-white/5">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                <Tag size={14} weight="bold" />
                Type
              </div>
              <div className="text-[18px] font-bold text-[var(--text-primary)] capitalize">
                {capability.kind}
              </div>
            </div>
            {capability.license && (
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                  <Shield size={14} weight="bold" />
                  License
                </div>
                <div className="text-[14px] font-bold text-[var(--text-primary)]">
                  {capability.license}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {capability.tags && capability.tags.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {capability.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              About
            </h3>
            <div className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
              {capability.longDescription || capability.description}
            </div>
          </div>

          {/* Tools */}
          {capability.tools && capability.tools.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Tools ({capability.tools.length})
              </h3>
              <div className="space-y-2">
                {capability.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3 bg-zinc-800/50 rounded-lg border border-white/5"
                  >
                    <div className="font-semibold text-[13px] text-[var(--text-primary)] mb-1">
                      {tool.name}
                    </div>
                    <div className="text-[12px] text-zinc-400 leading-relaxed">
                      {tool.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permissions */}
          {capability.permissions && capability.permissions.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Permissions ({capability.permissions.length})
              </h3>
              <div className="space-y-2">
                {capability.permissions.map((perm, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-800/50 rounded-lg border border-white/5 flex items-start gap-3"
                  >
                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                      {perm.access}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-[var(--text-primary)] capitalize">
                        {perm.resource}
                      </div>
                      <div className="text-[12px] text-zinc-400 mt-0.5">
                        {perm.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {(capability.createdAt || capability.updatedAt) && (
            <div className="pt-4 border-t border-solid border-[var(--border-subtle)] text-[12px] text-zinc-500 space-y-1">
              {capability.createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} weight="bold" />
                  <span>Created: {new Date(capability.createdAt).toLocaleDateString()}</span>
                </div>
              )}
              {capability.updatedAt && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} weight="bold" />
                  <span>Updated: {new Date(capability.updatedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

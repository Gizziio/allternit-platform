"use client";

import React, { useCallback, useMemo, useState } from 'react';
import {
  AppWindow,
  Globe,
  Cpu,
  Lightning,
  GearSix,
  ArrowSquareOut,
  CircleNotch,
  Warning,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import type { MiniAppCategory } from './mini-app.types';
import { openInBrowser } from '@/lib/openInBrowser';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  runtime: <Cpu size={11} />,
  connector: <Globe size={11} />,
  data: <Lightning size={11} />,
  tool: <GearSix size={11} />,
  communication: <Globe size={11} />,
  custom: <Globe size={11} />,
};

export interface MiniAppFrameContext {
  url: string;
  name: string;
  category?: MiniAppCategory;
  version?: string;
}

export function AciMiniAppFrameView({ context }: { context?: { context?: MiniAppFrameContext } }) {
  const ctx = context?.context;

  const url = ctx?.url ?? '';
  const name = ctx?.name ?? 'Mini-app';
  const category = ctx?.category ?? 'custom';
  const version = ctx?.version;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const faviconUrl = useMemo(() => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}/favicon.ico`;
    } catch {
      return null;
    }
  }, [url]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError('Failed to load mini-app. The service may be offline or unreachable.');
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    // Force iframe reload by temporarily clearing src
    const iframe = document.querySelector(`iframe[title="${name}"]`) as HTMLIFrameElement | null;
    if (iframe) {
      const currentSrc = iframe.src;
      iframe.src = 'about:blank';
      setTimeout(() => {
        iframe.src = currentSrc;
      }, 50);
    }
  }, [name]);

  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <AppWindow size={24} className="text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-secondary)]">No mini-app URL provided</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2">
        <div className="flex size-5 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
          {CATEGORY_ICONS[category] ?? <Globe size={11} />}
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
        {version && <span className="text-[12px] text-[var(--text-tertiary)]">v{version}</span>}
        <span className="text-[12px] text-[var(--text-tertiary)] ml-1">Mini-app</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button"
            onClick={() => openInBrowser(url)}
            className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
            title="Open in new tab"
          >
            <ArrowSquareOut size={10} />
          </button>
        </div>
      </div>

      {/* Iframe with loading and error states */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--bg-primary)]">
            <CircleNotch size={24} className="animate-spin text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">Loading {name}…</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-8 text-center">
            <Warning size={28} className="text-[var(--status-warning)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Unable to load mini-app</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-xs">{error}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
              >
                <ArrowsClockwise size={12} />
                Retry
              </button>
              <button type="button"
                onClick={() => openInBrowser(url)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
              >
                <ArrowSquareOut size={12} />
                Open in new tab
              </button>
            </div>
          </div>
        )}

        <iframe
          src={url}
          className="flex-1 w-full h-full border-none"
          title={name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}

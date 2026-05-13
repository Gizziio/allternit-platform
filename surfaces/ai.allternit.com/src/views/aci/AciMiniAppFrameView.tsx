"use client";

import { useMemo } from 'react';
import {
  AppWindow,
  Globe,
  Cpu,
  Lightning,
  GearSix,
  ArrowSquareOut,
  X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { MiniAppCategory } from './mini-app.types';

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

  const faviconUrl = useMemo(() => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}/favicon.ico`;
    } catch {
      return null;
    }
  }, [url]);

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
        <div className="flex size-5  items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
          {CATEGORY_ICONS[category] ?? <Globe size={11} />}
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
        {version && <span className="text-[12px] text-[var(--text-tertiary)]">v{version}</span>}
        <span className="text-[12px] text-[var(--text-tertiary)] ml-1">Mini-app</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
            title="Open in new tab"
          >
            <ArrowSquareOut size={10} />
          </button>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        src={url}
        className="flex-1 w-full border-none"
        title={name}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

"use client";

import React from 'react';
import {
  AppWindow,
  Globe,
  Cpu,
  Lightning,
  GearSix,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import type { InstalledMiniApp, MiniAppCategory, MiniAppPresentationContract } from './mini-app.types';
import { openInBrowser } from '@/lib/openInBrowser';
import { MiniAppRuntimeSurface } from './MiniAppRuntimeSurface';
import { resolveMiniAppPresentation } from './mini-app-presentation';

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
  miniApp?: InstalledMiniApp;
  presentation?: MiniAppPresentationContract;
}

export function AciMiniAppFrameView({ context }: { context?: { context?: MiniAppFrameContext } }) {
  const ctx = context?.context;

  const url = ctx?.url ?? '';
  const name = ctx?.name ?? 'Mini-app';
  const category = ctx?.category ?? 'custom';
  const version = ctx?.version;
  const app: InstalledMiniApp = ctx?.miniApp || {
    id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name,
    description: '',
    category,
    source: 'url',
    url,
    status: 'running',
    presentation: ctx?.presentation || { mode: 'embedded', uiUrl: url, fallback: 'external-browser' },
  };
  const presentation = ctx?.presentation || resolveMiniAppPresentation(app);

  if (!url && presentation.mode !== 'native') {
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
        <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{presentation.mode}</span>
        <div className="ml-auto flex items-center gap-2">
          {url && <button type="button"
            onClick={() => openInBrowser(url)}
            className="flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
            title="Open in new tab"
          >
            <ArrowSquareOut size={10} />
          </button>}
        </div>
      </div>

      <MiniAppRuntimeSurface app={app} presentation={presentation} title={name} className="flex-1" />
    </div>
  );
}

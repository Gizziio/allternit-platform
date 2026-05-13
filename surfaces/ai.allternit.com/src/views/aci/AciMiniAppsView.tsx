"use client";

import { useCallback } from 'react';
import {
  AppWindow,
  ArrowsClockwise,
  CircleNotch,
  PushPin,
  PushPinSlash,
  Storefront,
  GearSix,
  ArrowSquareOut,
  Cpu,
  Lightning,
  Globe,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useNav } from '@/nav/useNav';
import { useMiniAppDiscovery } from './use-mini-app-discovery';
import { pinMiniApp, unpinMiniApp } from './mini-app-registry';
import type { InstalledMiniApp } from './mini-app.types';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  runtime: <Cpu size={16} />,
  connector: <Globe size={16} />,
  data: <Lightning size={16} />,
  tool: <GearSix size={16} />,
  communication: <Globe size={16} />,
  custom: <Globe size={16} />,
};

const STATUS_COLOR: Record<InstalledMiniApp['status'], string> = {
  running: 'bg-green-500',
  available: 'bg-blue-400',
  pinned: 'bg-[var(--border-strong)]',
  offline: 'bg-[var(--status-error)]',
};

const STATUS_LABEL: Record<InstalledMiniApp['status'], string> = {
  running: 'Running',
  available: 'Available',
  pinned: 'Pinned',
  offline: 'Offline',
};

function MiniAppCard({ app, onOpen, onPin, onUnpin }: {
  app: InstalledMiniApp;
  onOpen: (app: InstalledMiniApp) => void;
  onPin: (app: InstalledMiniApp) => void;
  onUnpin: (id: string) => void;
}) {
  const isPinned = app.status !== 'available';
  const isRunning = app.status === 'running';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 transition-colors',
        isRunning
          ? 'border-green-900/40 bg-green-950/10 hover:border-green-800/60'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn(
          'flex size-8  shrink-0 items-center justify-center rounded border',
          isRunning ? 'border-green-800/40 bg-green-950/30 text-green-400' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]',
        )}>
          {CATEGORY_ICONS[app.category] ?? <Globe size={16} />}
        </div>
        <div className={cn(
          'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide',
          isRunning ? 'bg-green-950/40 text-green-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]',
        )}>
          <span className={cn('size-1.5  rounded-full', STATUS_COLOR[app.status])} />
          {STATUS_LABEL[app.status]}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">{app.name}</span>
          {app.version && <span className="text-[12px] text-[var(--text-tertiary)]">v{app.version}</span>}
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{app.description}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => isPinned ? onUnpin(app.id) : onPin(app)}
          className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {isPinned
            ? <><PushPinSlash size={11} /> Unpin</>
            : <><PushPin size={11} /> Pin</>}
        </button>
        <button
          onClick={() => onOpen(app)}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
            isRunning
              ? 'bg-green-950/40 text-green-400 hover:bg-green-950/60 border border-green-900/40'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)]',
          )}
        >
          {isRunning ? 'Open ↗' : 'Launch'}
          <ArrowSquareOut size={10} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ probing, onScan }: { probing: boolean; onScan: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <AppWindow size={32} className="text-[var(--text-tertiary)]" weight="duotone" />
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">No mini-apps yet</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-xs">
          Start a local service like OpenClaw or Hermes and click Scan, or add any URL as a mini-app in{' '}
          <span className="text-[var(--accent-primary)]">Settings → Integrations</span>.
        </p>
      </div>
      <button
        onClick={onScan}
        disabled={probing}
        className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
      >
        {probing ? <CircleNotch size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
        Scan for local services
      </button>
    </div>
  );
}

export function AciMiniAppsView() {
  const { all, probing, reprobe } = useMiniAppDiscovery();
  const { dispatch } = useNav();

  const handleOpen = useCallback((app: InstalledMiniApp) => {
    dispatch({
      type: 'OPEN_VIEW',
      viewType: 'mini-app',
      context: {
        url: app.url,
        name: app.name,
        category: app.category,
        version: app.version,
      },
    });
  }, [dispatch]);

  const handlePin = useCallback((app: InstalledMiniApp) => {
    pinMiniApp(app);
  }, []);

  const handleUnpin = useCallback((id: string) => {
    unpinMiniApp(id);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5">
        <AppWindow size={14} className="text-[var(--text-secondary)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Mini-apps</span>
        {all.length > 0 && (
          <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[12px] text-[var(--text-tertiary)]">
            {all.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={reprobe}
            disabled={probing}
            className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {probing ? <CircleNotch size={11} className="animate-spin" /> : <ArrowsClockwise size={11} />}
            Scan
          </button>
          <button className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
            <Storefront size={11} />
            Browse
          </button>
          <button className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
            <GearSix size={11} />
            Manage
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {all.length === 0 ? (
          <EmptyState probing={probing} onScan={reprobe} />
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {all.map((app) => (
              <MiniAppCard
                key={app.id}
                app={app}
                onOpen={handleOpen}
                onPin={handlePin}
                onUnpin={handleUnpin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

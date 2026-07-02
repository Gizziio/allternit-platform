"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Download,
  GithubLogo,
  CheckCircle,
  XCircle,
  Terminal,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useMiniAppDiscovery } from './use-mini-app-discovery';
import { pinMiniApp, unpinMiniApp } from './mini-app-registry';
import type { InstalledMiniApp } from './mini-app.types';

function openView(viewType: string, context?: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType, context } }));
}

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

// ─── Desktop bridge ───────────────────────────────────────────────────────────

const isDesktop = typeof window !== 'undefined' && Boolean(window.allternit?.miniApps);

type ProgressLine = { line: string; type: 'stdout' | 'stderr' | 'info' };

type InstallState =
  | { phase: 'idle' }
  | { phase: 'installing'; lines: ProgressLine[] }
  | { phase: 'starting'; lines: ProgressLine[] }
  | { phase: 'done'; lines: ProgressLine[] }
  | { phase: 'error'; lines: ProgressLine[]; error: string };

function GitHubAvatar({ repo, size = 32 }: { repo?: string; size?: number }) {
  const [error, setError] = useState(false);
  if (!repo || error) {
    return (
      <div className="flex items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        <GithubLogo size={16} />
      </div>
    );
  }
  return (
    <img
      src={`https://github.com/${repo.split('/')[0]}.png?size=${size}`}
      alt=""
      width={size}
      height={size}
      className="rounded border border-[var(--border-subtle)] object-cover"
      onError={() => setError(true)}
    />
  );
}

// ─── Install Progress Panel ───────────────────────────────────────────────────

function InstallPanel({
  state,
  onDismiss,
}: {
  state: Exclude<InstallState, { phase: 'idle' }>;
  onDismiss?: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state]);

  const lines = 'lines' in state ? state.lines : [];
  const isActive = state.phase === 'installing' || state.phase === 'starting';
  const isDone = state.phase === 'done';
  const isError = state.phase === 'error';

  return (
    <div className="mt-3 rounded border border-[var(--border-subtle)] bg-[#0a0806] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[#0d0a07]">
        <Terminal size={11} className="text-[var(--text-tertiary)]" />
        <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
          {isActive ? (state.phase === 'installing' ? 'Installing…' : 'Starting service…') : ''}
          {isDone ? 'Done' : ''}
          {isError ? 'Failed' : ''}
        </span>
        {isActive && <CircleNotch size={10} className="ml-auto animate-spin text-[var(--accent-primary)]" />}
        {isDone && <CheckCircle size={11} className="ml-auto text-green-400" />}
        {isError && <XCircle size={11} className="ml-auto text-red-400" />}
      </div>
      <div
        ref={logRef}
        className="max-h-36 overflow-y-auto p-2 font-mono text-[10px] leading-relaxed"
      >
        {lines.map((l, i) => (
          <div
            key={`aciminiappsview-${i}`}
            className={cn(
              l.type === 'info' ? 'text-[var(--accent-primary)]' :
              l.type === 'stderr' ? 'text-yellow-400/80' :
              'text-[var(--text-secondary)]',
            )}
          >
            {l.line}
          </div>
        ))}
      </div>
      {(isDone || isError) && onDismiss && (
        <div className="px-3 py-1.5 border-t border-[var(--border-subtle)]">
          <button type="button"
            onClick={onDismiss}
            className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mini-App Card ────────────────────────────────────────────────────────────

function MiniAppCard({ app, onOpen, onPin, onUnpin, onReprobe }: {
  app: InstalledMiniApp;
  onOpen: (app: InstalledMiniApp) => void;
  onPin: (app: InstalledMiniApp) => void;
  onUnpin: (id: string) => void;
  onReprobe: () => void;
}) {
  const isPinned = app.status !== 'available';
  const isRunning = app.status === 'running';
  const isOffline = app.status === 'offline';
  const canInstall = isOffline && app.downloadable && isDesktop;

  const [installState, setInstallState] = useState<InstallState>({ phase: 'idle' });

  const handleInstall = useCallback(async () => {
    if (!isDesktop) return;
    const miniApps = window.allternit?.miniApps;
    if (!miniApps) return;

    // Use a local array as accumulator to avoid stale-closure issues across awaits
    const accumulated: ProgressLine[] = [];
    const push = (p: { id: string; line: string; type: string }) => {
      if (p.id !== app.id) return;
      accumulated.push({ line: p.line, type: p.type as ProgressLine['type'] });
      setInstallState((prev) => ({
        ...prev,
        lines: [...accumulated],
      }));
    };

    setInstallState({ phase: 'installing', lines: [] });
    const unsub = miniApps.onProgress(push);

    try {
      const installResult = await miniApps.install(app.id);
      unsub();

      if (!installResult.success) {
        setInstallState({ phase: 'error', lines: [...accumulated], error: installResult.error ?? 'Install failed' });
        return;
      }

      setInstallState({ phase: 'starting', lines: [...accumulated] });
      const unsub2 = miniApps.onProgress(push);
      const startResult = await miniApps.start(app.id);
      unsub2();

      if (!startResult.success) {
        setInstallState({ phase: 'error', lines: [...accumulated], error: startResult.error ?? 'Failed to start service' });
        return;
      }

      setInstallState({ phase: 'done', lines: [...accumulated] });
      setTimeout(() => onReprobe(), 500);
    } catch (err) {
      setInstallState({ phase: 'error', lines: [...accumulated], error: (err as Error).message });
    }
  }, [app.id, onReprobe]);

  const handleStart = useCallback(async () => {
    if (!isDesktop) return;
    const miniApps = window.allternit?.miniApps;
    if (!miniApps) return;

    const accumulated: ProgressLine[] = [];
    const push = (p: { id: string; line: string; type: string }) => {
      if (p.id !== app.id) return;
      accumulated.push({ line: p.line, type: p.type as ProgressLine['type'] });
      setInstallState((prev) => ({ ...prev, lines: [...accumulated] }));
    };

    setInstallState({ phase: 'starting', lines: [] });
    const unsub = miniApps.onProgress(push);
    const result = await miniApps.start(app.id);
    unsub();

    if (!result.success) {
      setInstallState({ phase: 'error', lines: [...accumulated], error: result.error ?? 'Failed to start' });
    } else {
      setInstallState({ phase: 'done', lines: [...accumulated] });
      setTimeout(() => onReprobe(), 500);
    }
  }, [app.id, onReprobe]);

  const isInstalling = installState.phase === 'installing' || installState.phase === 'starting';

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
          'flex size-8 shrink-0 items-center justify-center rounded border overflow-hidden',
          isRunning ? 'border-green-800/40 bg-green-950/30 text-green-400' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]',
        )}>
          {app.repo ? <GitHubAvatar repo={app.repo} size={32} /> : (CATEGORY_ICONS[app.category] ?? <Globe size={16} />)}
        </div>
        <div className={cn(
          'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide',
          isRunning ? 'bg-green-950/40 text-green-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]',
        )}>
          <span className={cn('size-1.5 rounded-full', STATUS_COLOR[app.status])} />
          {STATUS_LABEL[app.status]}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">{app.name}</span>
          {app.version && <span className="text-[12px] text-[var(--text-tertiary)]">v{app.version}</span>}
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{app.description}</p>
        {app.repo && (
          <a
            href={app.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <GithubLogo size={10} />
            {app.repo}
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button"
          onClick={() => isPinned ? onUnpin(app.id) : onPin(app)}
          className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {isPinned
            ? <><PushPinSlash size={11} /> Unpin</>
            : <><PushPin size={11} /> Pin</>}
        </button>
        <div className="flex items-center gap-2">
          {canInstall && installState.phase === 'idle' && (
            <button type="button"
              onClick={() => void handleInstall()}
              disabled={isInstalling}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
            >
              <Download size={10} />
              Install
            </button>
          )}
          {isOffline && isDesktop && app.downloadable && installState.phase === 'idle' && (
            <button type="button"
              onClick={() => void handleStart()}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              <ArrowSquareOut size={10} />
              Start
            </button>
          )}
          {isInstalling && (
            <div className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-[var(--text-tertiary)]">
              <CircleNotch size={10} className="animate-spin" />
              {installState.phase === 'installing' ? 'Installing…' : 'Starting…'}
            </div>
          )}
          {!isOffline && (
            <button type="button"
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
          )}
        </div>
      </div>

      {installState.phase !== 'idle' && (
        <InstallPanel
          state={installState}
          onDismiss={
            installState.phase === 'done' || installState.phase === 'error'
              ? () => setInstallState({ phase: 'idle' })
              : undefined
          }
        />
      )}
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
      <button type="button"
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

  const handleOpen = useCallback((app: InstalledMiniApp) => {
    if (app.id === 'hermes') {
      openView('hermes');
    } else if (app.id === 'openclaw') {
      openView('openclaw');
    } else {
      openView('mini-app', { url: app.url, name: app.name, category: app.category, version: app.version });
    }
  }, []);

  const handlePin = useCallback((app: InstalledMiniApp) => {
    pinMiniApp(app);
  }, []);

  const handleUnpin = useCallback((id: string) => {
    unpinMiniApp(id);
  }, []);

  const openIntegrationsSettings = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('allternit-settings-section', 'integrations');
      window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'integrations' } }));
    }
  }, []);

  const openMarketplace = useCallback(() => {
    openView('marketplace');
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
          <button type="button"
            onClick={reprobe}
            disabled={probing}
            className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {probing ? <CircleNotch size={11} className="animate-spin" /> : <ArrowsClockwise size={11} />}
            Scan
          </button>
          <button type="button"
            onClick={openMarketplace}
            className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <Storefront size={11} />
            Browse
          </button>
          <button type="button"
            onClick={openIntegrationsSettings}
            className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
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
                onReprobe={reprobe}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Faders,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/typography/Text';
import { useMiniAppDiscovery } from './use-mini-app-discovery';
import { getInstalledMiniApps, pinMiniApp, removeMiniApp, saveMiniApp, unpinMiniApp } from './mini-app-registry';
import type { InstalledMiniApp } from './mini-app.types';
import { ensureMiniAppAgent } from './mini-app-harness';
import { MiniAppDetailView } from './MiniAppDetailView';
import { useMiniAppCatalog } from './use-mini-app-catalog';
import { resolveMiniAppPresentation } from './mini-app-presentation';
import { MiniAppAddModal } from './MiniAppAddModal';

function openView(viewType: string, context?: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType, context } }));
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  runtime: <Cpu size={18} />,
  connector: <Globe size={18} />,
  data: <Lightning size={18} />,
  tool: <GearSix size={18} />,
  communication: <Globe size={18} />,
  custom: <Globe size={18} />,
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

function GitHubAvatar({ repo, size = 40 }: { repo?: string; size?: number }) {
  const [error, setError] = useState(false);
  if (!repo || error) {
    return (
      <div className="flex size-full items-center justify-center text-[var(--text-tertiary)]">
        <GithubLogo size={size * 0.45} />
      </div>
    );
  }
  return (
    <img
      src={`https://github.com/${repo.split('/')[0]}.png?size=${size}`}
      alt=""
      width={size}
      height={size}
      className="size-full object-cover"
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
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#0a0806]">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[#0d0a07] px-3 py-1.5">
        <Terminal size={11} className="text-[var(--text-tertiary)]" />
        <Text variant="code" className="text-[11px] text-[var(--text-tertiary)]">
          {isActive ? (state.phase === 'installing' ? 'Installing…' : 'Starting service…') : ''}
          {isDone ? 'Done' : ''}
          {isError ? 'Failed' : ''}
        </Text>
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
        <div className="border-t border-[var(--border-subtle)] px-3 py-1.5">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mini-App Card ────────────────────────────────────────────────────────────

function StatusPill({ status, className }: { status: InstalledMiniApp['status']; className?: string }) {
  return (
    <Pill size="sm" className={cn('gap-1.5 capitalize', className)}>
      <span className={cn('size-1.5 rounded-full', STATUS_COLOR[status])} />
      {STATUS_LABEL[status]}
    </Pill>
  );
}

function MiniAppCard({ app, onOpen, onPin, onUnpin, onReprobe, onDetails }: {
  app: InstalledMiniApp;
  onOpen: (app: InstalledMiniApp) => void;
  onPin: (app: InstalledMiniApp) => void;
  onUnpin: (id: string) => void;
  onReprobe: () => void;
  onDetails: (app: InstalledMiniApp) => void;
}) {
  const isPinned = app.status !== 'available' && app.isPinned !== false;
  const isRunning = app.status === 'running';
  const isOffline = app.status === 'offline';
  const canInstall = isOffline && app.downloadable && isDesktop;

  const [installState, setInstallState] = useState<InstallState>({ phase: 'idle' });

  const handleInstall = useCallback(async () => {
    if (!isDesktop) return;
    const miniApps = window.allternit?.miniApps;
    if (!miniApps) return;

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

  const handleStop = useCallback(async () => {
    const miniApps = window.allternit?.miniApps;
    if (!miniApps) return;
    setInstallState({ phase: 'starting', lines: [{ line: `Stopping ${app.name}…`, type: 'info' }] });
    const result = await miniApps.stop(app.id);
    if (!result.success) {
      setInstallState({ phase: 'error', lines: [], error: 'Failed to stop runtime' });
      return;
    }
    setInstallState({ phase: 'done', lines: [{ line: `${app.name} stopped`, type: 'info' }] });
    setTimeout(() => onReprobe(), 300);
  }, [app.id, app.name, onReprobe]);

  const isInstalling = installState.phase === 'installing' || installState.phase === 'starting';
  const presentation = resolveMiniAppPresentation(app);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDetails(app)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDetails(app);
        }
      }}
      className={cn(
        'group flex min-h-[200px] cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-200',
        isRunning
          ? 'border-green-500/30 bg-green-500/[0.04] hover:border-green-500/50 hover:shadow-md'
          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-panel)] hover:shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border',
            isRunning
              ? 'border-green-800/40 bg-green-950/30 text-green-400'
              : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]',
          )}
        >
          {app.repo ? <GitHubAvatar repo={app.repo} size={40} /> : (CATEGORY_ICONS[app.category] ?? <Globe size={18} />)}
        </div>
        <StatusPill status={app.status} />
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Text variant="body" className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
            {app.name}
          </Text>
          {app.version && (
            <Text variant="caption" className="shrink-0 text-[12px] text-[var(--text-tertiary)]">
              v{app.version}
            </Text>
          )}
        </div>
        <Text variant="caption" className="line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {app.description}
        </Text>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Pill size="sm" variant="outline" className="max-w-full truncate capitalize">
            {app.category}
          </Pill>
          <Pill size="sm" variant="ghost" className="max-w-full truncate capitalize">
            {app.catalogSource || app.source}
          </Pill>
          <Pill size="sm" variant="ghost" className="max-w-full truncate capitalize">
            {presentation.mode}
          </Pill>
          {app.verified && (
            <Pill size="sm" className="border-green-500/30 bg-green-500/10 text-green-500">
              Verified
            </Pill>
          )}
        </div>

        {app.repo && (
          <a
            href={app.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-primary)]"
          >
            <GithubLogo size={10} />
            {app.repo}
          </a>
        )}
      </div>

      <div
        className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2 text-xs"
          onClick={() => (isPinned ? onUnpin(app.id) : onPin(app))}
        >
          {isPinned ? <PushPinSlash size={13} /> : <PushPin size={13} />}
          <span className="hidden sm:inline">{isPinned ? 'Unpin' : 'Pin'}</span>
        </Button>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {canInstall && installState.phase === 'idle' && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => void handleInstall()} disabled={isInstalling}>
              <Download size={12} />
              Install
            </Button>
          )}
          {isOffline && isDesktop && app.downloadable && installState.phase === 'idle' && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => void handleStart()}>
              <ArrowSquareOut size={12} />
              Start
            </Button>
          )}
          {isInstalling && (
            <div className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-[var(--text-tertiary)]">
              <CircleNotch size={12} className="animate-spin" />
              {installState.phase === 'installing' ? 'Installing…' : 'Starting…'}
            </div>
          )}
          {isRunning && !isInstalling && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => void handleStop()}>
              Stop
            </Button>
          )}
          {!isOffline && !app.registryName && (
            <Button
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => {
                if (!isPinned) onPin(app);
                void onOpen(app);
              }}
              style={
                isRunning
                  ? {
                      background: 'rgba(6, 78, 59, 0.4)',
                      color: '#4ade80',
                      border: '1px solid rgba(20, 83, 45, 0.4)',
                    }
                  : undefined
              }
            >
              {isRunning ? 'Open' : 'Launch'}
              <ArrowSquareOut size={12} />
            </Button>
          )}
        </div>
      </div>

      {installState.phase !== 'idle' && (
        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <InstallPanel
            state={installState}
            onDismiss={
              installState.phase === 'done' || installState.phase === 'error'
                ? () => setInstallState({ phase: 'idle' })
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Empty & Loading States ───────────────────────────────────────────────────

function EmptyState({ probing, onScan }: { probing: boolean; onScan: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-16 text-center">
      <div className="mb-4 text-[var(--text-tertiary)]">
        <AppWindow size={48} weight="duotone" />
      </div>
      <h3 className="m-0 mb-1 text-[16px] font-semibold text-[var(--text-primary)]">
        No mini-apps yet
      </h3>
      <Text variant="caption" className="m-0 max-w-xs leading-relaxed">
        Start a local service like OpenClaw or Hermes and click Scan, or add any URL as a mini-app in{' '}
        <span className="text-[var(--accent-primary)]">Settings → Integrations</span>.
      </Text>
      <div className="mt-5">
        <Button onClick={onScan} disabled={probing}>
          {probing ? <CircleNotch size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
          Scan for local services
        </Button>
      </div>
    </div>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-16 text-center">
      <div className="mb-4 text-[var(--text-tertiary)]">
        <Faders size={48} weight="duotone" />
      </div>
      <h3 className="m-0 mb-1 text-[16px] font-semibold text-[var(--text-primary)]">
        No miniapps match your search
      </h3>
      <Text variant="caption" className="m-0 max-w-xs leading-relaxed">
        Try changing your filters or search terms.
      </Text>
      <div className="mt-5">
        <Button variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton.Card key={`catalog-skeleton-${i}`} height={220} />
      ))}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AciMiniAppsView() {
  const { all, pinned, probing, reprobe } = useMiniAppDiscovery();
  const { apps: catalogApps, loading: catalogLoading, error: catalogError } = useMiniAppCatalog(all);
  const [storeMode, setStoreMode] = useState<'discover' | 'installed'>('discover');
  const [selectedApp, setSelectedApp] = useState<InstalledMiniApp | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | InstalledMiniApp['category']>('all');
  const [source, setSource] = useState<'all' | NonNullable<InstalledMiniApp['catalogSource']>>('all');
  const [experience, setExperience] = useState<'all' | 'native' | 'hybrid' | 'embedded'>('all');

  const activeCollection = storeMode === 'installed' ? pinned : catalogApps;
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(activeCollection.map((app) => app.category)))] as Array<'all' | InstalledMiniApp['category']>,
    [activeCollection],
  );
  const visibleApps = useMemo(
    () => activeCollection.filter((app) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery = !normalizedQuery || `${app.name} ${app.description} ${app.repo || ''}`.toLowerCase().includes(normalizedQuery);
      const matchesSource = source === 'all' || (app.catalogSource || (app.source === 'builtin' ? 'allternit' : app.source)) === source;
      const matchesExperience = experience === 'all' || resolveMiniAppPresentation(app).mode === experience;
      return matchesQuery && matchesSource && matchesExperience && (category === 'all' || app.category === category);
    }),
    [activeCollection, category, experience, query, source],
  );

  const handleOpen = useCallback(async (app: InstalledMiniApp) => {
    const integration = await ensureMiniAppAgent(app);
    const presentation = resolveMiniAppPresentation(app);
    const viewType = presentation.nativeRenderer;
    const context = { miniApp: app, ...('agentId' in integration ? { agentId: integration.agentId } : { harnessError: integration.reason }) };
    if (viewType) { openView(viewType, context); return; }
    openView('mini-app', {
      url: presentation.uiUrl ?? app.url,
      presentation,
      name: app.name,
      category: app.category,
      version: app.version,
      ...context,
    });
  }, []);

  const handlePin = useCallback((app: InstalledMiniApp) => {
    pinMiniApp(app);
  }, []);

  const handleUnpin = useCallback((id: string) => {
    unpinMiniApp(id);
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    await window.allternit?.miniApps?.removeRuntime?.(id);
    removeMiniApp(id);
    setSelectedApp(null);
  }, []);

  const handleAdd = useCallback((app: InstalledMiniApp) => {
    pinMiniApp(app);
    setStoreMode('installed');
    setSelectedApp(app);
  }, []);

  const handleUpdate = useCallback((app: InstalledMiniApp) => {
    saveMiniApp(app);
    setSelectedApp(app);
  }, []);

  const handleDetails = useCallback((app: InstalledMiniApp) => {
    const installed = getInstalledMiniApps();
    const existing = installed.find((item) => item.id === app.id);
    if (!existing || existing.isPinned === false) {
      pinMiniApp(app);
    }
    setSelectedApp(app);
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    setCategory('all');
    setSource('all');
    setExperience('all');
  }, []);

  if (selectedApp) {
    return (
      <MiniAppDetailView
        app={selectedApp}
        onBack={() => setSelectedApp(null)}
        onOpen={handleOpen}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onRemove={handleRemove}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Miniapps Store
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => openView('mini-app-review')}
              title="Review console"
              aria-label="Review console"
            >
              <ShieldCheck size={14} />
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              Add miniapp
            </Button>
            <Button
              variant="outline"
              onClick={reprobe}
              disabled={probing}
            >
              {probing ? <CircleNotch size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
              Scan
            </Button>
            <Button
              variant={storeMode === 'discover' ? 'default' : 'outline'}
              onClick={() => setStoreMode('discover')}
            >
              <Storefront size={14} />
              Discover
            </Button>
            <Button
              variant={storeMode === 'installed' ? 'default' : 'outline'}
              onClick={() => setStoreMode('installed')}
            >
              <GearSix size={14} />
              My Miniapps
            </Button>
          </div>
        </div>

        <div className="relative mt-8">
          <MagnifyingGlass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            aria-label="Search mini-apps"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search miniapps…"
            className="h-11 w-full rounded-xl border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[15px] placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <div className="mt-4 flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-3">
          {categories.map((item) => (
            <Pill
              key={item}
              size="sm"
              active={category === item}
              onClick={() => setCategory(item)}
              className="capitalize"
            >
              {item}
            </Pill>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as typeof source)}
              className="h-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">All sources</option>
              <option value="allternit">Allternit Verified</option>
              <option value="mcp">MCP Registry</option>
              <option value="github">GitHub</option>
              <option value="url">URL</option>
              <option value="local">Local</option>
              <option value="workspace">Workspace</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            Experience
            <select
              value={experience}
              onChange={(event) => setExperience(event.target.value as typeof experience)}
              className="h-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">All experiences</option>
              <option value="native">Native</option>
              <option value="hybrid">Hybrid</option>
              <option value="embedded">Embedded</option>
            </select>
          </label>
        </div>

        <div className="mt-8">
          {storeMode === 'discover' && catalogError && (
            <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-[var(--text-secondary)]">
              The public MCP registry is temporarily unavailable. Showing the local Allternit catalog.
            </div>
          )}

          {storeMode === 'discover' && catalogLoading && activeCollection.length === 0 ? (
            <CatalogSkeleton />
          ) : activeCollection.length === 0 ? (
            <EmptyState probing={probing} onScan={reprobe} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleApps.map((app) => (
                <MiniAppCard
                  key={app.id}
                  app={app}
                  onOpen={handleOpen}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onReprobe={reprobe}
                  onDetails={handleDetails}
                />
              ))}
              {visibleApps.length === 0 && <NoResultsState onClear={clearFilters} />}
            </div>
          )}
        </div>
        <MiniAppAddModal isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      </div>
    </div>
  );
}

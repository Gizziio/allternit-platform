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
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useMiniAppDiscovery } from './use-mini-app-discovery';
import { pinMiniApp, removeMiniApp, saveMiniApp, unpinMiniApp } from './mini-app-registry';
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
        'flex min-h-[190px] cursor-pointer flex-col gap-3 rounded-xl border p-5 transition-all duration-200',
        isRunning
          ? 'border-green-500/30 bg-green-500/[0.04] hover:border-green-500/50 hover:shadow-md'
          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl border overflow-hidden',
          isRunning ? 'border-green-800/40 bg-green-950/30 text-green-400' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]',
        )}>
          {app.repo ? <GitHubAvatar repo={app.repo} size={32} /> : (CATEGORY_ICONS[app.category] ?? <Globe size={16} />)}
        </div>
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
          isRunning ? 'bg-green-950/40 text-green-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]',
        )}>
          <span className={cn('size-1.5 rounded-full', STATUS_COLOR[app.status])} />
          {STATUS_LABEL[app.status]}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">{app.name}</span>
          {app.version && <span className="text-[12px] text-[var(--text-tertiary)]">v{app.version}</span>}
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">{app.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--text-tertiary)]">{app.catalogSource || app.source}</span>
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--text-tertiary)]">{resolveMiniAppPresentation(app).mode}</span>
          {app.verified && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">Verified</span>}
        </div>
        {app.repo && (
          <a
            href={app.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <GithubLogo size={10} />
            {app.repo}
          </a>
        )}
      </div>
      <button type="button" onClick={(event) => { event.stopPropagation(); onDetails(app); }} onKeyDown={(event) => event.stopPropagation()} className="self-start text-xs font-medium text-[var(--accent-primary)] hover:underline">View details</button>

      <div className="flex items-center justify-between gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
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
          {isRunning && !isInstalling && (
            <button type="button" onClick={() => void handleStop()} className="flex items-center gap-1.5 rounded border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">Stop</button>
          )}
          {!isOffline && !app.registryName && (
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

function EmptyState({ probing, onScan }: { probing: boolean; onScan: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <AppWindow size={48} className="text-[var(--text-tertiary)] opacity-40" weight="duotone" />
      <div>
        <p className="text-sm text-[var(--text-secondary)]">No mini-apps yet.</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-xs">
          Start a local service like OpenClaw or Hermes and click Scan, or add any URL as a mini-app in{' '}
          <span className="text-[var(--accent-primary)]">Settings → Integrations</span>.
        </p>
      </div>
      <button type="button"
        onClick={onScan}
        disabled={probing}
        className="mt-2 flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
      >
        {probing ? <CircleNotch size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
        Scan for local services
      </button>
    </div>
  );
}

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
  const categories = useMemo(() => ['all', ...Array.from(new Set(activeCollection.map((app) => app.category)))] as Array<'all' | InstalledMiniApp['category']>, [activeCollection]);
  const visibleApps = useMemo(() => activeCollection.filter((app) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || `${app.name} ${app.description} ${app.repo || ''}`.toLowerCase().includes(normalizedQuery);
    const matchesSource = source === 'all' || (app.catalogSource || (app.source === 'builtin' ? 'allternit' : app.source)) === source;
    const matchesExperience = experience === 'all' || resolveMiniAppPresentation(app).mode === experience;
    return matchesQuery && matchesSource && matchesExperience && (category === 'all' || app.category === category);
  }), [activeCollection, category, experience, query, source]);

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

  if (selectedApp) return <MiniAppDetailView app={selectedApp} onBack={() => setSelectedApp(null)} onOpen={handleOpen} onPin={handlePin} onUnpin={handleUnpin} onRemove={handleRemove} onUpdate={handleUpdate} />;

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Miniapps Store</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Discover, install, and manage agent-connected mini-apps.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button"
              onClick={() => openView('mini-app-review')}
              title="Review console"
              aria-label="Review console"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)]"
            >
              <ShieldCheck size={14} />
            </button>
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3.5 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"><Plus size={14} />Add miniapp</button>
            <button type="button"
              onClick={reprobe}
              disabled={probing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
            >
              {probing ? <CircleNotch size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
              Scan
            </button>
            <button type="button"
              onClick={() => setStoreMode('discover')}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors", storeMode === 'discover' ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]")}
            >
              <Storefront size={14} />
              Discover
            </button>
            <button type="button"
              onClick={() => setStoreMode('installed')}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors", storeMode === 'installed' ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]")}
            >
              <GearSix size={14} />
              My Miniapps
            </button>
          </div>
        </div>

        <div className="relative mt-8">
          <MagnifyingGlass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input aria-label="Search mini-apps" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search miniapps by name, description, or repo…" className="h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]" />
        </div>
        <div className="mt-5 flex items-center gap-1 overflow-x-auto pb-3">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={cn("h-8 rounded-full px-3.5 text-xs font-medium capitalize transition-colors", category === item ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]" : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]")}>{item}</button>)}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:border-[var(--border-hover)]">Source <select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className="bg-transparent text-[var(--text-primary)] outline-none"><option value="all">All sources</option><option value="allternit">Allternit Verified</option><option value="mcp">MCP Registry</option><option value="github">GitHub</option><option value="url">URL</option><option value="local">Local</option><option value="workspace">Workspace</option></select></label>
          <label className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:border-[var(--border-hover)]">Experience <select value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)} className="bg-transparent text-[var(--text-primary)] outline-none"><option value="all">All experiences</option><option value="native">Native</option><option value="hybrid">Hybrid</option><option value="embedded">Embedded</option></select></label>
        </div>

      <div className="mt-8">
        {storeMode === 'discover' && catalogError && <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-[var(--text-secondary)]">The public MCP registry is temporarily unavailable. Showing the local Allternit catalog.</div>}
        {activeCollection.length === 0 ? (
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
                onDetails={setSelectedApp}
              />
            ))}
            {visibleApps.length === 0 && <div className="col-span-full flex flex-col items-center justify-center gap-2 py-24 text-center"><AppWindow size={48} className="text-[var(--text-tertiary)] opacity-40" /><div className="text-sm text-[var(--text-secondary)]">No miniapps match your search.</div><button type="button" onClick={() => { setQuery(''); setCategory('all'); }} className="mt-2 text-sm font-medium text-[var(--accent-primary)] hover:underline">Clear filters</button></div>}
            {storeMode === 'discover' && catalogLoading && <div className="col-span-full flex items-center justify-center gap-2 py-5 text-xs text-[var(--text-tertiary)]"><CircleNotch size={14} className="animate-spin" /> Loading public registry…</div>}
          </div>
        )}
      </div>
      <MiniAppAddModal isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      </div>
    </div>
  );
}

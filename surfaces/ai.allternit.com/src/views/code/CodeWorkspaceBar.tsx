'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Desktop,
  FolderSimple,
  GitBranch,
  CaretDown,
  Check,
  ArrowsClockwise,
  Square,
  CheckSquare,
  Cloud,
  Plus,
  ArrowSquareOut,
  Gear,
  RocketLaunch,
  X,
  Terminal,
  ChatCenteredText,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
  getActiveWorkspace,
  type CodeWorkspaceRecord,
  type CodeSessionMode,
} from './CodeModeStore';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CodeEnvironmentDialog } from './CodeEnvironmentDialog';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { env } from '@/lib/env';
import {
  ACTIVE_RUNTIME_ID_KEY,
  getActiveRuntimeId,
  getRuntimeExecutionTarget,
  setRuntimeExecutionTarget,
  subscribeRuntimeExecutionTarget,
  type RuntimeExecutionTarget,
} from '@/lib/runtime-target';
import { reloadCodeSessionsForRuntime } from './CodeSessionStore';

export const CODE_SESSION_MODE_LABELS: Record<CodeSessionMode, string> = {
  SAFE: 'Read only',
  DEFAULT: 'Ask before edits',
  AUTO: 'Accept edits',
  PLAN: 'Plan first',
};

interface CodeWorkspaceBarProps {
  activeWorkspace: ReturnType<typeof getActiveWorkspace>;
  worktreeEnabled: boolean;
  activeWorkspaceId: string;
  workspaces: CodeWorkspaceRecord[];
  workspaceReady: boolean;
  onConfirmWorkspace: (workspaceId?: string) => void;
  onOpenFolder?: () => void;
  onRefresh?: () => void;
  onToggleWorktree?: () => void;
  branches?: string[];
  onSwitchBranch?: (branch: string) => void;
  terminalCanvasOpen?: boolean;
  onToggleTerminalCanvas?: () => void;
}

const BORDER = 'var(--chat-composer-border, rgba(255, 255, 255, 0.08))';
const PILL_BG = 'rgba(255, 255, 255, 0.03)';
const PILL_HOVER_BG = 'rgba(255, 255, 255, 0.07)';
const TEXT_SECONDARY = 'var(--text-secondary)';
const TEXT_PRIMARY = 'var(--text-primary)';

export function CodeWorkspaceBar({
  activeWorkspace,
  worktreeEnabled,
  activeWorkspaceId,
  workspaces,
  workspaceReady,
  onConfirmWorkspace,
  onOpenFolder,
  onRefresh,
  onToggleWorktree,
  branches,
  onSwitchBranch,
  terminalCanvasOpen = false,
  onToggleTerminalCanvas,
}: CodeWorkspaceBarProps): React.ReactNode {
  const branch = activeWorkspace?.repo_status?.branch ?? 'main';
  const displayName = activeWorkspace?.display_name ?? 'Workspace';
  const branchList = branches && branches.length > 0 ? branches : [branch];

  return (
    <div
      data-testid="code-workspace-bar"
      className="relative z-0 w-full h-[56px] -mb-3 box-border bg-[var(--chat-composer-bg)]/60 border-t border-r border-l border-[var(--chat-composer-border)]/60 rounded-t-2xl px-4 pb-3 flex items-center gap-3 animate-deck-rise backdrop-blur-md"
    >
      <EnvironmentPill />

      <WorkspacePill
        activeWorkspaceId={activeWorkspaceId}
        workspaces={workspaces}
        displayName={workspaceReady ? displayName : 'Select folder'}
        onSelectWorkspace={onConfirmWorkspace}
        onOpenFolder={onOpenFolder}
      />

      <BranchPill
        currentBranch={branch}
        branches={branchList}
        onSwitchBranch={onSwitchBranch}
      />

      <WorktreePill enabled={worktreeEnabled} onToggle={onToggleWorktree} />

      <CanvasTogglePill isOpen={terminalCanvasOpen} onToggle={onToggleTerminalCanvas} />

      <RemoteControlPill />

      <SyncPill onRefresh={onRefresh} />
    </div>
  );
}

function CanvasTogglePill({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle?: () => void;
}) {
  return (
    <Pill
      ariaLabel={isOpen ? 'Switch to chat' : 'Switch to terminal canvas'}
      testId="code-workspace-bar-canvas-toggle"
      onClick={() => onToggle?.()}
    >
      <IconWrapper>
        {isOpen ? <ChatCenteredText size={14} /> : <Terminal size={14} />}
      </IconWrapper>
      <span>{isOpen ? 'Chat' : 'Canvas'}</span>
    </Pill>
  );
}

function Pill({
  children,
  onClick,
  isOpen,
  ariaLabel,
  testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  isOpen?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-full text-xs font-semibold border backdrop-blur-md transition-all shrink-0',
        isOpen
          ? 'bg-[var(--glass-bg)]/35 border-[var(--border-subtle)]/60 text-[var(--text-primary)] shadow-sm'
          : 'bg-[var(--glass-bg)]/25 border-[var(--border-subtle)]/50 text-[var(--text-primary)] hover:bg-[var(--glass-bg)]/40'
      )}
    >
      {children}
    </button>
  );
}

function IconWrapper({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, lineHeight: 0 }}>
      {children}
    </span>
  );
}

function EnvironmentPill() {
  const { getToken, isLoaded, isSignedIn } = usePlatformAuth();
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'local' | 'cloud' | null>(null);
  const [showSshDialog, setShowSshDialog] = useState(false);
  const [target, setTarget] = useState<RuntimeExecutionTarget>(() => getRuntimeExecutionTarget());
  const [activeRuntimeId, setActiveRuntimeId] = useState<string | null>(() => getActiveRuntimeId());
  const [runtimes, setRuntimes] = useState<CloudRuntime[]>([]);
  const [runtimesLoading, setRuntimesLoading] = useState(false);
  const [runtimesError, setRuntimesError] = useState<string | null>(null);

  const activeRuntime = useMemo(
    () => runtimes.find((runtime) => runtime.id === activeRuntimeId) ?? null,
    [activeRuntimeId, runtimes],
  );

  const refreshRuntimes = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setRuntimes([]);
      return;
    }
    setRuntimesLoading(true);
    setRuntimesError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in to use cloud sessions');
      const cloudBase = env('NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL', 'https://api.allternit.com')!.replace(/\/$/, '');
      const response = await fetch(`${cloudBase}/api/v1/runtime-devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Runtime registry returned ${response.status}`);
      const payload = await response.json() as { runtimes?: CloudRuntime[] };
      const nextRuntimes = payload.runtimes ?? [];
      setRuntimes(nextRuntimes);
      const selected = getActiveRuntimeId();
      if (!selected || !nextRuntimes.some((runtime) => runtime.id === selected && runtime.status === 'online')) {
        const firstOnline = nextRuntimes.find((runtime) => runtime.status === 'online');
        if (firstOnline) {
          localStorage.setItem(ACTIVE_RUNTIME_ID_KEY, firstOnline.id);
          setActiveRuntimeId(firstOnline.id);
        }
      }
    } catch (error) {
      setRuntimesError(error instanceof Error ? error.message : 'Unable to load cloud runtimes');
    } finally {
      setRuntimesLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => subscribeRuntimeExecutionTarget(() => {
    setTarget(getRuntimeExecutionTarget());
    setActiveRuntimeId(getActiveRuntimeId());
  }), []);

  useEffect(() => {
    if (open) void refreshRuntimes();
  }, [open, refreshRuntimes]);

  const selectEnvironment = async (nextTarget: RuntimeExecutionTarget, runtimeId?: string) => {
    if (nextTarget === 'cloud' && !runtimeId) {
      setDialogMode('cloud');
      setOpen(false);
      return;
    }
    setRuntimeExecutionTarget(nextTarget, runtimeId);
    setTarget(nextTarget);
    setActiveRuntimeId(runtimeId ?? getActiveRuntimeId());
    setOpen(false);
    await reloadCodeSessionsForRuntime();
  };

  const environmentName = target === 'cloud'
    ? activeRuntime?.name || 'Allternit Cloud'
    : 'This Device';

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span>
            <Pill ariaLabel="Environment" testId="code-workspace-bar-environment" isOpen={open}>
              <IconWrapper>{target === 'cloud' ? <Cloud size={14} /> : <Desktop size={14} />}</IconWrapper>
              <span>{environmentName}</span>
              <IconWrapper><CaretDown size={12} style={{ opacity: 0.7 }} /></IconWrapper>
            </Pill>
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={8}
          className="w-72 p-2 rounded-xl border bg-popover shadow-xl"
          style={{ background: 'var(--surface-floating)', borderColor: BORDER }}
        >
          <DropdownSection title="Environment">
            <DropdownItem
              active={target === 'local'}
              icon={<Desktop size={14} />}
              label="This Device"
              description="Sessions stored on this runtime"
              onClick={() => void selectEnvironment('local')}
              trailing={
                <button
                  type="button"
                  data-testid="code-workspace-bar-environment-local-settings"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setDialogMode('local');
                  }}
                  title="Local environment settings"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: TEXT_SECONDARY,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = PILL_BG;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Gear size={14} />
                </button>
              }
            />
          </DropdownSection>
          <DropdownDivider />
          <DropdownSection title="Cloud">
            {runtimes.filter((runtime) => runtime.status === 'online').map((runtime) => (
              <DropdownItem
                key={runtime.id}
                active={target === 'cloud' && activeRuntimeId === runtime.id}
                icon={<Cloud size={14} />}
                label={runtime.name || 'Allternit runtime'}
                description={`${runtime.runtimeType || 'runtime'} · online`}
                onClick={() => void selectEnvironment('cloud', runtime.id)}
              />
            ))}
            {runtimesLoading ? (
              <DropdownItem label="Loading runtimes…" icon={<ArrowsClockwise size={14} />} disabled />
            ) : null}
            {!runtimesLoading && runtimes.filter((runtime) => runtime.status === 'online').length === 0 ? (
              <DropdownItem
                label={isSignedIn ? 'No runtime online' : 'Sign in for cloud sessions'}
                description={runtimesError || 'Pair or start a runtime before launching a cloud code session'}
                icon={<Cloud size={14} />}
                disabled
              />
            ) : null}
            <DropdownItem
              icon={<Plus size={14} />}
              label="Pair or configure runtime…"
              onClick={() => {
                setOpen(false);
                setDialogMode('cloud');
              }}
            />
          </DropdownSection>
          <DropdownDivider />
          <DropdownSection title="SSH">
            <DropdownItem
              icon={<Plus size={14} />}
              label="Add SSH host…"
              onClick={() => {
                setOpen(false);
                setShowSshDialog(true);
              }}
            />
          </DropdownSection>
        </PopoverContent>
      </Popover>

      <CodeEnvironmentDialog
        open={dialogMode !== null}
        mode={dialogMode ?? 'local'}
        onClose={() => setDialogMode(null)}
        onSave={() => {
          setDialogMode(null);
        }}
      />

      <SshHostDialog open={showSshDialog} onClose={() => setShowSshDialog(false)} />
    </>
  );
}

interface CloudRuntime {
  id: string;
  name: string;
  runtimeType?: string;
  status: string;
  lastSeenAt?: string | null;
}

function WorkspacePill({
  activeWorkspaceId,
  workspaces,
  displayName,
  onSelectWorkspace,
  onOpenFolder,
}: {
  activeWorkspaceId: string;
  workspaces: CodeWorkspaceRecord[];
  displayName: string;
  onSelectWorkspace: (workspaceId?: string) => void;
  onOpenFolder?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handleOpenFolder = async () => {
    setOpen(false);
    if (onOpenFolder) {
      onOpenFolder();
      return;
    }
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        // Surface the chosen directory path when the handle exposes one.
        const path = dirHandle?.name ?? '';
        if (path) {
          // eslint-disable-next-line no-console
          console.log('[CodeWorkspaceBar] Opened folder:', path);
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn('[CodeWorkspaceBar] showDirectoryPicker is not supported in this environment');
      }
    } catch {
      // User cancelled or picker unavailable.
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span>
          <Pill ariaLabel="Workspace" testId="code-workspace-bar-workspace" isOpen={open}>
            <IconWrapper><FolderSimple size={14} /></IconWrapper>
            <span className="max-w-[120px] truncate" title={displayName}>
              {displayName}
            </span>
            <IconWrapper><CaretDown size={12} style={{ opacity: 0.7 }} /></IconWrapper>
          </Pill>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-56 p-2 rounded-xl border bg-popover shadow-xl"
        style={{ background: 'var(--surface-floating)', borderColor: BORDER }}
      >
        <DropdownSection title="Recent">
          {workspaces.map((workspace) => {
            const isActive = workspace.workspace_id === activeWorkspaceId;
            return (
              <DropdownItem
                key={workspace.workspace_id}
                active={isActive}
                icon={<FolderSimple size={14} />}
                label={workspace.display_name}
                onClick={() => {
                  onSelectWorkspace(workspace.workspace_id);
                  setOpen(false);
                }}
              />
            );
          })}
        </DropdownSection>
        <DropdownDivider />
        <DropdownItem
          icon={<ArrowSquareOut size={14} />}
          label="Open folder…"
          onClick={handleOpenFolder}
        />
      </PopoverContent>
    </Popover>
  );
}

function BranchPill({
  currentBranch,
  branches,
  onSwitchBranch,
}: {
  currentBranch: string;
  branches: string[];
  onSwitchBranch?: (branch: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = branches.filter((b) => b.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <span>
          <Pill ariaLabel="Branch" testId="code-workspace-bar-branch" isOpen={open}>
            <IconWrapper><GitBranch size={14} /></IconWrapper>
            <span className="max-w-[120px] truncate" title={currentBranch}>
              {currentBranch}
            </span>
            <IconWrapper><CaretDown size={12} style={{ opacity: 0.7 }} /></IconWrapper>
          </Pill>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-64 p-2 rounded-xl border bg-popover shadow-xl"
        style={{ background: 'var(--surface-floating)', borderColor: BORDER }}
      >
        {filtered.map((branch) => (
          <DropdownItem
            key={branch}
            active={branch === currentBranch}
            icon={<GitBranch size={14} />}
            label={branch}
            onClick={() => {
              onSwitchBranch?.(branch);
              setOpen(false);
            }}
          />
        ))}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            marginTop: 4,
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: PILL_BG,
          }}
        >
          <GitBranch size={14} style={{ opacity: 0.5 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search branches…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: TEXT_PRIMARY,
              fontSize: 12,
              fontWeight: 500,
              minWidth: 0,
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WorktreePill({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle?: () => void;
}) {
  return (
    <Pill
      ariaLabel="Toggle worktree isolation"
      testId="code-workspace-bar-worktree"
      onClick={() => {
        onToggle?.();
      }}
    >
      {enabled ? (
        <IconWrapper><CheckSquare size={14} weight="fill" style={{ color: 'var(--accent-primary)' }} /></IconWrapper>
      ) : (
        <IconWrapper><Square size={14} /></IconWrapper>
      )}
      <span>worktree</span>
    </Pill>
  );
}

function RemoteControlPill() {
  const [open, setOpen] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span>
            <Pill ariaLabel="Remote control" testId="code-workspace-bar-remote-control" isOpen={open}>
              <IconWrapper><RocketLaunch size={14} /></IconWrapper>
              <IconWrapper><CaretDown size={12} style={{ opacity: 0.7 }} /></IconWrapper>
            </Pill>
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-64 p-2 rounded-xl border bg-popover shadow-xl"
          style={{ background: 'var(--surface-floating)', borderColor: BORDER }}
        >
          <DropdownSection title="Remote Control">
            <DropdownItem
              icon={<RocketLaunch size={14} />}
              label="Set up Remote Control"
              description="Run claude rc on your machine to code from here."
              onClick={() => {
                setOpen(false);
                setShowSetup(true);
              }}
            />
            <DropdownItem disabled icon={<Plus size={14} />} label="Add SSH host…" />
          </DropdownSection>
        </PopoverContent>
      </Popover>

      <RemoteControlSetupDialog open={showSetup} onClose={() => setShowSetup(false)} />
    </>
  );
}

function RemoteControlSetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--surface-floating, #1a1d21)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Set up Remote Control
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Connect to a machine running the Allternit remote agent.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          >
            claude rc --install
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Run the command above on the machine you want to control, then copy the pairing code into the field below.
          </p>
          <input
            type="text"
            placeholder="Pairing code"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--surface-floating)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SshHostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--surface-floating, #1a1d21)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Add SSH host
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Connect to a remote machine over SSH.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            placeholder="Host (e.g. 192.168.1.42)"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            placeholder="User (optional)"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--surface-floating)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add host
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncPill({ onRefresh }: { onRefresh?: () => void }) {
  const [spinning, setSpinning] = useState(false);

  return (
    <Pill
      ariaLabel="Refresh workspace status"
      testId="code-workspace-bar-sync"
      onClick={() => {
        setSpinning(true);
        onRefresh?.();
        window.setTimeout(() => setSpinning(false), 600);
      }}
    >
      <IconWrapper>
        <ArrowsClockwise
          size={14}
          className={spinning ? 'animate-spin' : undefined}
        />
      </IconWrapper>
    </Pill>
  );
}

function DropdownSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '4px 0' }}>
      {title ? (
        <div
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--ui-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function DropdownDivider() {
  return (
    <div
      style={{
        height: 1,
        margin: '4px 8px',
        background: BORDER,
      }}
    />
  );
}

function DropdownItem({
  label,
  icon,
  description,
  active,
  disabled,
  trailing,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 8,
        border: 'none',
        background: active ? PILL_HOVER_BG : 'transparent',
        color: disabled ? 'var(--ui-text-muted)' : TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = PILL_BG;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {icon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.75 }}>
          {icon}
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block' }}>{label}</span>
        {description ? (
          <span
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--ui-text-muted)',
              lineHeight: 1.3,
              marginTop: 2,
            }}
          >
            {description}
          </span>
        ) : null}
      </span>
      {active ? <Check size={14} style={{ color: 'var(--accent-primary)' }} /> : null}
      {trailing ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{trailing}</span> : null}
    </button>
  );
}

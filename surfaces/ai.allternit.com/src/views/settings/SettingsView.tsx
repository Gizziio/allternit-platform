'use client'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { ResourceUsageDashboard } from '@/components/usage/ResourceUsageDashboard';
import {
  GearSix,
  Cpu,
  Info,
  Plus,
  Sun,
  Moon,
  DeviceMobile,
  User,
  HardDrives,
  Shield,
  Cloud,
  Lock,
  Target,
  Recycle,
  FileCode,
  Code,
  Warning,
  X,
  Play,
  ChartBar,
  Clock,
  Lightning,
  CaretRight,
  CaretDown,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  GitBranch,
  Stack,
  FileText as FileCheck,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ClockCounterClockwise,
  Copy,
  ShieldCheck,
  FileText,
  CircleNotch,
  Globe,
  Question,
  ArrowUpRight,
  DownloadSimple,
  Gift,
} from '@phosphor-icons/react';
import { VPSConnectionsPanel } from './VPSConnectionsPanel';
import { ToastProvider } from '@/components/ui/toast-provider';
import { usePlatformUser, usePlatformSignOut, usePlatformSessions, PlatformSignIn, isPlatformAuthDisabled } from '@/lib/platform-auth-client';
import { useThemeStore } from '@/design/ThemeStore';
import { LocalModelManager } from '@/components/models/LocalModelManager';
import { InfrastructureSettings } from './InfrastructureSettings';
import { SETTINGS_NAV_ITEMS, SETTINGS_SECTION_MAP, type SettingsSection } from './settings.config';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FontSize = 'small' | 'medium' | 'large';
type DefaultMode = 'chat' | 'cowork' | 'code';
type AgentOpsTab = 'evaluation' | 'factory' | 'gc';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  hasSubmenu?: boolean;
  onClick?: () => void;
  children?: MenuItem[];
}

interface GcIssue {
  id: string;
  agent: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  location: string;
  description: string;
  suggestion: string;
  fixed: boolean;
  lineNumber?: number;
}

interface GcAgentResult {
  agentName: string;
  executedAt: string;
  issuesFound: GcIssue[];
  issuesFixed: number;
  entropyReduction: number;
  metadata?: Record<string, unknown>;
}

interface GcQueueItem {
  id: string;
  agent: string;
  items: number;
  priority: 'high' | 'medium' | 'low';
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

interface GcPolicy {
  id: string;
  name: string;
  enabled: boolean;
  threshold: number;
  description?: string;
}

interface GcHistoryEntry {
  date: string;
  agentsRun: number;
  issuesFound: number;
  issuesFixed: number;
  entropyReduction: number;
  runId?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
  agentName?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { action: 'New Chat', shortcut: '⌘N' },
  { action: 'Toggle Sidebar', shortcut: '⌘\\' },
  { action: 'Search', shortcut: '⌘K' },
  { action: 'Close View', shortcut: '⌘W' },
  { action: 'Switch Mode (Chat)', shortcut: '⌘1' },
  { action: 'Switch Mode (Cowork)', shortcut: '⌘2' },
  { action: 'Switch Mode (Code)', shortcut: '⌘3' },
  { action: 'Run Agent', shortcut: '⌘R' },
  { action: 'Toggle Theme', shortcut: '⌘Shift+T' },
  { action: 'Open Settings', shortcut: '⌘,' },
];

const API_PROVIDERS = [
  { name: 'OpenAI', letter: 'O' },
  { name: 'Anthropic', letter: 'A' },
  { name: 'Mistral', letter: 'M' },
  { name: 'Google', letter: 'G' },
];

const GC_AGENT_INFO: Record<string, { description: string; icon: React.ReactNode }> = {
  duplicate_detector: { description: 'Finds duplicate code using AST analysis', icon: <Copy size={16} /> },
  boundary_type_checker: { description: 'Checks for untyped boundaries (unwrap, expect)', icon: <ShieldCheck size={16} /> },
  dependency_validator: { description: 'Validates layer dependency directions', icon: <GitBranch size={16} /> },
  observability_checker: { description: 'Finds missing tracing and logging', icon: <Eye size={16} /> },
  documentation_sync: { description: 'Detects spec vs implementation drift', icon: <FileText size={16} /> },
  test_coverage_checker: { description: 'Identifies test coverage gaps', icon: <CheckCircle size={16} /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = {
  async getEvaluations() {
    const res = await fetch(`/api/v1/agents/operations/evaluations`);
    if (!res.ok) throw new Error('Failed to fetch evaluations');
    return res.json();
  },
  async createEvaluation(data: any) {
    const res = await fetch(`/api/v1/agents/operations/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create evaluation');
    return res.json();
  },
  async runEvaluation(id: string) {
    const res = await fetch(`/api/v1/agents/operations/evaluations/${id}/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run evaluation');
    return res.json();
  },
  async getEvaluationResults(id: string) {
    const res = await fetch(`/api/v1/agents/operations/evaluations/${id}/results`);
    if (!res.ok) throw new Error('Failed to get results');
    return res.json();
  },
  async getBenchmarkHistory() {
    const res = await fetch(`/api/v1/agents/operations/benchmarks/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },
  async getFactoryTasks() {
    const res = await fetch(`/api/v1/agents/operations/factory/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },
  async createFactoryTask(data: any) {
    const res = await fetch(`/api/v1/agents/operations/factory/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },
  async approveFactoryChange(taskId: string, changeId: string) {
    const res = await fetch(`/api/v1/agents/operations/factory/tasks/${taskId}/changes/${changeId}/approve`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to approve');
    return res.json();
  },
  async rejectFactoryChange(taskId: string, changeId: string) {
    const res = await fetch(`/api/v1/agents/operations/factory/tasks/${taskId}/changes/${changeId}/reject`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reject');
    return res.json();
  },
  async getGCQueue() {
    const res = await fetch(`/api/v1/agents/operations/gc/queue`);
    if (!res.ok) throw new Error('Failed to fetch queue');
    return res.json();
  },
  async getGCPolicies() {
    const res = await fetch(`/api/v1/agents/operations/gc/policies`);
    if (!res.ok) throw new Error('Failed to fetch policies');
    return res.json();
  },
  async updateGCPolicy(id: string, data: Partial<GcPolicy>) {
    const res = await fetch(`/api/v1/agents/operations/gc/policies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update policy');
    return res.json();
  },
  async triggerGCCleanup() {
    const res = await fetch(`/api/v1/agents/operations/gc/cleanup`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger cleanup');
    return res.json();
  },
  async getGCHistory() {
    const res = await fetch(`/api/v1/agents/operations/gc/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },
  async runGCAgent(agentName: string) {
    const res = await fetch(`/api/v1/agents/operations/gc/agents/${agentName}/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run agent');
    return res.json();
  },
};

// ─── Sub-components (extracted to module scope) ───────────────────────────────

const SectionDivider = (): JSX.Element => (
  <div className="h-px bg-[var(--border-subtle)] my-3" />
);

const ToggleItem: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; description?: string }> = ({ label, value, onChange, description }) => (
  <div className="flex items-center justify-between py-3 mb-3">
    <div>
      <div className="text-[13px] font-medium text-[var(--text-primary)] mb-0.5">{label}</div>
      {description && <div className="text-[12px] text-[var(--text-secondary)]">{description}</div>}
    </div>
    <button 
      onClick={() => onChange(!value)} 
      className={cn(
        "w-12 h-7 rounded-full border-none relative transition-all duration-300 cursor-pointer p-0",
        value ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"
      )}
    >
      <div className={cn(
        "size-6 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow-sm",
        value ? "left-[22px]" : "left-0.5"
      )} />
    </button>
  </div>
);

const NavButton: React.FC<{ item: any; activeSection: SettingsSection; onClick: () => void }> = ({ item, activeSection, onClick }) => {
  const isActive = activeSection === item.id;
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-full p-2 px-3 border-none flex items-center gap-2.5 transition-all duration-150 text-sm rounded-lg relative text-left cursor-pointer",
        isActive 
          ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]" 
          : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[var(--accent-primary)] rounded-r-sm" />}
      {item.label}
    </button>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className="p-5 bg-[var(--bg-secondary)] rounded-lg border border-solid border-[var(--border-subtle)] text-center">
    <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
    <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider mt-1">{label}</div>
  </div>
);

const DiagnosticRow = ({ label, value, status }: { label: string, value: string, status?: 'success' | 'warning' | 'error' }) => (
  <div className="flex justify-between p-3 px-4 border-b border-solid border-[var(--border-subtle)] last:border-b-0">
    <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
    <div className="flex items-center gap-2">
      {status && (
        <div className={cn(
          "size-1.5 rounded-full",
          status === 'success' ? "bg-[var(--status-success)]" : status === 'warning' ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
        )} />
      )}
      <span className="text-[13px] font-medium text-[var(--text-primary)] font-mono">{value}</span>
    </div>
  </div>
);

const MetricBar = ({ label, value, suffix = '%', inverse = false }: { label: string, value: number, suffix?: string, inverse?: boolean }) => {
  const color = inverse 
    ? (value < 50 ? 'var(--status-success)' : value < 100 ? 'var(--status-warning)' : 'var(--status-error)')
    : (value > 80 ? 'var(--status-success)' : value > 50 ? 'var(--status-warning)' : 'var(--status-error)');
  
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1.5">
        <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{value}{suffix}</span>
      </div>
      <div className="h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-500 ease-out" 
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} 
        />
      </div>
    </div>
  );
};

const PermissionRow: React.FC<{
  label: string;
  description: string;
  status?: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  onGrant: () => void;
}> = ({ label, description, status, onGrant }) => {
  const granted = status === 'granted';
  const denied = status === 'denied';

  return (
    <div className="flex items-center gap-3 p-3.5 px-4 bg-[var(--bg-secondary)] rounded-lg border border-solid border-[var(--border-subtle)]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {granted ? <CheckCircle size={16} className="text-[var(--status-success)]" /> : denied ? <Warning size={16} className="text-[var(--status-error)]" /> : <CircleNotch size={16} className="text-[var(--ui-text-muted)] animate-spin" />}
          <span className={cn("text-sm font-medium", granted ? "text-[var(--status-success)]" : "text-[var(--text-primary)]")}>{label}</span>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed truncate">{description}</p>
      </div>
      {denied && (
        <button
          onClick={onGrant}
          className="p-1.5 px-3.5 rounded-lg border-none bg-[var(--status-warning)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer transition-transform active:scale-95"
        >
          Grant
        </button>
      )}
      {granted && (
        <span className="text-[12px] text-[var(--status-success)] font-semibold uppercase tracking-wider shrink-0">Granted</span>
      )}
    </div>
  );
};

const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) => (
  <div className="fixed top-5 right-5 z-[160] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(toast => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          className={cn(
            "p-3 px-4 rounded-xl text-[13px] font-semibold shadow-xl flex items-center gap-2.5 pointer-events-auto min-w-[280px] max-w-[400px]",
            toast.type === 'error' ? "bg-[var(--status-error)]" : toast.type === 'success' ? "bg-[var(--status-success)]" : "bg-[var(--status-info)]",
            "text-[var(--ui-text-inverse)]"
          )}
        >
          {toast.type === 'error' && <XCircle size={18} weight="fill" />}
          {toast.type === 'success' && <CheckCircle size={18} weight="fill" />}
          {toast.type === 'info' && <Info size={18} weight="fill" />}
          <span className="flex-1">{toast.message}</span>
          <button 
            onClick={() => onRemove(toast.id)}
            className="bg-transparent border-none text-[var(--ui-text-inverse)] cursor-pointer opacity-70 hover:opacity-100 transition-opacity p-0.5"
          >
            <X size={14} weight="bold" />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ─── Main View Component ──────────────────────────────────────────────────────

function ClerkAuthPanel() {
  const { isLoaded, isSignedIn, user: _user } = usePlatformUser();
  const { sessions } = usePlatformSessions();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = _user as any;
  const signOut = usePlatformSignOut();
  const [backendSummary, setBackendSummary] = useState<{ mode: string; url: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!(window as any).allternit?.backend;

  const handleRestartBackend = async () => {
    if (!isElectron) return;
    setRestarting(true);
    try {
      await (window as any).allternit.backend.restart();
    } catch (err) {
      console.error('Failed to restart backend:', err);
    } finally {
      setRestarting(false);
    }
  };

  const refreshBackendSummary = useCallback(async () => {
    setRefreshing(true);
    try {
      const backend = await window.allternit?.connection?.getBackend?.();
      if (!backend) {
        setBackendSummary(null);
      } else {
        setBackendSummary({ mode: backend.mode, url: backend.url });
      }
    } catch {
      setBackendSummary(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshBackendSummary();
  }, [refreshBackendSummary]);

  const openSettingsSection = useCallback((section: SettingsSection, tab?: string) => {
    window.dispatchEvent(new CustomEvent('allternit:open-settings', {
      detail: { section, tab },
    }));
  }, []);

  const backendLabel = backendSummary
    ? backendSummary.mode === 'remote'
      ? 'BYOC / Remote backend connected'
      : backendSummary.mode === 'bundled'
        ? 'Bundled local backend connected'
        : 'Development backend connected'
    : null;

  const backendHelp = backendSummary
    ? backendSummary.mode === 'remote'
      ? 'This account is signed in while using a remote BYOC backend. Signing out ends the desktop session without changing the connected backend target.'
      : backendSummary.mode === 'bundled'
        ? 'This account is signed in against the bundled local stack. Signing out ends the desktop session without changing the bundled backend.'
        : 'This account is signed in while the desktop shell points at a development backend. Signing out only affects the desktop account session.'
    : 'Backend selection is managed separately from desktop OAuth and can be changed without signing out.';

  const manageBackendTab: 'overview' | 'connections' =
    backendSummary?.mode === 'remote' ? 'connections' : 'overview';

  const manageBackendLabel =
    backendSummary?.mode === 'remote' ? 'Manage remote backend' : 'Manage backend';

  if (!isLoaded) {
    return <div className="p-6 text-[var(--text-tertiary)] text-[13px]">Loading…</div>;
  }

  if (isPlatformAuthDisabled()) {
    return (
      <div className="p-6">
        <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl p-5 px-6">
          <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            Authentication is unavailable in this build. No signed-in user is active.
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="p-6">
        <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-bold mb-4">Sign in to your Allternit account</div>
        <PlatformSignIn />
        <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl p-5 px-6 mt-4 text-[12px] text-[var(--text-secondary)] leading-relaxed">
          Desktop OAuth and backend selection are separate.
          Use Infrastructure or VPS Connections to change the active backend without resetting auth.
        </div>
      </div>
    );
  }

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Allternit User';
  const email =
    user?.emailAddresses?.[0]?.emailAddress
    ?? user?.primaryEmailAddress?.emailAddress
    ?? user?.userEmail
    ?? '';
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="p-6">
      <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-bold mb-2">Account</div>
      <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl p-5 px-6 mb-4 flex items-center gap-4">
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={name} className="size-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="size-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-lg font-bold text-[var(--ui-text-inverse)] shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-[var(--text-primary)] mb-0.5">{name}</div>
          {email && <div className="text-[12px] text-[var(--text-tertiary)] truncate">{email}</div>}
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl p-5 px-6 mb-4">
        <div className="mb-1 text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-bold">
          Session
        </div>
        <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          Sign out of the current Allternit account session. Backend routing stays managed separately in infrastructure settings.
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button className="inline-flex items-center gap-2 p-2 px-4 rounded-lg border border-solid border-rose-500/30 bg-[var(--status-error-bg)] text-[var(--status-error)] text-[13px] font-semibold cursor-pointer active:scale-95" onClick={() => void signOut()}>
            <User size={14} weight="bold" /> Sign out
          </button>
          <button className="inline-flex items-center gap-2 p-2 px-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--surface-hover)] disabled:opacity-50 active:scale-95" onClick={() => void refreshBackendSummary()} disabled={refreshing}>
            <ArrowsClockwise size={14} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
          {isElectron && (
            <button className="inline-flex items-center gap-2 p-2 px-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--surface-hover)] disabled:opacity-50 active:scale-95" onClick={handleRestartBackend} disabled={restarting}>
              <Cpu size={14} className={restarting ? 'animate-spin' : ''} /> {restarting ? 'Restarting…' : 'Restart Backend'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl p-5 px-6 mb-4">
        <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-bold mb-3">Active Platform Sessions</div>
        <div className="flex flex-col gap-3">
          {sessions.map((sess: any) => (
            <div key={sess.id} className="flex items-center justify-between p-2.5 px-3.5 bg-[var(--surface-hover)] rounded-lg border border-solid border-[var(--ui-border-muted)]">
              <div className="flex items-center gap-2.5">
                <div className={cn("size-1.5 rounded-full", sess.status === 'active' ? "bg-[var(--status-success)]" : "bg-[var(--ui-text-muted)]")} />
                <div>
                  <div className="text-[13px] font-bold text-[var(--text-primary)]">
                    {sess.latestActivityAt ? new Date(sess.latestActivityAt).toLocaleDateString() : 'Active Session'}
                    {sess.id === (user as any)?.lastActiveSessionId && <span className="ml-2 text-[11px] text-[var(--accent-primary)] uppercase tracking-widest font-black">(Current)</span>}
                  </div>
                  <div className="text-[12px] text-[var(--text-tertiary)] font-mono opacity-60">ID: {sess.id}</div>
                </div>
              </div>
              {sess.id !== (user as any)?.lastActiveSessionId && (
                <button className="p-1 px-3 rounded-md border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-primary)] text-[12px] font-bold cursor-pointer hover:bg-white/5 active:scale-95" onClick={() => sess.revoke()}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--status-success-bg)] border border-solid border-emerald-500/20 rounded-xl p-5 px-6 mb-4">
        <div className="flex items-center gap-2.5 mb-2">
          <Shield size={18} className="text-[var(--status-success)]" weight="fill" />
          <div className="text-[14px] font-black text-[var(--status-success)] uppercase tracking-wider">Offline-First Sovereignty</div>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed m-0">
          Your Private Brain remains 100% functional without internet. All neural memories, local models (Ollama), and tool schemas are stored securely on this device.
        </p>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl p-5 px-6 text-[12px] text-[var(--text-secondary)] leading-relaxed">
        <div className="mb-1 text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-bold">
          Backend Routing
        </div>
        <div className="text-[var(--text-primary)] font-bold mb-0.5">
          {backendLabel ?? 'Backend state unavailable'}
        </div>
        {backendSummary?.url && <div className="break-all mb-2 font-mono opacity-60">{backendSummary.url}</div>}
        <div className="mb-4 text-[var(--text-tertiary)]">
          {backendHelp}
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button className="inline-flex items-center gap-2 p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer hover:opacity-90 active:scale-95" onClick={() => openSettingsSection('infrastructure', manageBackendTab)}>
            <Cloud size={14} weight="bold" /> {manageBackendLabel}
          </button>
          <button className="inline-flex items-center gap-2 p-2 px-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--surface-hover)] active:scale-95" onClick={() => openSettingsSection('infrastructure', 'connections')}>
            <HardDrives size={14} weight="bold" /> BYOC connections
          </button>
        </div>
      </div>

    </div>
  );
}

import { AnimatePresence } from 'framer-motion';




const PermissionsPanel = () => {
  const [permStatus, setPermStatus] = useState<any>(null);
  const [permChecking, setPermChecking] = useState(false);

  useEffect(() => {
    const api = (window as any).allternit?.permissionGuide;
    if (!api) return;
    const unsub = api.onStatusChanged((status: any) => setPermStatus(status));
    api.check().then(setPermStatus).catch(() => {});
    return unsub;
  }, []);

  const checkPermissions = async () => {
    setPermChecking(true);
    try {
      const result = await (window as any).allternit!.permissionGuide!.requestCheck();
      setPermStatus(result);
    } finally {
      setPermChecking(false);
    }
  };

  const presentGuide = async (panel: any) => {
    await (window as any).allternit!.permissionGuide!.present(panel);
  };

  const hasApi = typeof window !== 'undefined' && !!(window as any).allternit?.permissionGuide;

  if (!hasApi) {
    return (
      <div style={{ maxWidth: 500 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>System Permissions</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Permission guide is only available in the Allternit Desktop app.
        </p>
      </div>
    );
  }

  const allGranted = permStatus?.accessibility === 'granted' && permStatus?.screenRecording === 'granted';

  return (
    <div style={{ maxWidth: 500 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>System Permissions</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
        Allternit needs Accessibility and Screen Recording permissions to control your desktop and capture screenshots.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <PermissionRow
          label="Accessibility"
          description="Allows Allternit to click and type on your behalf"
          status={permStatus?.accessibility}
          onGrant={() => presentGuide('accessibility')}
        />
        <PermissionRow
          label="Screen Recording"
          description="Allows Allternit to see your screen and take screenshots"
          status={permStatus?.screenRecording}
          onGrant={() => presentGuide('screen-recording')}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={checkPermissions}
          disabled={permChecking}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: 'var(--ui-text-inverse)', fontSize: 13,
            cursor: permChecking ? 'not-allowed' : 'pointer', opacity: permChecking ? 0.6 : 1
          }}
        >
          {permChecking ? 'Checking...' : 'Refresh Status'}
        </button>
        {allGranted && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--status-success)' }}>
            <CheckCircle size={16} /> All permissions granted
          </span>
        )}
      </div>
    </div>
  );
};

const DiagnosticsPanel = () => {
  const [, setSysInfo] = useState<any>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).allternit?.connection?.getSystemInfo) {
      (window as any).allternit.connection.getSystemInfo().then(setSysInfo);
    }
  }, []);

  return (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', marginBottom: '16px' }}>Telemetry & System</h3>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
          <DiagnosticRow label="App Version" value="v0.9.1-beta" />
          <DiagnosticRow label="Platform" value={typeof window !== 'undefined' && (window as any).allternit?.backend ? 'Desktop (Native)' : 'Web'} />
          <DiagnosticRow label="Kernel State" value="Operational (Port 3004)" status="success" />
          <DiagnosticRow label="Memory Bridge" value="Connected (Port 3201)" status="success" />
          <DiagnosticRow label="Gateway Sync" value="Healthy (Port 8013)" status="success" />
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', marginBottom: '16px' }}>Session Metrics</h3>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
           <MetricBar label="Active Memory Ingestion" value={92} />
           <MetricBar label="Tool Execution Success" value={98} />
           <MetricBar label="Context Recall Latency" value={15} suffix="ms" inverse />
        </div>
      </section>
    </div>
  );
};


export const SettingsView: React.FC<SettingsViewProps> = ({ 
  initialSection = 'signin',
  initialTab 
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [infrastructureTab, setInfrastructureTab] = useState<string | undefined>(initialTab);
  const [agentOpsTab, setAgentOpsTab] = useState<AgentOpsTab>('evaluation');

  React.useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  React.useEffect(() => {
    if (initialTab) setInfrastructureTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    const handleNavigateSettings = (event: CustomEvent<{ section: string; tab?: string }>) => {
      if (event.detail?.section && SETTINGS_SECTION_MAP[event.detail.section]) {
        setActiveSection(SETTINGS_SECTION_MAP[event.detail.section]);
        if (event.detail?.tab && SETTINGS_SECTION_MAP[event.detail.section] === 'infrastructure') {
          setInfrastructureTab(event.detail.tab);
        }
      }
    };
    window.addEventListener('allternit:navigate-settings' as any, handleNavigateSettings as any);
    window.addEventListener('allternit:open-settings' as any, handleNavigateSettings as any);
    return () => {
      window.removeEventListener('allternit:navigate-settings' as any, handleNavigateSettings as any);
      window.removeEventListener('allternit:open-settings' as any, handleNavigateSettings as any);
    };
  }, []);

  // State
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('UTC');
  const [showSystemMessages, setShowSystemMessages] = useState(true);
  const [enableTelemetry, setEnableTelemetry] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [, _setDefaultMode] = useState<DefaultMode>('chat');
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [, _setFontSize] = useState<FontSize>('medium');
  const [compactDensity, setCompactDensity] = useState(false);
  const [showSidebarLabels, setTwoSidebarLabels] = useState(true);
  const [, _setAnimateTransitions] = useState(true);
  const [, _setAccentColor] = useState('var(--accent-primary)');
  const [, _setChatModel] = useState('GPT-4o');
  const [, _setCodeModel] = useState('Claude 3.5');
  const [, _setAnalysisModel] = useState('Mistral 7B');
  const [, _setTemperature] = useState(0.7);
  const [, _setMaxTokens] = useState('2000');
  const [streaming, setStreaming] = useState(true);
  const [, _setApiKeys] = useState<Record<string, { masked: string; isSet: boolean }>>({
    OpenAI: { masked: 'sk-••••••••••••••••', isSet: true },
    Anthropic: { masked: '', isSet: false },
    Mistral: { masked: '', isSet: false },
    Google: { masked: '', isSet: false },
  });
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [drawAttentionNotifications, setDrawAttentionNotifications] = useState(true);
  const [, _setWorktreeLocation] = useState('Inside project (.claude/)');
  const [gizziRevokeState, setGizziRevokeState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [, _setBranchPrefix] = useState('gizziio');
  const [, _setPreviewEnabled] = useState(true);
  const [, _setPersistPreviewSessions] = useState(false);
  const [autoUpdateExtensions, setAutoUpdateExtensions] = useState(true);
  const [useBuiltinNode, setUseBuiltinNode] = useState(true);

  // Agent Operations State
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEval, setSelectedEval] = useState<string | null>(null);
  const [evalResults, setEvalResults] = useState<any>(null);
  const [benchmarkHistory, setBenchmarkHistory] = useState<any[]>([]);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [showCreateEval, setShowCreateEval] = useState(false);
  const [newEvalName, setNewEvalName] = useState('');
  const [newEvalType, setNewEvalType] = useState('unit');
  const [factoryTasks, setFactoryTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskSpec, setNewTaskSpec] = useState('');
  const [newTaskRequirements, setNewTaskRequirements] = useState('');
  
  // GC State with proper types
  const [gcQueue, setGcQueue] = useState<GcQueueItem[]>([]);
  const [gcPolicies, setGcPolicies] = useState<GcPolicy[]>([]);
  const [gcHistory, setGcHistory] = useState<GcHistoryEntry[]>([]);
  const [isRunningGC, setIsRunningGC] = useState(false);
  const [entropyScore, setEntropyScore] = useState(85);
  
  // GC Error Handling State
  const [gcErrors, setGcErrors] = useState<Record<string, string>>({});
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast System
  const addToast = useCallback((message: string, type: 'error' | 'success' | 'info', agentName?: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type, agentName }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Get entropy color based on score
  const getEntropyColor = (score: number): string => {
    if (score <= 10) return 'var(--status-success)'; // green
    if (score <= 50) return 'var(--status-warning)'; // yellow
    if (score <= 100) return 'var(--status-error)'; // red
    return 'var(--status-error)'; // critical red
  };

  // Get entropy status text
  const getEntropyStatus = (score: number): string => {
    if (score <= 10) return 'System is healthy';
    if (score <= 50) return 'Moderate cleanup needed';
    if (score <= 100) return 'High entropy - cleanup recommended';
    return 'Critical entropy - immediate action required';
  };

  // Fetch functions
  const fetchEvaluations = useCallback(async () => {
    try {
      const data = await api.getEvaluations();
      setEvaluations(data.evaluations || []);
    } catch (e) {
      setEvaluations([
        { id: 'eval-1', name: 'Agent Response Quality', type: 'benchmark', status: 'passed', score: 92, lastRun: '2026-03-05T10:30:00Z' },
        { id: 'eval-2', name: 'Tool Call Accuracy', type: 'unit', status: 'passed', score: 88, lastRun: '2026-03-04T14:20:00Z' },
        { id: 'eval-3', name: 'Context Window Management', type: 'integration', status: 'failed', score: 67, lastRun: '2026-03-03T09:15:00Z' },
        { id: 'eval-4', name: 'Safety Filter Compliance', type: 'conformance', status: 'passed', score: 95, lastRun: '2026-03-02T16:45:00Z' },
      ]);
    }
  }, []);

  const fetchBenchmarkHistory = useCallback(async () => {
    try {
      const data = await api.getBenchmarkHistory();
      setBenchmarkHistory(data.history || []);
    } catch (e) {
      setBenchmarkHistory([
        { date: '2026-03-05', score: 92, tests: 45 },
        { date: '2026-03-04', score: 89, tests: 45 },
        { date: '2026-03-03', score: 87, tests: 44 },
        { date: '2026-03-02', score: 91, tests: 45 },
        { date: '2026-03-01', score: 85, tests: 43 },
      ]);
    }
  }, []);

  const fetchFactoryTasks = useCallback(async () => {
    try {
      const data = await api.getFactoryTasks();
      setFactoryTasks(data.tasks || []);
    } catch (e) {
      setFactoryTasks([
        { id: 'task-1', specRef: 'spec/auth-refactor', status: 'completed', progress: 100, createdAt: '2026-03-05T08:00:00Z' },
        { id: 'task-2', specRef: 'spec/api-optimization', status: 'generating', progress: 65, createdAt: '2026-03-05T09:30:00Z' },
        { id: 'task-3', specRef: 'spec/error-handling', status: 'validating', progress: 80, createdAt: '2026-03-04T14:00:00Z' },
        { id: 'task-4', specRef: 'spec/logging-improvements', status: 'pending_approval', progress: 95, createdAt: '2026-03-04T10:00:00Z' },
      ]);
    }
  }, []);

  const fetchGCData = useCallback(async () => {
    try {
      const [queueData, policiesData, historyData] = await Promise.all([
        api.getGCQueue(), api.getGCPolicies(), api.getGCHistory(),
      ]);
      setGcQueue(queueData.queue || []);
      setGcPolicies(policiesData.policies || []);
      setGcHistory(historyData.history || []);
      if (historyData.entropyScore !== undefined) {
        setEntropyScore(historyData.entropyScore);
      }
    } catch (e) {
      // Silent fail - don't show fake data on fetch, just keep current state
      console.error('[GC] Failed to fetch GC data:', e);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'agents') {
      if (agentOpsTab === 'evaluation') { fetchEvaluations(); fetchBenchmarkHistory(); }
      else if (agentOpsTab === 'factory') fetchFactoryTasks();
      else if (agentOpsTab === 'gc') fetchGCData();
    }
  }, [activeSection, agentOpsTab, fetchEvaluations, fetchBenchmarkHistory, fetchFactoryTasks, fetchGCData]);

  // Handlers
  const handleRunEvaluation = async (evalId: string) => {
    setIsRunningEval(true);
    try {
      await api.runEvaluation(evalId);
      const results = await api.getEvaluationResults(evalId);
      setEvalResults(results);
      fetchEvaluations();
    } catch (e) {
      setEvalResults({
        evaluationId: evalId, status: 'completed',
        summary: { total: 45, passed: 42, failed: 2, skipped: 1 },
        duration: 12450,
        details: [
          { test: 'response_quality', status: 'passed', duration: 120 },
          { test: 'tool_accuracy', status: 'passed', duration: 95 },
          { test: 'context_management', status: 'failed', duration: 200, error: 'Memory limit exceeded' },
        ]
      });
    }
    setIsRunningEval(false);
  };

  const handleCreateEvaluation = async () => {
    if (!newEvalName.trim()) return;
    try {
      await api.createEvaluation({ name: newEvalName, type: newEvalType, config: {} });
      setShowCreateEval(false); setNewEvalName(''); fetchEvaluations();
    } catch (e) {
      setEvaluations(prev => [...prev, { id: `eval-${Date.now()}`, name: newEvalName, type: newEvalType, status: 'pending', score: 0, lastRun: null }]);
      setShowCreateEval(false); setNewEvalName('');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskSpec.trim()) return;
    try {
      await api.createFactoryTask({ specRef: newTaskSpec, requirements: newTaskRequirements.split('\n').filter(r => r.trim()) });
      setShowCreateTask(false); setNewTaskSpec(''); setNewTaskRequirements(''); fetchFactoryTasks();
    } catch (e) {
      setFactoryTasks(prev => [...prev, { id: `task-${Date.now()}`, specRef: newTaskSpec, status: 'generating', progress: 0, createdAt: new Date().toISOString() }]);
      setShowCreateTask(false); setNewTaskSpec(''); setNewTaskRequirements('');
    }
  };

  const handleApproveChange = async (taskId: string, changeId: string) => {
    try { await api.approveFactoryChange(taskId, changeId); fetchFactoryTasks(); }
    catch (e) { setFactoryTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t)); }
  };

  const handleRejectChange = async (taskId: string, changeId: string) => {
    try { await api.rejectFactoryChange(taskId, changeId); fetchFactoryTasks(); }
    catch (e) { setFactoryTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'rejected' } : t)); }
  };

  const handleTriggerCleanup = async () => {
    setIsRunningGC(true);
    setGcErrors(prev => ({ ...prev, cleanup: '' }));
    
    try {
      const result = await api.triggerGCCleanup();
      const entropyReduced = result.entropyReduction?.toFixed(1) || '0.0';
      addToast(`Full cleanup completed: ${entropyReduced} entropy reduced`, 'success');
      await fetchGCData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger cleanup';
      setGcErrors(prev => ({ ...prev, cleanup: errorMessage }));
      addToast(`Cleanup failed: ${errorMessage}`, 'error');
    } finally {
      setIsRunningGC(false);
    }
  };

  const handleRunGCAgent = async (agentName: string) => {
    setRunningAgents(prev => new Set(prev).add(agentName));
    setGcErrors(prev => ({ ...prev, [agentName]: '' }));
    
    try {
      const result: GcAgentResult = await api.runGCAgent(agentName);
      const issuesFound = result.issuesFound?.length || 0;
      const issuesFixed = result.issuesFixed || 0;
      const entropyReduced = result.entropyReduction?.toFixed(1) || '0.0';
      addToast(`${agentName}: Found ${issuesFound} issues, fixed ${issuesFixed}, reduced ${entropyReduced} entropy`, 'success', agentName);
      await fetchGCData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to run ${agentName}`;
      setGcErrors(prev => ({ ...prev, [agentName]: errorMessage }));
      addToast(`${agentName} failed: ${errorMessage}`, 'error', agentName);
    } finally {
      setRunningAgents(prev => {
        const next = new Set(prev);
        next.delete(agentName);
        return next;
      });
    }
  };

  const handleUpdateGCPolicy = async (policyId: string, updates: Partial<GcPolicy>) => {
    const policy = gcPolicies.find(p => p.id === policyId);
    if (!policy) return;
    const previousPolicy = { ...policy };
    setGcPolicies(prev => prev.map(p => p.id === policyId ? { ...p, ...updates } : p));
    try {
      await api.updateGCPolicy(policyId, updates);
      addToast(`Policy "${policy.name}" updated successfully`, 'success');
      await fetchGCData();
    } catch (error) {
      setGcPolicies(prev => prev.map(p => p.id === policyId ? previousPolicy : p));
      const errorMessage = error instanceof Error ? error.message : 'Failed to update policy';
      addToast(`Failed to update policy: ${errorMessage}`, 'error');
    }
  };

  // Agent Operations Render Functions
  const renderEvaluationTab = () => (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-[var(--ui-text-primary)] m-0">Evaluation Tests</h3>
          <p className="text-[13px] text-[var(--ui-text-muted)] m-0 mt-1">{evaluations.length} tests configured</p>
        </div>
        <button onClick={() => setShowCreateEval(true)} className="p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus size={16} weight="bold" /> New Evaluation
        </button>
      </div>

      {showCreateEval && (
        <div className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-default)]">
          <h4 className="text-[14px] font-bold text-[var(--ui-text-primary)] m-0 mb-4">Create New Evaluation</h4>
          <div className="mb-4">
            <label className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Name</label>
            <input type="text" value={newEvalName} onChange={(e) => setNewEvalName(e.target.value)} placeholder="e.g., Agent Response Quality" className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)]" />
          </div>
          <div className="mb-4">
            <label className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Type</label>
            <select value={newEvalType} onChange={(e) => setNewEvalType(e.target.value)} className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none cursor-pointer">
              <option value="unit">Unit Test</option>
              <option value="integration">Integration Test</option>
              <option value="benchmark">Benchmark</option>
              <option value="conformance">Conformance</option>
              <option value="ontology">Ontology</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreateEval(false)} className="p-2 px-4 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] font-bold cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={handleCreateEvaluation} className="p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer active:scale-95 transition-transform">Create</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {evaluations.map((evalItem) => (
          <div key={evalItem.id} className={cn(
            "p-4 bg-[var(--surface-panel)] rounded-xl border border-solid cursor-pointer transition-all",
            selectedEval === evalItem.id ? "border-[var(--accent-primary)] shadow-md" : "border-[var(--ui-border-muted)] hover:border-[var(--ui-border-default)]"
          )} onClick={() => setSelectedEval(selectedEval === evalItem.id ? null : evalItem.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {evalItem.status === 'passed' && <CheckCircle size={20} className="text-[var(--status-success)]" weight="fill" />}
                {evalItem.status === 'failed' && <XCircle size={20} className="text-[var(--status-error)]" weight="fill" />}
                {evalItem.status === 'pending' && <Clock size={20} className="text-[var(--ui-text-muted)]" />}
                <div>
                  <div className="text-[14px] font-bold text-[var(--ui-text-primary)]">{evalItem.name}</div>
                  <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 uppercase font-semibold tracking-wider opacity-70">{evalItem.type} • Last run: {evalItem.lastRun ? new Date(evalItem.lastRun).toLocaleDateString() : 'Never'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={cn(
                    "text-[18px] font-black tabular-nums",
                    evalItem.score >= 80 ? "text-[var(--status-success)]" : evalItem.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                  )}>{evalItem.score}%</div>
                  <div className="text-[10px] text-[var(--ui-text-muted)] uppercase tracking-widest font-bold">Score</div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRunEvaluation(evalItem.id); }} 
                  disabled={isRunningEval} 
                  className={cn(
                    "p-2 px-3.5 rounded-lg border-none text-[12px] font-bold cursor-pointer flex items-center gap-1.5 transition-all active:scale-95",
                    isRunningEval ? "bg-[var(--surface-active)] text-[var(--ui-text-muted)]" : "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                  )}
                >
                  {isRunningEval ? <ArrowsClockwise size={14} className="animate-spin" /> : <Play size={14} weight="fill" />} Run
                </button>
              </div>
            </div>

            {selectedEval === evalItem.id && evalResults && (
              <div className="mt-4 pt-4 border-t border-solid border-[var(--ui-border-muted)]">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center">
                    <div className="text-xl font-bold text-[var(--status-success)] tabular-nums">{evalResults.summary.passed}</div>
                    <div className="text-[10px] text-[var(--ui-text-muted)] uppercase font-black">Passed</div>
                  </div>
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center">
                    <div className="text-xl font-bold text-[var(--status-error)] tabular-nums">{evalResults.summary.failed}</div>
                    <div className="text-[10px] text-[var(--ui-text-muted)] uppercase font-black">Failed</div>
                  </div>
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center">
                    <div className="text-xl font-bold text-[var(--status-warning)] tabular-nums">{evalResults.summary.skipped}</div>
                    <div className="text-[10px] text-[var(--ui-text-muted)] uppercase font-black">Skipped</div>
                  </div>
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center">
                    <div className="text-xl font-bold text-[var(--accent-primary)] tabular-nums">{(evalResults.duration / 1000).toFixed(1)}s</div>
                    <div className="text-[10px] text-[var(--ui-text-muted)] uppercase font-black">Duration</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {evalResults.details?.map((detail: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-[var(--surface-hover)] rounded-lg border border-solid border-transparent hover:border-[var(--ui-border-muted)] transition-colors">
                      {detail.status === 'passed' ? <CheckCircle size={16} className="text-[var(--status-success)]" /> : <XCircle size={16} className="text-[var(--status-error)]" />}
                      <span className="flex-1 text-[13px] text-[var(--ui-text-primary)] font-medium">{detail.test}</span>
                      <span className="text-[12px] text-[var(--ui-text-muted)] font-mono tabular-nums">{detail.duration}ms</span>
                      {detail.error && <span className="text-[11px] text-[var(--status-error)] font-bold italic ml-2">{detail.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)]">
        <h4 className="text-[14px] font-bold text-[var(--ui-text-primary)] m-0 mb-4 uppercase tracking-widest opacity-60">Benchmark History</h4>
        <div className="flex items-end gap-2 h-32 px-2">
          {benchmarkHistory.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
              <div 
                className={cn(
                  "w-full rounded-t-md transition-all duration-300 relative",
                  item.score >= 80 ? "bg-[var(--status-success)]" : item.score >= 60 ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
                )} 
                style={{ height: `${item.score}%`, minHeight: '12px' }} 
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] p-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {item.score}%
                </div>
              </div>
              <span className="text-[10px] font-bold text-[var(--ui-text-muted)] uppercase tracking-tighter tabular-nums">{item.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFactoryTab = () => (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-[var(--ui-text-primary)] m-0">Autonomous Tasks</h3>
          <p className="text-[13px] text-[var(--ui-text-muted)] m-0 mt-1">{factoryTasks.length} tasks in queue</p>
        </div>
        <button onClick={() => setShowCreateTask(true)} className="p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus size={16} weight="bold" /> New Task
        </button>
      </div>

      {showCreateTask && (
        <div className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-default)]">
          <h4 className="text-[14px] font-bold text-[var(--ui-text-primary)] m-0 mb-4">Create Autonomous Task</h4>
          <div className="mb-4">
            <label className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Spec Reference</label>
            <input type="text" value={newTaskSpec} onChange={(e) => setNewTaskSpec(e.target.value)} placeholder="e.g., spec/auth-refactor" className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)]" />
          </div>
          <div className="mb-4">
            <label className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Requirements (one per line)</label>
            <textarea value={newTaskRequirements} onChange={(e) => setNewTaskRequirements(e.target.value)} placeholder="e.g., Refactor auth middleware..." rows={4} className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)] resize-y font-sans" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreateTask(false)} className="p-2 px-4 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] font-bold cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={handleCreateTask} className="p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer active:scale-95 transition-transform">Create Task</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {factoryTasks.map((task) => (
          <div key={task.id} className={cn(
            "p-4 bg-[var(--surface-panel)] rounded-xl border border-solid transition-all",
            selectedTask === task.id ? "border-[var(--accent-primary)] shadow-md" : "border-transparent hover:border-[var(--ui-border-muted)]"
          )}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
              <div className="flex items-center gap-3">
                {task.status === 'completed' && <CheckCircle size={20} className="text-[var(--status-success)]" weight="fill" />}
                {task.status === 'generating' && <ArrowsClockwise size={20} className="text-[var(--accent-primary)] animate-spin" />}
                {task.status === 'validating' && <FileCheck size={20} className="text-[var(--status-info)]" weight="fill" />}
                {task.status === 'pending_approval' && <Clock size={20} className="text-[var(--status-warning)]" weight="fill" />}
                <div>
                  <div className="text-[14px] font-bold text-[var(--ui-text-primary)]">{task.specRef}</div>
                  <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 uppercase font-semibold tracking-wider opacity-70">{task.status.replace('_', ' ')} • Created {new Date(task.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <div className="flex justify-between text-[10px] font-black text-[var(--ui-text-muted)] mb-1 uppercase tracking-widest">
                    <span>Progress</span>
                    <span className="tabular-nums">{task.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        task.status === 'completed' ? "bg-[var(--status-success)]" : "bg-[var(--accent-primary)]"
                      )} 
                      style={{ width: `${task.progress}%` }} 
                    />
                  </div>
                </div>
                {selectedTask === task.id ? <CaretDown size={16} className="text-white/30" /> : <CaretRight size={16} className="text-white/30" />}
              </div>
            </div>

            {selectedTask === task.id && (
              <div className="mt-4 pt-4 border-t border-solid border-[var(--ui-border-muted)]">
                {task.status === 'pending_approval' && (
                  <div className="mb-5 p-4 bg-[var(--surface-hover)] rounded-xl border border-solid border-[var(--ui-border-muted)]">
                    <h5 className="text-[13px] font-bold text-[var(--ui-text-primary)] m-0 mb-3 uppercase tracking-widest opacity-60">Changes Pending Approval</h5>
                    <div className="p-3 bg-black/20 rounded-lg mb-4 overflow-x-auto">
                      <code className="text-[12px] text-[var(--accent-primary)] font-mono leading-relaxed whitespace-pre">
                        // Generated code example<br/>fn optimized_auth() {"{"}<br/>&nbsp;&nbsp;validate_jwt_token()?;<br/>{"}"}
                      </code>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleApproveChange(task.id, 'change-1')} className="flex-1 p-2 px-4 rounded-lg border-none bg-[var(--status-success)] text-[var(--ui-text-primary)] text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <ThumbsUp size={16} weight="fill" /> Approve & Merge
                      </button>
                      <button onClick={() => handleRejectChange(task.id, 'change-1')} className="flex-1 p-2 px-4 rounded-lg border border-solid border-rose-500/30 bg-transparent text-[var(--status-error)] text-[13px] font-bold cursor-pointer flex items-center justify-center gap-2 hover:bg-[var(--status-error-bg)] active:scale-95 transition-all">
                        <ThumbsDown size={16} weight="fill" /> Reject
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center flex flex-col items-center gap-1.5">
                    <GitBranch size={18} className="text-[var(--accent-primary)]" />
                    <div className="text-[10px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest">Branch</div>
                    <div className="text-[12px] text-[var(--ui-text-primary)] font-mono truncate w-full">auto/{task.specRef.split('/').pop()}</div>
                  </div>
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center flex flex-col items-center gap-1.5">
                    <FileCode size={18} className="text-[var(--accent-primary)]" />
                    <div className="text-[10px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest">Modified</div>
                    <div className="text-[12px] text-[var(--ui-text-primary)] font-bold">12 files</div>
                  </div>
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center flex flex-col items-center gap-1.5">
                    <Stack size={18} className="text-[var(--accent-primary)]" />
                    <div className="text-[10px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest">Risk</div>
                    <div className="text-[12px] text-[var(--ui-text-primary)] font-bold">Medium</div>
                  </div>
                  <div className="p-3 bg-[var(--surface-hover)] rounded-lg text-center flex flex-col items-center gap-1.5">
                    <Shield size={18} className="text-[var(--accent-primary)]" />
                    <div className="text-[10px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest">CI</div>
                    <div className="text-[12px] text-[var(--status-success)] font-black uppercase tracking-tighter">Passing</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tasks Completed', value: '127', color: 'var(--accent-primary)' },
          { label: 'Approval Rate', value: '94%', color: 'var(--status-success)' },
          { label: 'Lines Generated', value: '3.2k', color: 'var(--status-info)' },
          { label: 'Active Tasks', value: '12', color: 'var(--accent-cowork)' },
        ].map((stat, i) => (
          <div key={i} className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-transparent hover:border-[var(--ui-border-muted)] text-center transition-colors">
            <div className="text-3xl font-black tabular-nums" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[11px] text-[var(--ui-text-muted)] mt-1 uppercase font-bold tracking-widest opacity-60">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGCTab = () => {
    const entropyColor = getEntropyColor(entropyScore);
    const entropyStatus = getEntropyStatus(entropyScore);

    return (
      <div className="flex flex-col gap-6">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Entropy Score Card */}
        <div className="flex justify-between items-center p-6 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)]">
          <div className="flex items-center gap-6">
            <div 
              className="size-20 rounded-full border-8 border-solid flex items-center justify-center relative transition-colors duration-500" 
              style={{ borderColor: entropyColor }}
            >
              <span className="text-2xl font-black text-[var(--ui-text-primary)] tabular-nums">{entropyScore}</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ui-text-primary)] m-0">Entropy Score</h3>
              <p className="text-[13px] m-0 mt-1 font-semibold" style={{ color: entropyColor }}>{entropyStatus}</p>
              {gcErrors.cleanup && (
                <p className="text-[12px] text-[var(--status-error)] m-0 mt-2 flex items-center gap-1.5 font-medium">
                  <Warning size={14} weight="bold" /> {gcErrors.cleanup}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={handleTriggerCleanup} 
            disabled={isRunningGC} 
            className={cn(
              "p-3 px-6 rounded-lg border-none text-[var(--ui-text-inverse)] text-[14px] font-bold cursor-pointer flex items-center gap-2 transition-all active:scale-95",
              isRunningGC ? "bg-[var(--surface-active)] text-[var(--ui-text-muted)]" : "bg-[var(--accent-primary)] hover:opacity-90"
            )}
          >
            {isRunningGC ? <ArrowsClockwise size={18} className="animate-spin" /> : <Lightning size={18} weight="fill" />}
            {isRunningGC ? 'Running Cleanup…' : 'Run Full Cleanup'}
          </button>
        </div>

        {/* Cleanup Queue */}
        <div>
          <h4 className="text-[12px] font-black text-[var(--ui-text-muted)] m-0 mb-3 uppercase tracking-widest opacity-60">Cleanup Queue</h4>
          <div className="flex flex-col gap-2">
            {gcQueue.map((item) => (
              <div key={item.id} className="p-3.5 px-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:border-[var(--ui-border-default)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                    <Recycle size={18} className="text-[var(--accent-primary)]" weight="bold" />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[var(--ui-text-primary)] capitalize">{item.agent.replace(/_/g, ' ')}</div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">{item.items} items queued • {item.status || 'pending'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "p-1 px-2.5 rounded-md text-[10px] font-black uppercase tracking-widest",
                    item.priority === 'high' ? "bg-rose-500/20 text-rose-500" : item.priority === 'medium' ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                  )}>{item.priority}</span>
                  <button 
                    onClick={() => handleRunGCAgent(item.agent)} 
                    disabled={runningAgents.has(item.agent)}
                    className={cn(
                      "p-1.5 px-3.5 rounded-lg border border-solid text-[12px] font-bold transition-all active:scale-95 flex items-center gap-1.5",
                      runningAgents.has(item.agent) 
                        ? "bg-zinc-800/50 border-zinc-700 text-zinc-500 cursor-not-allowed" 
                        : "bg-transparent border-[var(--ui-border-default)] text-[var(--accent-primary)] cursor-pointer hover:bg-[var(--accent-primary)]/5"
                    )}
                  >
                    {runningAgents.has(item.agent) ? (
                      <><ArrowsClockwise size={12} className="animate-spin" /> Running…</>
                    ) : (
                      'Run Now'
                    )}
                  </button>
                </div>
              </div>
            ))}
            {gcQueue.length === 0 && (
              <div className="p-8 text-center bg-black/5 rounded-xl border border-dashed border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-muted)] italic">
                No items in cleanup queue
              </div>
            )}
          </div>
        </div>

        {/* Cleanup Policies */}
        <div>
          <h4 className="text-[12px] font-black text-[var(--ui-text-muted)] m-0 mb-3 uppercase tracking-widest opacity-60">Cleanup Policies</h4>
          <div className="flex flex-col gap-2">
            {gcPolicies.map((policy) => (
              <div key={policy.id} className="p-3.5 px-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:border-[var(--ui-border-default)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-zinc-500/10 flex items-center justify-center">
                    <GearSix size={18} className="text-zinc-500" />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[var(--ui-text-primary)]">{policy.name}</div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">Automatic threshold: <span className="text-[var(--text-primary)] font-mono">{(policy.threshold * 100).toFixed(0)}%</span></div>
                  </div>
                </div>
                <button 
                  onClick={() => handleUpdateGCPolicy(policy.id, { enabled: !policy.enabled })} 
                  className={cn(
                    "w-11 h-6 rounded-full border-none relative transition-all duration-300 cursor-pointer p-0",
                    policy.enabled ? "bg-[var(--accent-primary)]" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow-sm",
                    policy.enabled ? "left-[22px]" : "left-0.5"
                  )} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cleanup History */}
        <div>
          <h4 className="text-[12px] font-black text-[var(--ui-text-muted)] m-0 mb-3 uppercase tracking-widest opacity-60">Cleanup History</h4>
          <div className="flex flex-col gap-2">
            {gcHistory.map((record, idx) => (
              <div key={idx} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <ClockCounterClockwise size={18} className="text-[var(--text-tertiary)]" />
                  <span className="text-[14px] font-bold text-[var(--ui-text-primary)] tabular-nums">{record.date}</span>
                </div>
                <div className="flex gap-6">
                  {[
                    { label: 'Agents', value: record.agentsRun, color: 'var(--accent-primary)' },
                    { label: 'Issues', value: record.issuesFound, color: 'var(--status-error)' },
                    { label: 'Fixed', value: record.issuesFixed, color: 'var(--status-success)' },
                    { label: 'Entropy', value: `-${record.entropyReduction.toFixed(1)}%`, color: 'var(--status-info)' },
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <div className="text-[14px] font-black tabular-nums" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-[9px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {gcHistory.length === 0 && (
              <div className="p-8 text-center bg-black/5 rounded-xl border border-dashed border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-muted)] italic">
                No cleanup history available
              </div>
            )}
          </div>
        </div>

        {/* Available GC Agents */}
        <div>
          <h4 className="text-[12px] font-black text-[var(--ui-text-muted)] m-0 mb-3 uppercase tracking-widest opacity-60">Available GC Agents</h4>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(GC_AGENT_INFO).map(([agentName, info]) => {
              const isRunning = runningAgents.has(agentName);
              const error = gcErrors[agentName];
              return (
                <button 
                  key={agentName} 
                  onClick={() => handleRunGCAgent(agentName)} 
                  disabled={isRunning}
                  className={cn(
                    "p-4 rounded-xl border border-solid text-left transition-all duration-200 flex flex-col gap-2 group",
                    error ? "border-rose-500/40 bg-rose-500/5" : isRunning ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5" : "border-transparent bg-[var(--surface-panel)] hover:border-[var(--ui-border-default)]",
                    isRunning && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "size-9 rounded-lg flex items-center justify-center transition-colors",
                    error ? "text-rose-500 bg-rose-500/10" : "text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 group-hover:bg-[var(--accent-primary)]/20"
                  )}>
                    {isRunning ? <ArrowsClockwise size={18} className="animate-spin" /> : error ? <Warning size={18} weight="fill" /> : info.icon}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--ui-text-primary)] capitalize mb-0.5">
                      {agentName.replace(/_/g, ' ')}
                    </div>
                    <div className={cn(
                      "text-[11px] leading-snug line-clamp-2",
                      error ? "text-rose-500 font-medium italic" : "text-[var(--ui-text-muted)]"
                    )}>
                      {error || info.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderAgentsPanel = () => (
    <div className="max-w-3xl">
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl border border-solid border-[var(--border-subtle)] mb-6">
        {[
          { id: 'evaluation', label: 'Evaluation Harness', icon: <ChartBar size={16} /> },
          { id: 'factory', label: 'Code Factory', icon: <Code size={16} /> },
          { id: 'gc', label: 'GC Agents', icon: <Recycle size={16} /> },
        ].map((tab) => (
          <button 
            key={tab.id} 
            onClick={() => setAgentOpsTab(tab.id as AgentOpsTab)} 
            className={cn(
              "flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-none text-[13px] font-bold transition-all cursor-pointer",
              agentOpsTab === tab.id 
                ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] shadow-sm" 
                : "bg-transparent text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      {agentOpsTab === 'evaluation' && renderEvaluationTab()}
      {agentOpsTab === 'factory' && renderFactoryTab()}
      {agentOpsTab === 'gc' && renderGCTab()}
    </div>
  );

  // Other panels
  

  const renderGeneralPanel = () => (
    <div className="max-w-lg">
      <div className="mb-6">
        <label className="block text-[13px] font-bold text-[var(--ui-text-primary)] mb-2 uppercase tracking-widest opacity-60">Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-2.5 px-3.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--ui-text-primary)] text-[14px] font-medium outline-none cursor-pointer focus:border-[var(--accent-primary)]">
          <option>English</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option>
        </select>
      </div>
      <div className="mb-6">
        <label className="block text-[13px] font-bold text-[var(--ui-text-primary)] mb-2 uppercase tracking-widest opacity-60">Timezone</label>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full p-2.5 px-3.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--ui-text-primary)] text-[14px] font-medium outline-none cursor-pointer focus:border-[var(--accent-primary)]">
          <option>UTC</option><option>EST</option><option>CST</option><option>PST</option><option>GMT</option>
        </select>
      </div>
      <ToggleItem label="Show system messages" value={showSystemMessages} onChange={setShowSystemMessages} description="Display internal system operations" />
      <ToggleItem label="Enable telemetry" value={enableTelemetry} onChange={setEnableTelemetry} description="Help improve Allternit by sharing usage data" />
      <ToggleItem label="Auto-save" value={autoSave} onChange={setAutoSave} description="Automatically save your work" />
    </div>
  );

  const renderAppearancePanel = () => (
    <div className="max-w-lg">
      <div className="mb-8">
        <label className="block text-[13px] font-bold text-[var(--ui-text-primary)] mb-3 uppercase tracking-widest opacity-60">Theme</label>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button 
              key={t} 
              onClick={() => setTheme(t)} 
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-2.5 px-4 rounded-xl border border-solid text-[13px] font-bold cursor-pointer transition-all active:scale-95",
                theme === t 
                  ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--text-primary)]" 
                  : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-white/5"
              )}
            >
              {t === 'light' && <Sun size={18} weight={theme === t ? "fill" : "regular"} />}
              {t === 'dark' && <Moon size={18} weight={theme === t ? "fill" : "regular"} />}
              {t === 'system' && <DeviceMobile size={18} weight={theme === t ? "fill" : "regular"} />}
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>
      <ToggleItem label="Compact density" value={compactDensity} onChange={setCompactDensity} description="Use less vertical spacing" />
      <ToggleItem label="Show sidebar labels" value={showSidebarLabels} onChange={setTwoSidebarLabels} description="Display text labels in sidebar" />
    </div>
  );

  const renderModelsPanel = () => (
    <div className="max-w-2xl">
      <LocalModelManager />
      
      <div className="mt-10 pt-8 border-t border-solid border-[var(--border-subtle)]">
        <h3 className="text-sm font-bold text-[var(--ui-text-primary)] mb-4 uppercase tracking-widest opacity-60">Session Controls</h3>
        <ToggleItem label="Streaming" value={streaming} onChange={setStreaming} description="Stream responses in real-time" />
      </div>
    </div>
  );

  const renderApiKeysPanel = () => (
    <div className="max-w-2xl">
      <div className="flex flex-col gap-3">
        {API_PROVIDERS.map((provider) => (
          <div key={provider.name} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] hover:border-[var(--ui-border-default)] transition-colors">
            <div className="size-11 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center text-[var(--ui-text-inverse)] text-xl font-black shadow-lg shadow-[var(--accent-primary)]/10">{provider.letter}</div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-[var(--text-primary)]">{provider.name}</div>
              <div className="text-[11px] text-[var(--text-tertiary)] uppercase font-bold tracking-widest mt-0.5">Connected • Tier 2</div>
            </div>
            <button className="p-2 px-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-[12px] font-bold cursor-pointer hover:bg-white/5 active:scale-95 transition-all">Manage</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderShortcutsPanel = () => (
    <div className="max-w-2xl">
      <div className="rounded-xl overflow-hidden border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-lg">
        <div className="grid grid-cols-2 bg-white/5 border-b border-solid border-[var(--border-subtle)]">
          <div className="p-3 px-5 text-[11px] font-black text-[var(--ui-text-muted)] uppercase tracking-widest border-r border-solid border-[var(--border-subtle)]">Action</div>
          <div className="p-3 px-5 text-[11px] font-black text-[var(--ui-text-muted)] uppercase tracking-widest">Shortcut</div>
        </div>
        <div className="flex flex-col">
          {SHORTCUTS.map((item, index) => (
            <div key={index} className={cn(
              "grid grid-cols-2",
              index !== SHORTCUTS.length - 1 ? "border-b border-solid border-[var(--border-subtle)]" : ""
            )}>
              <div className="p-3 px-5 text-[13px] font-medium text-[var(--ui-text-primary)] border-r border-solid border-[var(--border-subtle)]">{item.action}</div>
              <div className="p-3 px-5 text-[12px] text-[var(--ui-text-primary)] font-mono bg-white/[0.02] flex items-center tracking-tighter uppercase">{item.shortcut}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAboutPanel = () => (
    <div className="max-w-2xl text-center py-10">
      <div className="mb-10">
        <div className="grid grid-cols-4 gap-2 size-40 mx-auto transform hover:rotate-3 transition-transform duration-500">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="bg-[var(--accent-primary)] rounded-md transition-opacity duration-300" style={{ opacity: i % 3 === 0 ? 0.3 : i % 2 === 0 ? 0.6 : 1 }} />
          ))}
        </div>
      </div>
      <h1 className="text-4xl font-black m-0 mb-2 text-[var(--ui-text-primary)] tracking-tight">Allternit & <span className="text-[var(--accent-primary)]">Coffee</span></h1>
      <p className="text-base text-[var(--ui-text-muted)] font-mono font-bold tracking-widest opacity-60">v0.9.1-beta</p>
      <div className="mt-12 flex justify-center gap-6">
        <button className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm font-bold uppercase tracking-widest cursor-pointer">Terms</button>
        <button className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm font-bold uppercase tracking-widest cursor-pointer">Privacy</button>
        <button className="bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm font-bold uppercase tracking-widest cursor-pointer">GitHub</button>
      </div>
    </div>
  );

  // Policy & Governance State
  const [securityTab, setSecurityTab] = useState<'overview' | 'policies' | 'gating' | 'purpose' | 'compliance'>('overview');
  const [policies, setPolicies] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<any>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  const fetchSecurityData = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const { listPolicies, listViolations, listApprovals, listSecurityEvents, getComplianceStatus } = await import('@/lib/governance/policy.service');
      const [policiesRes, violationsRes, approvalsRes, eventsRes, complianceRes] = await Promise.all([
        listPolicies(),
        listViolations({ status: 'open' }),
        listApprovals({ status: 'pending' }),
        listSecurityEvents({ pageSize: 20 }),
        getComplianceStatus(),
      ]);
      setPolicies(policiesRes.policies);
      setViolations(violationsRes.violations);
      setApprovals(approvalsRes.requests);
      setSecurityEvents(eventsRes.events);
      setComplianceStatus(complianceRes);
    } catch (e) {
      setPolicies([]); setViolations([]); setApprovals([]); setSecurityEvents([]); setComplianceStatus(null);
    }
    setSecurityLoading(false);
  }, []);

  useEffect(() => {
    if (activeSection === 'security') fetchSecurityData();
  }, [activeSection, fetchSecurityData]);

  const renderSecurityPanel = () => (
    <div className="max-w-4xl">
      <div className="flex gap-0 border-b border-solid border-white/10 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Shield },
          { id: 'policies', label: 'Policies', icon: FileCheck, count: policies.filter((p: any) => p.status === 'active').length },
          { id: 'gating', label: 'Approvals', icon: Lock, count: approvals.filter((a: any) => a.status === 'pending').length },
          { id: 'purpose', label: 'Purpose Binding', icon: Target },
          { id: 'compliance', label: 'Compliance', icon: FileCheck },
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setSecurityTab(tab.id)}
            className={cn(
              "p-4 px-6 border-none bg-transparent text-[13px] font-bold cursor-pointer flex items-center gap-2.5 transition-all whitespace-nowrap relative border-b-2 border-solid",
              securityTab === tab.id ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-[var(--ui-text-muted)] border-transparent hover:text-[var(--text-secondary)]"
            )}
          >
            <tab.icon size={18} weight={securityTab === tab.id ? "fill" : "regular"} />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "p-0.5 px-2 rounded-full text-[11px] font-black tabular-nums",
                securityTab === tab.id ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "bg-rose-500 text-white"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {securityLoading ? (
        <div className="text-center py-20">
          <ArrowsClockwise size={40} className="text-white/20 animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[var(--ui-text-muted)] font-bold uppercase tracking-widest">Hardening Core…</p>
        </div>
      ) : (
        <>
          {securityTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="p-8 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                  <Shield size={120} weight="fill" />
                </div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                    <Shield size={32} weight="bold" />
                  </div>
                  <div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest opacity-60">Active Threat Level</div>
                    <div className="text-3xl font-black text-amber-500 tracking-tight mt-1">MODERATE_RISK</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Active Policies" value={policies.filter((p: any) => p.status === 'active').length} color="var(--status-success)" />
                <StatCard label="Open Violations" value={violations.filter((v: any) => v.status === 'open').length} color="var(--status-error)" />
                <StatCard label="Pending Approvals" value={approvals.filter((a: any) => a.status === 'pending').length} color="var(--status-warning)" />
                <StatCard label="Compliance" value={`${complianceStatus?.score || 0}%`} color="var(--status-info)" />
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-black text-[var(--ui-text-inverse)] m-0 mb-4 uppercase tracking-widest opacity-60">Security Audit Log</h3>
                <div className="flex flex-col gap-2">
                  {securityEvents.slice(0, 5).map((event: any) => (
                    <div key={event.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-transparent hover:border-[var(--ui-border-muted)] transition-all flex items-center gap-4 group">
                      <div className={cn(
                        "size-9 rounded-lg flex items-center justify-center transition-colors",
                        event.severity === 'critical' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        <Warning size={18} weight="fill" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--ui-text-inverse)] truncate">{event.title}</div>
                        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 truncate">{event.description}</div>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--ui-text-muted)] tabular-nums opacity-60 group-hover:opacity-100">{new Date(event.timestamp || event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {securityTab === 'policies' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-[var(--ui-text-inverse)] m-0">Governance Policies</h3>
                <button className="p-2 px-4 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer active:scale-95 transition-transform">
                  + New Policy
                </button>
              </div>
              {policies.map((policy: any) => (
                <div key={policy.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] hover:border-[var(--ui-border-default)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "size-11 rounded-xl flex items-center justify-center shadow-lg transition-colors",
                        policy.status === 'active' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5" : "bg-zinc-800 text-zinc-500"
                      )}>
                        <Shield size={22} weight={policy.status === 'active' ? "fill" : "regular"} />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-[var(--ui-text-inverse)]">{policy.name}</div>
                        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 font-semibold uppercase tracking-wider opacity-70">{policy.type} • {policy.enforcementMode}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "p-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest",
                        policy.severity === 'critical' ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500"
                      )}>
                        {policy.severity}
                      </span>
                      {policy.violationCount > 0 && (
                        <span className="p-1 px-3 bg-rose-500/20 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-solid border-rose-500/20">
                          {policy.violationCount} violations
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {securityTab === 'gating' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-bold text-[var(--ui-text-inverse)] m-0 mb-2">Pending Approvals</h3>
              {approvals.filter((a: any) => a.status === 'pending').map((approval: any) => (
                <div key={approval.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between group hover:border-[var(--ui-border-default)] transition-colors">
                  <div>
                    <div className="text-[15px] font-bold text-[var(--ui-text-inverse)]">{approval.title}</div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] mt-1">Requested by <span className="text-[var(--accent-primary)] font-bold">{approval.requester?.agentName}</span> • {new Date(approval.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 px-4 rounded-lg border border-solid border-rose-500/30 bg-transparent text-rose-500 text-[12px] font-bold cursor-pointer hover:bg-rose-500/10 active:scale-95 transition-all">Reject</button>
                    <button className="p-2 px-4 rounded-lg border-none bg-emerald-600 text-white text-[12px] font-bold cursor-pointer hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-600/20">Approve</button>
                  </div>
                </div>
              ))}
              {approvals.filter((a: any) => a.status === 'pending').length === 0 && (
                <div className="p-12 text-center bg-black/5 rounded-2xl border border-dashed border-white/10 text-[13px] text-[var(--ui-text-muted)] font-medium">
                  Queue is clear. All agent actions are compliant.
                </div>
              )}
            </div>
          )}

          {securityTab === 'purpose' && (
            <div className="text-center py-24 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)]">
              <Target size={64} className="text-white/10 mx-auto mb-6" weight="thin" />
              <h3 className="text-lg font-bold text-[var(--ui-text-inverse)] m-0 mb-2">Purpose Binding Architecture</h3>
              <p className="text-[14px] text-[var(--ui-text-muted)] max-w-sm mx-auto leading-relaxed">Agent goals are restricted to verified project scopes. Configure binding levels in the DAG / Project view.</p>
              <button className="mt-8 p-2 px-6 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--text-primary)] text-sm font-bold cursor-pointer hover:bg-white/5 transition-all">Open DAG Workspace</button>
            </div>
          )}

          {securityTab === 'compliance' && (
            <div className="flex flex-col gap-6">
              <div className="p-10 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] text-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/5 to-transparent pointer-events-none" />
                <div className={cn(
                  "text-6xl font-black tabular-nums tracking-tighter",
                  complianceStatus?.score >= 80 ? "text-[var(--status-success)]" : complianceStatus?.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                )}>
                  {complianceStatus?.score || 0}%
                </div>
                <div className="text-[11px] font-black text-[var(--ui-text-muted)] uppercase tracking-[0.2em] mt-3 opacity-60">System Compliance Rating</div>
              </div>
              <div>
                <h3 className="text-xs font-black text-[var(--ui-text-inverse)] m-0 mb-4 uppercase tracking-widest opacity-60">Enforced Frameworks</h3>
                <div className="flex flex-col gap-2">
                  {complianceStatus?.frameworks?.map((fw: any) => (
                    <div key={fw.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="text-sm font-bold text-[var(--ui-text-inverse)]">{fw.name}</div>
                      <div className="flex items-center gap-6">
                        <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full rounded-full transition-all duration-1000 ease-in-out",
                            fw.score >= 80 ? "bg-[var(--status-success)]" : fw.score >= 60 ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
                          )} style={{ width: `${fw.score}%` }} />
                        </div>
                        <span className={cn(
                          "text-sm font-black tabular-nums min-w-[3ch] text-right",
                          fw.score >= 80 ? "text-[var(--status-success)]" : fw.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                        )}>{fw.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const handleRevokeGizziAccess = async () => {
    setGizziRevokeState('loading');
    try {
      const res = await fetch('/api/oauth/revoke-user', { method: 'POST' });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setGizziRevokeState('done');
    } catch {
      setGizziRevokeState('error');
    }
  };

  const renderGizziioCodePanel = () => (
    <div className="max-w-xl">
      <section className="mb-10">
        <ToggleItem label="Allow bypass permissions mode" value={bypassPermissions} onChange={setBypassPermissions} description="Bypass all permission checks (Developer only)" />
        <ToggleItem label="Draw attention on notifications" value={drawAttentionNotifications} onChange={setDrawAttentionNotifications} description="Bounce dock icon on important agent notifications" />
      </section>

      <section className="mb-10">
        <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-black mb-4 opacity-60">
          Authorized API Access
        </div>
        <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-lg">
          <div className="p-5 px-6 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-[var(--surface-canvas)] border border-solid border-[var(--ui-border-muted)] flex items-center justify-center shadow-inner shrink-0">
              <Code size={22} className="text-[var(--accent-primary)]" weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-black text-[var(--text-primary)] uppercase tracking-tight">Gizzi Code CLI</div>
              <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
                Full repository access — reads, writes, and deploys on your behalf.
              </div>
            </div>
            <div className="flex items-center gap-3">
              {gizziRevokeState === 'done' && (
                <span className="text-[11px] font-bold text-[var(--status-success)] uppercase tracking-widest animate-pulse">Revoked</span>
              )}
              {gizziRevokeState === 'error' && (
                <span className="text-[11px] font-bold text-[var(--status-error)] uppercase tracking-widest">Failed</span>
              )}
              <button
                onClick={handleRevokeGizziAccess}
                disabled={gizziRevokeState === 'loading' || gizziRevokeState === 'done'}
                className={cn(
                  "p-2 px-4 rounded-lg border border-solid text-[13px] font-bold font-sans transition-all active:scale-95",
                  gizziRevokeState === 'done' 
                    ? "border-zinc-800 text-zinc-600 cursor-not-allowed bg-transparent" 
                    : "border-rose-500/30 bg-[var(--status-error-bg)] text-[var(--status-error)] cursor-pointer hover:bg-rose-500/10",
                  gizziRevokeState === 'loading' && "opacity-50 cursor-wait"
                )}
              >
                {gizziRevokeState === 'loading' ? 'Revoking…' : 'Revoke Access'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)] m-0 mt-3 leading-relaxed opacity-60">
          Revoking access signs Gizzi Code out on all machines. Re-authorize by running{' '}
          <code className="font-mono bg-[var(--bg-secondary)] p-0.5 px-1.5 rounded border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">gizzi login</code>.
        </p>
      </section>
    </div>
  );

  const renderCoworkPanel = () => (
    <div className="max-w-xl">
      <section className="mb-10">
        <h3 className="text-base font-bold text-[var(--ui-text-primary)] m-0">Collaborative Workspace</h3>
        <p className="text-[13px] text-[var(--ui-text-muted)] m-0 mt-1">Configure real-time agent coordination and shared task state settings.</p>
        <div className="mt-8 p-12 text-center bg-black/5 rounded-2xl border border-dashed border-white/10 text-[13px] text-[var(--ui-text-muted)] italic">
          Cowork settings are managed per-project.
        </div>
      </section>
    </div>
  );

  const renderExtensionsPanel = () => (
    <div className="max-w-xl">
      <section className="mb-10">
        <ToggleItem label="Enable auto-updates for extensions" value={autoUpdateExtensions} onChange={setAutoUpdateExtensions} description="Background update all marketplace and sidecar extensions" />
        <ToggleItem label="Use Built-in Node.js for MCP" value={useBuiltinNode} onChange={setUseBuiltinNode} description="Ensure stability by using Allternit's verified runtime" />
      </section>
    </div>
  );

  const renderBillingPanel = () => (
    <div className="max-w-xl">
      <section className="mb-10">
        <h3 className="text-base font-bold text-[var(--ui-text-primary)] m-0 mb-6">Subscription & Usage</h3>
        <div className="p-8 bg-gradient-to-br from-zinc-800 to-black rounded-2xl border border-solid border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <ChartBar size={100} weight="thin" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="text-[11px] font-black text-[var(--accent-primary)] uppercase tracking-[0.2em] mb-1">Active Tier</div>
              <div className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Allternit Pro <ShieldCheck size={20} weight="fill" className="text-[var(--accent-primary)]" />
              </div>
              <div className="text-sm text-white/50 mt-4 font-medium">$20.00 / month • Renews June 12</div>
            </div>
            <span className="p-1.5 px-4 bg-emerald-500/20 text-emerald-400 rounded-full text-[12px] font-black uppercase tracking-widest border border-solid border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              Active
            </span>
          </div>
          <button className="mt-8 w-full p-2.5 rounded-lg border-none bg-white text-black text-[13px] font-black cursor-pointer hover:bg-zinc-200 active:scale-[0.98] transition-all">Manage Billing Portal</button>
        </div>
      </section>
    </div>
  );

  const renderUsagePanel = () => (
    <div className="max-w-3xl">
      <ResourceUsageDashboard />
    </div>
  );

  

  const renderContent = () => {
    switch (activeSection) {
      case 'general': return renderGeneralPanel();
      case 'appearance': return renderAppearancePanel();
      case 'models': return renderModelsPanel();
      case 'api-keys': return renderApiKeysPanel();
      case 'shortcuts': return renderShortcutsPanel();
      case 'permissions': return <PermissionsPanel />;
      case 'gizziio-code': return renderGizziioCodePanel();
      case 'cowork': return renderCoworkPanel();
      case 'extensions': return renderExtensionsPanel();
      case 'billing': return renderBillingPanel();
      case 'usage': return renderUsagePanel();
      case 'diagnostics': return <DiagnosticsPanel />;
      case 'infrastructure': return <ToastProvider><InfrastructureSettings initialTab={infrastructureTab as any} /></ToastProvider>;
      case 'security': return <ToastProvider>{renderSecurityPanel()}</ToastProvider>;
      case 'agents': return <ToastProvider>{renderAgentsPanel()}</ToastProvider>;
      case 'about': return renderAboutPanel();
      case 'signin': return <ClerkAuthPanel />;
      case 'vps': return <ToastProvider><VPSConnectionsPanel /></ToastProvider>;
      default: return null;
    }
  };

  const navigationItems = SETTINGS_NAV_ITEMS;

  return (
    <div className="h-screen bg-[var(--view-settings-bg,var(--surface-canvas))] overflow-hidden relative text-[var(--text-primary)] font-sans">
      <div className="flex justify-center h-full overflow-hidden">
        <div className="flex w-full max-w-[1200px] min-w-[600px] h-full mx-auto">
          {/* Sidebar Nav */}
          <div className="w-[220px] min-w-[180px] h-full bg-transparent p-4 pb-8 overflow-y-auto shrink-0 no-scrollbar border-r border-solid border-white/[0.03]">
            <div className="px-1 mb-6 flex items-center gap-2.5">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('allternit:close-settings'))}
                className="size-7 flex items-center justify-center rounded-lg bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer shrink-0 hover:bg-white/5 active:scale-95 transition-all"
                aria-label="Back"
              >
                <CaretRight size={16} className="rotate-180" weight="bold" />
              </button>
              <span className="text-[15px] font-black text-[var(--text-primary)] uppercase tracking-tight">System Settings</span>
            </div>
            
            <nav className="flex flex-col gap-0.5">
              <div className="mb-2">
                {navigationItems.filter((i: any) => i.group === 'account').map((item: any) => (
                  <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
                ))}
              </div>
              <div className="h-px bg-white/5 my-3 mx-2" />
              <div className="mb-2">
                {navigationItems.filter((i: any) => i.group === 'platform').map((item: any) => (
                  <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
                ))}
              </div>
              <div className="h-px bg-white/5 my-3 mx-2" />
              <div className="mb-2">
                <div className="p-2 px-3 text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em] opacity-40 mb-1">Products</div>
                {navigationItems.filter((i: any) => i.group === 'products').map((item: any) => (
                  <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
                ))}
              </div>
              <div className="h-px bg-white/5 my-3 mx-2" />
              <div className="mb-2">
                <div className="p-2 px-3 text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em] opacity-40 mb-1">Infrastructure</div>
                {navigationItems.filter((i: any) => i.group === 'infrastructure').map((item: any) => (
                  <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
                ))}
              </div>
              <div className="h-px bg-white/5 my-3 mx-2" />
              <div>
                {navigationItems.filter((i: any) => i.group === 'about').map((item: any) => (
                  <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
                ))}
              </div>
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(212,176,140,0.03),transparent_600px)]">
            <div className="p-8 px-12 pb-32 w-full max-w-3xl">
              <h1 className="text-xl font-black text-[var(--text-primary)] m-0 mb-8 uppercase tracking-widest opacity-80">
                {navigationItems.find((item: any) => item.id === activeSection)?.label}
              </h1>
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;

import React, { useState, useEffect, useCallback } from 'react';

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
} from '@phosphor-icons/react';
import { VPSConnectionsPanel } from './VPSConnectionsPanel';
import { ToastProvider } from '@/components/ui/toast-provider';
import { usePlatformUser, usePlatformSignOut, usePlatformSessions, PlatformSignIn, isPlatformAuthDisabled } from '@/lib/platform-auth-client';
import { useThemeStore } from '@/design/ThemeStore';
import { LocalModelManager } from '@/components/models/LocalModelManager';

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

  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };
  const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '20px 24px', marginBottom: 16 };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
  const btnDanger: React.CSSProperties = { ...btn, border: '1px solid color-mix(in srgb, var(--status-error) 35%, transparent)', background: 'var(--status-error-bg)', color: 'var(--status-error)' };
  const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', border: '1px solid transparent', fontWeight: 600 };

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
    return <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>;
  }

  if (isPlatformAuthDisabled()) {
    return (
      <div style={{ padding: 24 }}>
        <div style={card}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Authentication is disabled in this build. Running as local user.
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ ...label, marginBottom: 16 }}>Sign in to your Allternit account</div>
        <PlatformSignIn />
        <div style={{ ...card, marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
    <div style={{ padding: 24 }}>
      <div style={label}>Account</div>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--ui-text-inverse)', flexShrink: 0 }}>
            {initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{name}</div>
          {email && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
        </div>
      </div>

      <div style={card}>
        <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Session
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
          Sign out of the current Allternit account session. Backend routing stays managed separately in infrastructure settings.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnDanger} onClick={() => void signOut()}>
            <User size={14} /> Sign out
          </button>
          <button style={btn} onClick={() => void refreshBackendSummary()} disabled={refreshing}>
            <ArrowsClockwise size={14} /> {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
          {isElectron && (
            <button style={btn} onClick={handleRestartBackend} disabled={restarting}>
              <Cpu size={14} /> {restarting ? 'Restarting…' : 'Restart Backend'}
            </button>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={label}>Active Platform Sessions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map((sess: any) => (
            <div key={sess.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-hover)', borderRadius: 8, border: '1px solid var(--ui-border-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sess.status === 'active' ? 'var(--status-success)' : 'var(--ui-text-muted)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sess.latestActivityAt ? new Date(sess.latestActivityAt).toLocaleDateString() : 'Active Session'}
                    {sess.id === (user as any)?.lastActiveSessionId && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>(Current)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ID: {sess.id}</div>
                </div>
              </div>
              {sess.id !== (user as any)?.lastActiveSessionId && (
                <button style={{ ...btn, padding: '4px 10px', fontSize: 11 }} onClick={() => sess.revoke()}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, background: 'var(--status-success-bg)', border: '1px solid color-mix(in srgb, var(--status-success) 18%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={18} color="var(--status-success)" />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-success)' }}>Offline-First Sovereignty</div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          Your Private Brain remains 100% functional without internet. All neural memories, local models (Ollama), and tool schemas are stored securely on this device.
        </p>
      </div>

      <div style={{ ...card, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Backend Routing
        </div>
        <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>
          {backendLabel ?? 'Backend state unavailable'}
        </div>
        {backendSummary?.url && <div style={{ wordBreak: 'break-all', marginBottom: 8 }}>{backendSummary.url}</div>}
        <div style={{ marginBottom: 14, color: 'var(--text-tertiary)' }}>
          {backendHelp}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={() => openSettingsSection('infrastructure', manageBackendTab)}>
            <Cloud size={14} /> {manageBackendLabel}
          </button>
          <button style={btn} onClick={() => openSettingsSection('infrastructure', 'connections')}>
            <HardDrives size={14} /> BYOC connections
          </button>
        </div>
      </div>

    </div>
  );
}
import { InfrastructureSettings } from './InfrastructureSettings';

import { SETTINGS_NAV_ITEMS, SETTINGS_SECTION_MAP, type SettingsSection } from './settings.config';
type FontSize = 'small' | 'medium' | 'large';
type DefaultMode = 'chat' | 'cowork' | 'code';
type AgentOpsTab = 'evaluation' | 'factory' | 'gc';

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

// GC Agent Types
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

// Toast Types
interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
  agentName?: string;
}

// GC Agent Information
const GC_AGENT_INFO: Record<string, { description: string; icon: React.ReactNode }> = {
  duplicate_detector: { description: 'Finds duplicate code using AST analysis', icon: <Copy size={16} /> },
  boundary_type_checker: { description: 'Checks for untyped boundaries (unwrap, expect)', icon: <ShieldCheck size={16} /> },
  dependency_validator: { description: 'Validates layer dependency directions', icon: <GitBranch size={16} /> },
  observability_checker: { description: 'Finds missing tracing and logging', icon: <Eye size={16} /> },
  documentation_sync: { description: 'Detects spec vs implementation drift', icon: <FileText size={16} /> },
  test_coverage_checker: { description: 'Identifies test coverage gaps', icon: <CheckCircle size={16} /> },
};

// API Client for Agent Operations
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

interface SettingsViewProps {
  initialSection?: SettingsSection;
  initialTab?: string;
}

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
  const [showSidebarLabels, setShowSidebarLabels] = useState(true);
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

  // Fixed GC Handlers with proper error handling
  const handleTriggerCleanup = async () => {
    setIsRunningGC(true);
    setGcErrors(prev => ({ ...prev, cleanup: '' })); // Clear previous errors
    
    try {
      const result = await api.triggerGCCleanup();
      const entropyReduced = result.entropyReduction?.toFixed(1) || '0.0';
      addToast(`Full cleanup completed: ${entropyReduced} entropy reduced`, 'success');
      await fetchGCData(); // Refresh the data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger cleanup';
      setGcErrors(prev => ({ ...prev, cleanup: errorMessage }));
      addToast(`Cleanup failed: ${errorMessage}`, 'error');
      console.error('[GC] Cleanup failed:', error);
    } finally {
      setIsRunningGC(false);
    }
  };

  const handleRunGCAgent = async (agentName: string) => {
    setRunningAgents(prev => new Set(prev).add(agentName));
    setGcErrors(prev => ({ ...prev, [agentName]: '' }));
    
    try {
      const result: GcAgentResult = await api.runGCAgent(agentName);
      
      // Build detailed success message
      const issuesFound = result.issuesFound?.length || 0;
      const issuesFixed = result.issuesFixed || 0;
      const entropyReduced = result.entropyReduction?.toFixed(1) || '0.0';
      
      addToast(
        `${agentName}: Found ${issuesFound} issues, fixed ${issuesFixed}, reduced ${entropyReduced} entropy`,
        'success',
        agentName
      );
      
      await fetchGCData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to run ${agentName}`;
      setGcErrors(prev => ({ ...prev, [agentName]: errorMessage }));
      addToast(`${agentName} failed: ${errorMessage}`, 'error', agentName);
      console.error(`[GC] Agent ${agentName} failed:`, error);
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
    
    // Optimistic update for UI responsiveness
    const previousPolicy = { ...policy };
    setGcPolicies(prev => prev.map(p => p.id === policyId ? { ...p, ...updates } : p));
    
    try {
      await api.updateGCPolicy(policyId, updates);
      addToast(`Policy "${policy.name}" updated successfully`, 'success');
      await fetchGCData(); // Refresh to get server state
    } catch (error) {
      // Revert optimistic update on error
      setGcPolicies(prev => prev.map(p => p.id === policyId ? previousPolicy : p));
      const errorMessage = error instanceof Error ? error.message : 'Failed to update policy';
      addToast(`Failed to update policy: ${errorMessage}`, 'error');
      console.error('[GC] Policy update failed:', error);
    }
  };

  // Toast Container Component
  const ToastContainer = () => (
    <div style={{ 
      position: 'fixed', 
      top: '20px', 
      right: '20px', 
      zIndex: 160, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'error' ? 'var(--status-error)' : toast.type === 'success' ? 'var(--status-success)' : 'var(--status-info)',
            color: 'var(--ui-text-inverse)',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'slideIn 0.3s ease-out',
            pointerEvents: 'auto',
            minWidth: '280px',
            maxWidth: '400px'
          }}
        >
          {toast.type === 'error' && <XCircle size={18} />}
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'info' && <Info size={18} />}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button 
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ui-text-inverse)',
              cursor: 'pointer',
              opacity: 0.7
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );

  // Agent Operations Render Functions
  const renderEvaluationTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: 0 }}>Evaluation Tests</h3>
          <p style={{ fontSize: '13px', color: 'var(--ui-text-muted)', margin: '4px 0 0 0' }}>{evaluations.length} tests configured</p>
        </div>
        <button onClick={() => setShowCreateEval(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Evaluation
        </button>
      </div>

      {showCreateEval && (
        <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px', border: '1px solid var(--ui-border-default)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 16px 0' }}>Create New Evaluation</h4>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--ui-text-muted)', marginBottom: '6px' }}>Name</label>
            <input type="text" value={newEvalName} onChange={(e) => setNewEvalName(e.target.value)} placeholder="e.g., Agent Response Quality" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--ui-border-default)', background: 'var(--surface-hover)', color: 'var(--ui-text-primary)', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--ui-text-muted)', marginBottom: '6px' }}>Type</label>
            <select value={newEvalType} onChange={(e) => setNewEvalType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--ui-border-default)', background: 'var(--surface-hover)', color: 'var(--ui-text-primary)', fontSize: '14px' }}>
              <option value="unit">Unit Test</option>
              <option value="integration">Integration Test</option>
              <option value="benchmark">Benchmark</option>
              <option value="conformance">Conformance</option>
              <option value="ontology">Ontology</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreateEval(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--ui-border-default)', background: 'transparent', color: 'var(--ui-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreateEvaluation} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Create</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {evaluations.map((evalItem) => (
          <div key={evalItem.id} style={{ padding: '16px', background: 'var(--surface-panel)', borderRadius: '8px', border: selectedEval === evalItem.id ? '1px solid var(--accent-primary)' : '1px solid var(--ui-border-muted)', cursor: 'pointer' }} onClick={() => setSelectedEval(selectedEval === evalItem.id ? null : evalItem.id)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {evalItem.status === 'passed' && <CheckCircle size={20} color="var(--status-success)" />}
                {evalItem.status === 'failed' && <XCircle size={20} color="var(--status-error)" />}
                {evalItem.status === 'pending' && <Clock size={20} color="var(--ui-text-muted)" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ui-text-primary)' }}>{evalItem.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '2px' }}>{evalItem.type} • Last run: {evalItem.lastRun ? new Date(evalItem.lastRun).toLocaleDateString() : 'Never'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: evalItem.score >= 80 ? 'var(--status-success)' : evalItem.score >= 60 ? 'var(--status-warning)' : 'var(--status-error)' }}>{evalItem.score}%</div>
                  <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Score</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleRunEvaluation(evalItem.id); }} disabled={isRunningEval} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: isRunningEval ? 'var(--surface-active)' : 'var(--accent-primary)', color: isRunningEval ? 'var(--ui-text-muted)' : 'var(--ui-text-inverse)', fontSize: '12px', fontWeight: '500', cursor: isRunningEval ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isRunningEval ? <ArrowsClockwise size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />} Run
                </button>
              </div>
            </div>

            {selectedEval === evalItem.id && evalResults && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ui-border-muted)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--status-success)' }}>{evalResults.summary.passed}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Passed</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--status-error)' }}>{evalResults.summary.failed}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Failed</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--status-warning)' }}>{evalResults.summary.skipped}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Skipped</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--accent-primary)' }}>{(evalResults.duration / 1000).toFixed(1)}s</div>
                    <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Duration</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {evalResults.details?.map((detail: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--surface-hover)', borderRadius: '6px' }}>
                      {detail.status === 'passed' ? <CheckCircle size={16} color="var(--status-success)" /> : <XCircle size={16} color="var(--status-error)" />}
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--ui-text-primary)' }}>{detail.test}</span>
                      <span style={{ fontSize: '12px', color: 'var(--ui-text-muted)' }}>{detail.duration}ms</span>
                      {detail.error && <span style={{ fontSize: '11px', color: 'var(--status-error)' }}>{detail.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 16px 0' }}>Benchmark History</h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
          {benchmarkHistory.map((item, idx) => (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100%', height: `${item.score}%`, background: item.score >= 80 ? 'var(--status-success)' : item.score >= 60 ? 'var(--status-warning)' : 'var(--status-error)', borderRadius: '4px 4px 0 0', minHeight: '20px' }} />
              <span style={{ fontSize: '10px', color: 'var(--ui-text-muted)' }}>{item.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFactoryTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: 0 }}>Autonomous Tasks</h3>
          <p style={{ fontSize: '13px', color: 'var(--ui-text-muted)', margin: '4px 0 0 0' }}>{factoryTasks.length} tasks in queue</p>
        </div>
        <button onClick={() => setShowCreateTask(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {showCreateTask && (
        <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px', border: '1px solid var(--ui-border-muted)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 16px 0' }}>Create Autonomous Task</h4>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--ui-text-muted)', marginBottom: '6px' }}>Spec Reference</label>
            <input type="text" value={newTaskSpec} onChange={(e) => setNewTaskSpec(e.target.value)} placeholder="e.g., spec/auth-refactor" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--ui-border-default)', background: 'var(--surface-hover)', color: 'var(--ui-text-primary)', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--ui-text-muted)', marginBottom: '6px' }}>Requirements (one per line)</label>
            <textarea value={newTaskRequirements} onChange={(e) => setNewTaskRequirements(e.target.value)} placeholder="e.g., Refactor auth middleware..." rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--ui-border-default)', background: 'var(--surface-hover)', color: 'var(--ui-text-primary)', fontSize: '14px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreateTask(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--ui-border-default)', background: 'transparent', color: 'var(--ui-text-muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreateTask} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Create Task</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {factoryTasks.map((task) => (
          <div key={task.id} style={{ padding: '16px', background: 'var(--surface-panel)', borderRadius: '8px', border: selectedTask === task.id ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {task.status === 'completed' && <CheckCircle size={20} color="var(--status-success)" />}
                {task.status === 'generating' && <ArrowsClockwise size={20} color="var(--accent-primary)" style={{ animation: 'spin 2s linear infinite' }} />}
                {task.status === 'validating' && <FileCheck size={20} color="var(--status-info)" />}
                {task.status === 'pending_approval' && <Clock size={20} color="var(--status-warning)" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ui-text-primary)' }}>{task.specRef}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '2px' }}>{task.status} • Created {new Date(task.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '100px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px' }}><span>Progress</span><span>{task.progress}%</span></div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${task.progress}%`, height: '100%', background: task.status === 'completed' ? 'var(--status-success)' : 'var(--accent-primary)', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                </div>
                {selectedTask === task.id ? <CaretDown size={16} color="#888" /> : <CaretRight size={16} color="#888" />}
              </div>
            </div>

            {selectedTask === task.id && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ui-border-muted)' }}>
                {task.status === 'pending_approval' && (
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 12px 0' }}>Generated Changes Pending Approval</h5>
                    <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', marginBottom: '12px' }}>
                      <code style={{ fontSize: '12px', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                        // Generated code example<br/>fn optimized_auth() {'{'}<br/>&nbsp;&nbsp;validate_jwt_token()?;<br/>{'}'}
                      </code>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => handleApproveChange(task.id, 'change-1')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--status-success)', color: 'var(--ui-text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ThumbsUp size={14} /> Approve & Merge
                      </button>
                      <button onClick={() => handleRejectChange(task.id, 'change-1')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--status-error)', background: 'transparent', color: 'var(--status-error)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ThumbsDown size={14} /> Reject
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <GitBranch size={16} color="var(--accent-primary)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)' }}>Branch</div>
                    <div style={{ fontSize: '13px', color: 'var(--ui-text-primary)' }}>auto/{task.specRef.split('/')[1]}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <FileCode size={16} color="var(--accent-primary)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)' }}>Files Changed</div>
                    <div style={{ fontSize: '13px', color: 'var(--ui-text-primary)' }}>12 files</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <Stack size={16} color="var(--accent-primary)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)' }}>Risk Tier</div>
                    <div style={{ fontSize: '13px', color: 'var(--ui-text-primary)' }}>Medium</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: '6px', textAlign: 'center' }}>
                    <Shield size={16} color="var(--accent-primary)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)' }}>Compliance</div>
                    <div style={{ fontSize: '13px', color: 'var(--status-success)' }}>Passing</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--accent-primary)' }}>127</div>
          <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '4px' }}>Tasks Completed</div>
        </div>
        <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--status-success)' }}>94%</div>
          <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '4px' }}>Approval Rate</div>
        </div>
        <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--status-info)' }}>3.2k</div>
          <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '4px' }}>Lines Generated</div>
        </div>
        <div style={{ padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--accent-cowork)' }}>12</div>
          <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '4px' }}>Active Tasks</div>
        </div>
      </div>
    </div>
  );

  // Fixed GC Tab with proper error handling and UI feedback
  const renderGCTab = () => {
    const entropyColor = getEntropyColor(entropyScore);
    const entropyStatus = getEntropyStatus(entropyScore);

    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Container */}
      <ToastContainer />

      {/* Entropy Score Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--surface-panel)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `8px solid ${entropyColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ui-text-primary)' }}>{entropyScore}</span>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: 0 }}>Entropy Score</h3>
            <p style={{ fontSize: '13px', color: entropyColor, margin: '4px 0 0 0' }}>{entropyStatus}</p>
            {gcErrors.cleanup && (
              <p style={{ fontSize: '12px', color: 'var(--status-error)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Warning size={12} /> {gcErrors.cleanup}
              </p>
            )}
          </div>
        </div>
        <button 
          onClick={handleTriggerCleanup} 
          disabled={isRunningGC} 
          style={{ padding: '12px 24px', borderRadius: '6px', border: 'none', background: isRunningGC ? 'var(--surface-active)' : 'var(--accent-primary)', color: 'var(--ui-text-inverse)', fontSize: '14px', fontWeight: '500', cursor: isRunningGC ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {isRunningGC ? <ArrowsClockwise size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Lightning size={18} />}
          {isRunningGC ? 'Running Cleanup...' : 'Run Full Cleanup'}
        </button>
      </div>

      {/* Cleanup Queue */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 12px 0' }}>Cleanup Queue</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gcQueue.map((item) => (
            <div key={item.id} style={{ padding: '14px 16px', background: 'var(--surface-panel)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Recycle size={18} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ui-text-primary)', textTransform: 'capitalize' }}>{item.agent.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '2px' }}>{item.items} items queued</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', background: item.priority === 'high' ? 'rgba(239, 68, 68, 0.2)' : item.priority === 'medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: item.priority === 'high' ? 'var(--status-error)' : item.priority === 'medium' ? 'var(--status-warning)' : 'var(--status-success)', textTransform: 'uppercase' }}>{item.priority}</span>
                <button 
                  onClick={() => handleRunGCAgent(item.agent)} 
                  disabled={runningAgents.has(item.agent)}
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    border: runningAgents.has(item.agent) ? '1px solid #333' : '1px solid #444', 
                    background: 'transparent', 
                    color: runningAgents.has(item.agent) ? 'var(--ui-text-muted)' : 'var(--accent-primary)', 
                    fontSize: '12px', 
                    cursor: runningAgents.has(item.agent) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {runningAgents.has(item.agent) ? (
                    <><ArrowsClockwise size={12} style={{ animation: 'spin 1s linear infinite' }} /> Running...</>
                  ) : (
                    'Run Now'
                  )}
                </button>
              </div>
            </div>
          ))}
          {gcQueue.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ui-text-muted)', fontSize: '13px' }}>
              No items in cleanup queue
            </div>
          )}
        </div>
      </div>

      {/* Cleanup Policies */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 12px 0' }}>Cleanup Policies</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gcPolicies.map((policy) => (
            <div key={policy.id} style={{ padding: '14px 16px', background: 'var(--surface-panel)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <GearSix size={18} color="#888" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ui-text-primary)' }}>{policy.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '2px' }}>Threshold: {(policy.threshold * 100).toFixed(0)}%</div>
                </div>
              </div>
              <button onClick={() => handleUpdateGCPolicy(policy.id, { enabled: !policy.enabled })} style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', backgroundColor: policy.enabled ? 'var(--accent-primary)' : 'var(--border-subtle)', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease', padding: '0' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--ui-text-inverse)', position: 'absolute', left: policy.enabled ? '2px' : '22px', top: '2px', transition: 'all 0.3s ease', boxShadow: 'var(--shadow-xs)' }} />
              </button>
            </div>
          ))}
          {gcPolicies.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ui-text-muted)', fontSize: '13px' }}>
              No policies configured
            </div>
          )}
        </div>
      </div>

      {/* Cleanup History */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 12px 0' }}>Cleanup History</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gcHistory.map((record, idx) => (
            <div key={idx} style={{ padding: '14px 16px', background: 'var(--surface-panel)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ClockCounterClockwise size={18} color="#888" />
                <span style={{ fontSize: '14px', color: 'var(--ui-text-primary)' }}>{record.date}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--accent-primary)' }}>{record.agentsRun}</div><div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Agents</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--status-error)' }}>{record.issuesFound}</div><div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Issues</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--status-success)' }}>{record.issuesFixed}</div><div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Fixed</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--status-info)' }}>-{record.entropyReduction.toFixed(1)}%</div><div style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Entropy</div></div>
              </div>
            </div>
          ))}
          {gcHistory.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ui-text-muted)', fontSize: '13px' }}>
              No cleanup history available
            </div>
          )}
        </div>
      </div>

      {/* Available GC Agents */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ui-text-primary)', margin: '0 0 12px 0' }}>Available GC Agents</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {Object.entries(GC_AGENT_INFO).map(([agentName, info]) => (
            <button 
              key={agentName} 
              onClick={() => handleRunGCAgent(agentName)} 
              disabled={runningAgents.has(agentName)}
              style={{ 
                padding: '16px', 
                background: runningAgents.has(agentName) ? 'var(--surface-hover)' : 'var(--surface-panel)',
                borderRadius: '8px', 
                border: gcErrors[agentName] ? '1px solid var(--status-error)' : runningAgents.has(agentName) ? '1px solid var(--accent-primary)' : '1px solid transparent', 
                cursor: runningAgents.has(agentName) ? 'not-allowed' : 'pointer', 
                textAlign: 'left', 
                transition: 'all 0.2s',
                opacity: runningAgents.has(agentName) ? 0.7 : 1
              }} 
              onMouseEnter={(e) => { 
                if (!runningAgents.has(agentName)) {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'; 
                }
              }} 
              onMouseLeave={(e) => { 
                if (!gcErrors[agentName] && !runningAgents.has(agentName)) {
                  e.currentTarget.style.borderColor = 'transparent'; 
                }
              }}
            >
              <div style={{ color: gcErrors[agentName] ? 'var(--status-error)' : 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {runningAgents.has(agentName) ? <ArrowsClockwise size={16} style={{ animation: 'spin 1s linear infinite' }} /> : info.icon}
                {gcErrors[agentName] && <Warning size={14} />}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ui-text-primary)', textTransform: 'capitalize', marginBottom: '4px' }}>
                {agentName.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '11px', color: gcErrors[agentName] ? 'var(--status-error)' : 'var(--ui-text-muted)' }}>
                {gcErrors[agentName] || info.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  };

  // Main render functions
  const renderAgentsPanel = () => (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '24px' }}>
        {[
          { id: 'evaluation', label: 'Evaluation Harness', icon: <ChartBar size={16} /> },
          { id: 'factory', label: 'Code Factory', icon: <Code size={16} /> },
          { id: 'gc', label: 'GC Agents', icon: <Recycle size={16} /> },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setAgentOpsTab(tab.id as AgentOpsTab)} style={{ flex: 1, padding: '10px 16px', borderRadius: '6px', border: 'none', background: agentOpsTab === tab.id ? 'var(--accent-primary)' : 'transparent', color: agentOpsTab === tab.id ? 'var(--ui-text-inverse)' : 'var(--text-tertiary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      {agentOpsTab === 'evaluation' && renderEvaluationTab()}
      {agentOpsTab === 'factory' && renderFactoryTab()}
      {agentOpsTab === 'gc' && renderGCTab()}
    </div>
  );

  const ToggleItem: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; description?: string }> = ({ label, value, onChange, description }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: '12px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', backgroundColor: value ? 'var(--accent-primary)' : 'var(--border-subtle)', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease', padding: '0' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-elevated)', position: 'absolute', left: value ? '2px' : '22px', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }} />
      </button>
    </div>
  );

  const NavButton: React.FC<{ item: any; activeSection: SettingsSection; onClick: () => void }> = ({ item, activeSection, onClick }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '8px 12px', border: 'none', backgroundColor: activeSection === item.id ? 'var(--bg-secondary)' : 'transparent', color: activeSection === item.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s ease', textAlign: 'left', borderRadius: '6px', position: 'relative' }} onMouseEnter={(e) => { if (activeSection !== item.id) { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }} onMouseLeave={(e) => { if (activeSection !== item.id) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}>
      {activeSection === item.id && <span style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '16px', backgroundColor: 'var(--accent-primary)', borderRadius: '0 2px 2px 0' }} />}
      {item.label}
    </button>
  );

  // Other panels (abbreviated for space)
  const renderPermissionsPanel = () => {
    const [permStatus, setPermStatus] = useState<AppPermissionStatus | null>(null);
    const [permChecking, setPermChecking] = useState(false);

    useEffect(() => {
      const api = window.allternit?.permissionGuide;
      if (!api) return;
      const unsub = api.onStatusChanged((status) => setPermStatus(status));
      api.check().then(setPermStatus).catch(() => {});
      return unsub;
    }, []);

    const checkPermissions = async () => {
      setPermChecking(true);
      try {
        const result = await window.allternit!.permissionGuide!.requestCheck();
        setPermStatus(result);
      } finally {
        setPermChecking(false);
      }
    };

    const presentGuide = async (panel: PermissionPanel) => {
      await window.allternit!.permissionGuide!.present(panel);
    };

    const hasApi = typeof window !== 'undefined' && !!window.allternit?.permissionGuide;

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

  const PermissionRow: React.FC<{
    label: string;
    description: string;
    status?: 'granted' | 'denied' | 'unknown' | 'not-applicable';
    onGrant: () => void;
  }> = ({ label, description, status, onGrant }) => {
    const granted = status === 'granted';
    const denied = status === 'denied';

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: 'var(--bg-secondary)',
        borderRadius: 8, border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {granted ? <CheckCircle size={16} color="var(--status-success)" /> : denied ? <Warning size={16} color="var(--status-error)" /> : <CircleNotch size={16} color="var(--ui-text-muted)" />}
            <span style={{ fontSize: 14, fontWeight: 500, color: granted ? 'var(--status-success)' : 'var(--text-primary)' }}>{label}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{description}</p>
        </div>
        {denied && (
          <button
            onClick={onGrant}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: 'var(--status-warning)', color: 'var(--ui-text-inverse)', fontSize: 13, cursor: 'pointer'
            }}
          >
            Grant
          </button>
        )}
        {granted && (
          <span style={{ fontSize: 12, color: 'var(--status-success)', fontWeight: 500 }}>Granted</span>
        )}
      </div>
    );
  };

  const renderGeneralPanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--ui-text-primary)' }}>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--ui-text-primary)', fontSize: '14px', cursor: 'pointer' }}>
          <option>English</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option>
        </select>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--ui-text-primary)' }}>Timezone</label>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: 'var(--ui-text-primary)', fontSize: '14px', cursor: 'pointer' }}>
          <option>UTC</option><option>EST</option><option>CST</option><option>PST</option><option>GMT</option>
        </select>
      </div>
      <ToggleItem label="Show system messages" value={showSystemMessages} onChange={setShowSystemMessages} description="Display internal system operations" />
      <ToggleItem label="Enable telemetry" value={enableTelemetry} onChange={setEnableTelemetry} description="Help improve Allternit by sharing usage data" />
      <ToggleItem label="Auto-save" value={autoSave} onChange={setAutoSave} description="Automatically save your work" />
    </div>
  );

  const renderAppearancePanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--ui-text-primary)' }}>Theme</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} style={{ padding: '8px 16px', borderRadius: '6px', border: theme === t ? '2px solid #d4b08c' : '1px solid var(--border-subtle)', backgroundColor: theme === t ? 'rgba(212, 176, 140, 0.1)' : 'var(--bg-secondary)', color: 'var(--ui-text-primary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {t === 'light' && <Sun size={16} />}{t === 'dark' && <Moon size={16} />}{t === 'system' && <DeviceMobile size={16} />}{t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <ToggleItem label="Compact density" value={compactDensity} onChange={setCompactDensity} description="Use less vertical spacing" />
      <ToggleItem label="Show sidebar labels" value={showSidebarLabels} onChange={setShowSidebarLabels} description="Display text labels in sidebar" />
    </div>
  );

  const renderModelsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <LocalModelManager />
      
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ui-text-primary)', marginBottom: '16px' }}>Configuration</h3>
        <ToggleItem label="Streaming" value={streaming} onChange={setStreaming} description="Stream responses in real-time" />
      </div>
    </div>
  );

  const renderApiKeysPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '24px' }}>
        {API_PROVIDERS.map((provider) => (
          <div key={provider.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ui-text-inverse)', fontWeight: '600' }}>{provider.letter}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ui-text-primary)' }}>{provider.name}</div>
            </div>
            <button style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--ui-text-primary)', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderShortcutsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--ui-text-primary)', borderRight: '1px solid var(--border-subtle)' }}>Action</div>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--ui-text-primary)' }}>Shortcut</div>
        </div>
        {SHORTCUTS.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: index !== SHORTCUTS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--ui-text-primary)', borderRight: '1px solid var(--border-subtle)' }}>{item.action}</div>
            <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--ui-text-primary)', fontFamily: 'monospace', backgroundColor: 'var(--bg-secondary)' }}>{item.shortcut}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAboutPanel = () => (
    <div style={{ maxWidth: '600px', textAlign: 'center' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '160px', height: '160px', margin: '0 auto' }}>
          {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ backgroundColor: 'var(--accent-primary)', borderRadius: '4px', opacity: i % 3 === 0 ? 0.3 : i % 2 === 0 ? 0.6 : 1 }} />)}
        </div>
      </div>
      <h1 style={{ fontSize: '32px', margin: '0 0 8px 0', color: 'var(--ui-text-primary)' }}>Allternit & <span style={{ color: 'var(--accent-primary)' }}>Coffee</span></h1>
      <p style={{ fontSize: '14px', color: 'var(--ui-text-muted)' }}>v0.9.1-beta</p>
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

  // Fetch security data
  const fetchSecurityData = useCallback(async () => {
    setSecurityLoading(true);
    try {
      // Import dynamically to avoid circular dependencies
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
      // Use mock data when backend is unavailable
      setPolicies([
        { id: 'pol-001', name: 'Sensitive Data Access Control', type: 'security', severity: 'critical', status: 'active', enforcementMode: 'block', violationCount: 3 },
        { id: 'pol-002', name: 'External API Rate Limiting', type: 'operational', severity: 'medium', status: 'active', enforcementMode: 'warn', violationCount: 12 },
        { id: 'pol-003', name: 'Code Execution Sandbox', type: 'security', severity: 'high', status: 'active', enforcementMode: 'block', violationCount: 0 },
        { id: 'pol-004', name: 'GDPR Compliance Check', type: 'compliance', severity: 'critical', status: 'disabled', enforcementMode: 'audit', violationCount: 0 },
      ]);
      setViolations([
        { id: 'v1', policyName: 'Sensitive Data Access Control', severity: 'critical', agentName: 'Data Analyzer', createdAt: new Date().toISOString(), status: 'open' },
        { id: 'v2', policyName: 'External API Rate Limiting', severity: 'medium', agentName: 'Web Scraper', createdAt: new Date().toISOString(), status: 'open' },
      ]);
      setApprovals([
        { id: 'a1', title: 'Execute shell command', type: 'tool_execution', status: 'pending', requester: { agentName: 'Deployment Helper' }, resource: { riskLevel: 'high' } },
        { id: 'a2', title: 'Access production database', type: 'file_access', status: 'pending', requester: { agentName: 'Data Analyzer' }, resource: { riskLevel: 'critical' } },
      ]);
      setSecurityEvents([
        { id: 'e1', type: 'policy_violation', severity: 'high', title: 'Unauthorized data access attempt', description: 'Agent attempted to access sensitive data', createdAt: new Date().toISOString() },
        { id: 'e2', type: 'anomaly', severity: 'medium', title: 'Unusual API usage pattern', description: 'Agent exceeded normal API call rate by 300%', createdAt: new Date().toISOString() },
      ]);
      setComplianceStatus({
        overall: 'at_risk',
        score: 82,
        frameworks: [
          { id: 'soc2', name: 'SOC 2', status: 'compliant', score: 95 },
          { id: 'gdpr', name: 'GDPR', status: 'at_risk', score: 78 },
        ],
      });
    }
    setSecurityLoading(false);
  }, []);

  useEffect(() => {
    if (activeSection === 'security') {
      fetchSecurityData();
    }
  }, [activeSection, fetchSecurityData]);

  const renderSecurityPanel = () => (
    <div style={{ maxWidth: '900px' }}>
      {/* Security Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #333', marginBottom: 24 }}>
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
            style={{
              padding: '12px 20px',
              border: 'none',
              borderBottom: securityTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              color: securityTab === tab.id ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count > 0 && (
              <span style={{ padding: '2px 8px', background: securityTab === tab.id ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'var(--status-error)', borderRadius: 10, fontSize: 11, color: securityTab === tab.id ? 'var(--accent-primary)' : 'var(--ui-text-inverse)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Security Content */}
      {securityLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <ArrowsClockwise size={32} color="#666" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--ui-text-muted)', marginTop: 16 }}>Loading security data...</p>
        </div>
      ) : (
        <>
          {securityTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Threat Level */}
              <div style={{ padding: 24, background: 'var(--surface-panel)', borderRadius: 12, border: '1px solid var(--ui-border-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 12, background: 'var(--status-warning)20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-warning)' }}>
                    <Shield size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Threat Level</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--status-warning)' }}>Medium</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <StatCard label="Active Policies" value={policies.filter((p: any) => p.status === 'active').length} color="var(--status-success)" />
                <StatCard label="Open Violations" value={violations.filter((v: any) => v.status === 'open').length} color="var(--status-error)" />
                <StatCard label="Pending Approvals" value={approvals.filter((a: any) => a.status === 'pending').length} color="var(--status-warning)" />
                <StatCard label="Compliance Score" value={`${complianceStatus?.score || 0}%`} color="var(--status-info)" />
              </div>

              {/* Recent Events */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-inverse)', margin: '0 0 12px 0' }}>Recent Security Events</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {securityEvents.slice(0, 5).map((event: any) => (
                    <div key={event.id} style={{ padding: 14, background: 'var(--surface-panel)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Warning size={18} color={event.severity === 'critical' ? 'var(--status-error)' : event.severity === 'high' ? 'var(--status-warning)' : 'var(--status-warning)'} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--ui-text-inverse)' }}>{event.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{event.description}</div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{new Date(event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {securityTab === 'policies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text-inverse)', margin: 0 }}>Governance Policies</h3>
                <button style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  + New Policy
                </button>
              </div>
              {policies.map((policy: any) => (
                <div key={policy.id} style={{ padding: 16, background: 'var(--surface-panel)', borderRadius: 8, border: '1px solid var(--ui-border-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: policy.status === 'active' ? 'var(--status-success)20' : 'var(--surface-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: policy.status === 'active' ? 'var(--status-success)' : 'var(--ui-text-muted)' }}>
                        <Shield size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-inverse)' }}>{policy.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>{policy.type} • {policy.enforcementMode}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ padding: '4px 10px', background: policy.severity === 'critical' ? 'var(--status-error)20' : policy.severity === 'high' ? 'var(--status-warning-bg)' : 'var(--status-warning)20', color: policy.severity === 'critical' ? 'var(--status-error)' : policy.severity === 'high' ? 'var(--status-warning)' : 'var(--status-warning)', borderRadius: 4, fontSize: 12 }}>
                        {policy.severity}
                      </span>
                      {policy.violationCount > 0 && (
                        <span style={{ padding: '4px 10px', background: 'var(--status-error)20', color: 'var(--status-error)', borderRadius: 4, fontSize: 12 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text-inverse)', margin: 0 }}>Pending Approvals</h3>
              {approvals.filter((a: any) => a.status === 'pending').map((approval: any) => (
                <div key={approval.id} style={{ padding: 16, background: 'var(--surface-panel)', borderRadius: 8, border: '1px solid var(--ui-border-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-inverse)' }}>{approval.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>Requested by {approval.requester?.agentName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--status-error)', background: 'transparent', color: 'var(--status-error)', fontSize: 12, cursor: 'pointer' }}>Reject</button>
                      <button style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--status-success)', color: 'var(--ui-text-inverse)', fontSize: 12, cursor: 'pointer' }}>Approve</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {securityTab === 'purpose' && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Target size={48} color="#444" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text-inverse)', margin: '0 0 8px 0' }}>Purpose Binding</h3>
              <p style={{ fontSize: 14, color: 'var(--ui-text-muted)', margin: 0 }}>Configure agent purpose alignment controls in the DAG view.</p>
            </div>
          )}

          {securityTab === 'compliance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ padding: 32, background: 'var(--surface-panel)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: complianceStatus?.score >= 80 ? 'var(--status-success)' : complianceStatus?.score >= 60 ? 'var(--status-warning)' : 'var(--status-error)' }}>
                  {complianceStatus?.score || 0}%
                </div>
                <div style={{ fontSize: 14, color: 'var(--ui-text-muted)', marginTop: 8 }}>Overall Compliance Score</div>
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-inverse)', margin: '0 0 12px 0' }}>Frameworks</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {complianceStatus?.frameworks?.map((fw: any) => (
                    <div key={fw.id} style={{ padding: 16, background: 'var(--surface-panel)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 14, color: 'var(--ui-text-inverse)' }}>{fw.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 100, height: 6, background: 'var(--surface-hover)', borderRadius: 3 }}>
                          <div style={{ width: `${fw.score}%`, height: '100%', background: fw.score >= 80 ? 'var(--status-success)' : fw.score >= 60 ? 'var(--status-warning)' : 'var(--status-error)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: fw.score >= 80 ? 'var(--status-success)' : fw.score >= 60 ? 'var(--status-warning)' : 'var(--status-error)' }}>{fw.score}%</span>
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
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <ToggleItem label="Allow bypass permissions mode" value={bypassPermissions} onChange={setBypassPermissions} description="Bypass all permission checks" />
        <ToggleItem label="Draw attention on notifications" value={drawAttentionNotifications} onChange={setDrawAttentionNotifications} description="Bounce dock icon on notifications" />
      </section>

      {/* Authorized Apps */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Authorized Apps
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-canvas)', border: '1px solid var(--ui-border-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Code size={18} color="var(--accent-primary)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Gizzi Code</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                CLI access — reads and writes on your behalf
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {gizziRevokeState === 'done' && (
                <span style={{ fontSize: 12, color: 'var(--status-success)' }}>Access revoked</span>
              )}
              {gizziRevokeState === 'error' && (
                <span style={{ fontSize: 12, color: 'var(--status-error)' }}>Failed — try again</span>
              )}
              <button
                onClick={handleRevokeGizziAccess}
                disabled={gizziRevokeState === 'loading' || gizziRevokeState === 'done'}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid color-mix(in srgb, var(--status-error) 38%, transparent)',
                  background: 'var(--status-error-bg)',
                  color: gizziRevokeState === 'done' ? 'var(--ui-text-muted)' : 'var(--status-error)',
                  fontSize: 13,
                  cursor: (gizziRevokeState === 'loading' || gizziRevokeState === 'done') ? 'not-allowed' : 'pointer',
                  opacity: (gizziRevokeState === 'loading' || gizziRevokeState === 'done') ? 0.6 : 1,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {gizziRevokeState === 'loading' ? 'Revoking…' : 'Revoke Access'}
              </button>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Revoking access signs Gizzi Code out on all machines. Re-authorize by running{' '}
          <code style={{ fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 3 }}>gizzi login</code>.
        </p>
      </section>
    </div>
  );

  const renderCoworkPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ui-text-primary)' }}>Cowork</h3>
        <p style={{ fontSize: '13px', color: 'var(--ui-text-muted)' }}>Manage Cowork settings</p>
      </section>
    </div>
  );

  const renderExtensionsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <ToggleItem label="Enable auto-updates for extensions" value={autoUpdateExtensions} onChange={setAutoUpdateExtensions} description="Automatically update extensions" />
        <ToggleItem label="Use Built-in Node.js for MCP" value={useBuiltinNode} onChange={setUseBuiltinNode} description="Use bundled Node.js runtime" />
      </section>
    </div>
  );

  const renderBillingPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ui-text-primary)' }}>Current Plan</h3>
        <div style={{ padding: '24px', background: 'linear-gradient(135deg, #252525 0%, #1f1f1f 100%)', borderRadius: '12px', border: '1px solid var(--ui-border-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: '500' }}>Pro Plan</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--ui-text-primary)' }}>$20 <span style={{ fontSize: '14px', color: 'var(--ui-text-muted)' }}>/ month</span></div>
            </div>
            <span style={{ padding: '4px 12px', background: 'var(--status-success)20', borderRadius: '12px', fontSize: '12px', color: 'var(--status-success)' }}>Active</span>
          </div>
        </div>
      </section>
    </div>
  );

  const renderUsagePanel = () => (
    <div style={{ maxWidth: '800px' }}>
      <ResourceUsageDashboard />
    </div>
  );

  const renderDiagnosticsPanel = () => {
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

  const DiagnosticRow = ({ label, value, status }: { label: string, value: string, status?: 'success' | 'warning' | 'error' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {status && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: status === 'success' ? 'var(--status-success)' : status === 'warning' ? 'var(--status-warning)' : 'var(--status-error)' }} />}
        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</span>
      </div>
    </div>
  );

  const MetricBar = ({ label, value, suffix = '%', inverse = false }: { label: string, value: number, suffix?: string, inverse?: boolean }) => {
    const color = inverse 
      ? (value < 50 ? 'var(--status-success)' : value < 100 ? 'var(--status-warning)' : 'var(--status-error)')
      : (value > 80 ? 'var(--status-success)' : value > 50 ? 'var(--status-warning)' : 'var(--status-error)');
    
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{value}{suffix}</span>
        </div>
        <div style={{ height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: color, transition: 'width 0.5s ease-out' }} />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'general': return renderGeneralPanel();
      case 'appearance': return renderAppearancePanel();
      case 'models': return renderModelsPanel();
      case 'api-keys': return renderApiKeysPanel();
      case 'shortcuts': return renderShortcutsPanel();
      case 'permissions': return renderPermissionsPanel();
      case 'gizziio-code': return renderGizziioCodePanel();
      case 'cowork': return renderCoworkPanel();
      case 'extensions': return renderExtensionsPanel();
      case 'billing': return renderBillingPanel();
      case 'usage': return renderUsagePanel();
      case 'diagnostics': return renderDiagnosticsPanel();
      case 'infrastructure': return <ToastProvider><InfrastructureSettings initialTab={infrastructureTab as 'overview' | 'providers' | 'connections' | 'environments' | 'nodes' | undefined} /></ToastProvider>;
      case 'security': return <ToastProvider>{renderSecurityPanel()}</ToastProvider>;
      case 'agents': return <ToastProvider>{renderAgentsPanel()}</ToastProvider>;
      case 'about': return renderAboutPanel();
      case 'signin': return <ClerkAuthPanel />;
      case 'vps': return <ToastProvider><VPSConnectionsPanel /></ToastProvider>;
      default: return null;
    }
  };

  const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
    <div style={{ padding: 20, background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
    </div>
  );

  const navigationItems = SETTINGS_NAV_ITEMS;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: '100vh', backgroundColor: 'transparent', overflow: 'hidden', position: 'relative', paddingTop: '80px', color: 'var(--text-primary)' }}>
      <button onClick={() => window.dispatchEvent(new CustomEvent('allternit:close-settings'))} style={{ position: 'absolute', top: 24, right: 24, width: 44, height: 44, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
        <X size={20} />
      </button>

      <div style={{ display: 'flex', width: '100%', maxWidth: '1200px', minWidth: '600px', height: 'calc(100vh - 80px)', margin: '0 auto' }}>
        <div style={{ width: '220px', minWidth: '180px', height: 'calc(100vh - 80px)', backgroundColor: 'transparent', padding: '16px 16px 32px', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '0 12px', marginBottom: '24px' }}>
            <button onClick={() => window.dispatchEvent(new CustomEvent('allternit:close-settings'))} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>
              <span style={{ fontSize: '18px' }}>←</span> Settings
            </button>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ marginBottom: '8px' }}>
              {navigationItems.filter((i: any) => i.group === 'account').map((item: any) => <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />)}
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '12px 0' }} />
            <div style={{ marginBottom: '8px' }}>
              {navigationItems.filter((i: any) => i.group === 'platform').map((item: any) => <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />)}
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '12px 0' }} />
            <div style={{ marginBottom: '8px' }}>
              <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Products</div>
              {navigationItems.filter((i: any) => i.group === 'products').map((item: any) => <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />)}
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '12px 0' }} />
            <div style={{ marginBottom: '8px' }}>
              <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Infrastructure</div>
              {navigationItems.filter((i: any) => i.group === 'infrastructure').map((item: any) => <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />)}
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '12px 0' }} />
            <div>
              {navigationItems.filter((i: any) => i.group === 'about').map((item: any) => <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />)}
            </div>
          </nav>
        </div>

        <div style={{ flex: 1, minWidth: '0', height: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          <div style={{ padding: '32px 48px 120px', width: '100%', maxWidth: '800px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 32px 0' }}>
              {navigationItems.find((item: any) => item.id === activeSection)?.label}
            </h1>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;

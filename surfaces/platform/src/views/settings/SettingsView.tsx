import React, { useState, useEffect, useCallback } from 'react';
import GlassSurface from '@/design/GlassSurface';
import {
  GearSix,
  Palette,
  Cpu,
  Key,
  Keyboard,
  Info,
  Check,
  Trash,
  Plus,
  Sun,
  Moon,
  DeviceMobile,
  User,
  HardDrives,
  Shield,
  Robot,
  Cloud,
  Network,
  Lock,
  Target,
  Recycle,
  FileCode,
  Gauge,
  Code,
  Briefcase,
  PuzzlePiece as Puzzle,
  CreditCard,
  ArrowUpRight,
  Terminal,
  Warning,
  X,
  Play,
  Pause,
  ArrowCounterClockwise,
  ChartBar,
  Clock,
  Lightning,
  CaretRight,
  CaretDown,
  Funnel,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  GitBranch,
  Stack,
  Pulse as Activity,
  FileText as FileCheck,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ClockCounterClockwise,
  Copy,
  ShieldCheck,
  FileText,
} from '@phosphor-icons/react';
import { VPSConnectionsPanel } from './VPSConnectionsPanel';
import { ToastProvider } from '@/components/ui/toast-provider';
import { usePlatformUser, usePlatformSignOut, PlatformSignIn, isPlatformAuthDisabled } from '@/lib/platform-auth-client';
import { useThemeStore, type Theme } from '@/design/ThemeStore';

function ClerkAuthPanel() {
  const { isLoaded, isSignedIn, user } = usePlatformUser();
  const signOut = usePlatformSignOut();

  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };
  const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '20px 24px', marginBottom: 16 };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
  const btnDanger: React.CSSProperties = { ...btn, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171' };

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
        <div style={{ ...label, marginBottom: 16 }}>Sign in to your A2R account</div>
        <PlatformSignIn />
      </div>
    );
  }

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'A2R User';
  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ padding: 24 }}>
      <div style={label}>Account</div>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{name}</div>
          {email && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button style={btnDanger} onClick={() => signOut({ redirectUrl: '/sign-in' })}>
          <User size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
import { InfrastructureSettings } from './InfrastructureSettings';

type SettingsSection = 'general' | 'appearance' | 'models' | 'api-keys' | 'shortcuts' | 'about' | 'signin' | 'vps' | 'infrastructure' | 'security' | 'agents' | 'gizziio-code' | 'cowork' | 'extensions' | 'billing';
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

const ACCENT_COLORS = [
  { name: 'Sand', value: '#d4b08c' },
  { name: 'Blue', value: '#007aff' },
  { name: 'Purple', value: '#af52de' },
  { name: 'Green', value: '#34c759' },
  { name: 'Red', value: '#ef4444' },
];

const MODEL_OPTIONS = ['GPT-4o', 'Claude 3.5', 'Mistral 7B', 'Gemini Flash'];

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
const API_BASE = '/api/v1';

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
      const sectionMap: Record<string, SettingsSection> = {
        signin: 'signin', vps: 'vps', general: 'general', infrastructure: 'infrastructure',
        appearance: 'appearance', models: 'models', 'api-keys': 'api-keys', shortcuts: 'shortcuts',
        about: 'about', security: 'security', agents: 'agents', 'gizziio-code': 'gizziio-code',
        cowork: 'cowork', extensions: 'extensions', billing: 'billing'
      };
      if (event.detail?.section && sectionMap[event.detail.section]) {
        setActiveSection(sectionMap[event.detail.section]);
        if (event.detail?.tab && sectionMap[event.detail.section] === 'infrastructure') {
          setInfrastructureTab(event.detail.tab);
        }
      }
    };
    window.addEventListener('a2r:navigate-settings' as any, handleNavigateSettings as any);
    window.addEventListener('a2r:open-settings' as any, handleNavigateSettings as any);
    return () => {
      window.removeEventListener('a2r:navigate-settings' as any, handleNavigateSettings as any);
      window.removeEventListener('a2r:open-settings' as any, handleNavigateSettings as any);
    };
  }, []);

  // State
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('UTC');
  const [showSystemMessages, setShowSystemMessages] = useState(true);
  const [enableTelemetry, setEnableTelemetry] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [defaultMode, setDefaultMode] = useState<DefaultMode>('chat');
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [compactDensity, setCompactDensity] = useState(false);
  const [showSidebarLabels, setShowSidebarLabels] = useState(true);
  const [animateTransitions, setAnimateTransitions] = useState(true);
  const [accentColor, setAccentColor] = useState('#d4b08c');
  const [chatModel, setChatModel] = useState('GPT-4o');
  const [codeModel, setCodeModel] = useState('Claude 3.5');
  const [analysisModel, setAnalysisModel] = useState('Mistral 7B');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState('2000');
  const [streaming, setStreaming] = useState(true);
  const [apiKeys, setApiKeys] = useState<Record<string, { masked: string; isSet: boolean }>>({
    OpenAI: { masked: 'sk-••••••••••••••••', isSet: true },
    Anthropic: { masked: '', isSet: false },
    Mistral: { masked: '', isSet: false },
    Google: { masked: '', isSet: false },
  });
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [drawAttentionNotifications, setDrawAttentionNotifications] = useState(true);
  const [worktreeLocation, setWorktreeLocation] = useState('Inside project (.claude/)');
  const [branchPrefix, setBranchPrefix] = useState('gizziio');
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [persistPreviewSessions, setPersistPreviewSessions] = useState(false);
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
    if (score <= 10) return '#22c55e'; // green
    if (score <= 50) return '#f59e0b'; // yellow
    if (score <= 100) return '#ef4444'; // red
    return '#dc2626'; // critical red
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
      zIndex: 9999, 
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
            backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#22c55e' : '#3b82f6',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
              color: '#ffffff', 
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
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: 0 }}>Evaluation Tests</h3>
          <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>{evaluations.length} tests configured</p>
        </div>
        <button onClick={() => setShowCreateEval(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d4b08c', color: '#1a1a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Evaluation
        </button>
      </div>

      {showCreateEval && (
        <div style={{ padding: '20px', background: '#252525', borderRadius: '8px', border: '1px solid #333' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 16px 0' }}>Create New Evaluation</h4>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>Name</label>
            <input type="text" value={newEvalName} onChange={(e) => setNewEvalName(e.target.value)} placeholder="e.g., Agent Response Quality" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #444', background: '#1f1f1f', color: '#ffffff', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>Type</label>
            <select value={newEvalType} onChange={(e) => setNewEvalType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #444', background: '#1f1f1f', color: '#ffffff', fontSize: '14px' }}>
              <option value="unit">Unit Test</option>
              <option value="integration">Integration Test</option>
              <option value="benchmark">Benchmark</option>
              <option value="conformance">Conformance</option>
              <option value="ontology">Ontology</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreateEval(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #444', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreateEvaluation} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d4b08c', color: '#1a1a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Create</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {evaluations.map((evalItem) => (
          <div key={evalItem.id} style={{ padding: '16px', background: '#252525', borderRadius: '8px', border: selectedEval === evalItem.id ? '1px solid #d4b08c' : '1px solid transparent', cursor: 'pointer' }} onClick={() => setSelectedEval(selectedEval === evalItem.id ? null : evalItem.id)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {evalItem.status === 'passed' && <CheckCircle size={20} color="#22c55e" />}
                {evalItem.status === 'failed' && <XCircle size={20} color="#ef4444" />}
                {evalItem.status === 'pending' && <Clock size={20} color="#888" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff' }}>{evalItem.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{evalItem.type} • Last run: {evalItem.lastRun ? new Date(evalItem.lastRun).toLocaleDateString() : 'Never'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: evalItem.score >= 80 ? '#22c55e' : evalItem.score >= 60 ? '#f59e0b' : '#ef4444' }}>{evalItem.score}%</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Score</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleRunEvaluation(evalItem.id); }} disabled={isRunningEval} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: isRunningEval ? '#333' : '#d4b08c', color: '#1a1a1a', fontSize: '12px', fontWeight: '500', cursor: isRunningEval ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isRunningEval ? <ArrowsClockwise size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />} Run
                </button>
              </div>
            </div>

            {selectedEval === evalItem.id && evalResults && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #333' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#22c55e' }}>{evalResults.summary.passed}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Passed</div>
                  </div>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#ef4444' }}>{evalResults.summary.failed}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Failed</div>
                  </div>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#f59e0b' }}>{evalResults.summary.skipped}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Skipped</div>
                  </div>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#d4b08c' }}>{(evalResults.duration / 1000).toFixed(1)}s</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Duration</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {evalResults.details?.map((detail: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#1f1f1f', borderRadius: '6px' }}>
                      {detail.status === 'passed' ? <CheckCircle size={16} color="#22c55e" /> : <XCircle size={16} color="#ef4444" />}
                      <span style={{ flex: 1, fontSize: '13px', color: '#ffffff' }}>{detail.test}</span>
                      <span style={{ fontSize: '12px', color: '#888' }}>{detail.duration}ms</span>
                      {detail.error && <span style={{ fontSize: '11px', color: '#ef4444' }}>{detail.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '20px', background: '#252525', borderRadius: '8px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 16px 0' }}>Benchmark History</h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
          {benchmarkHistory.map((item, idx) => (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100%', height: `${item.score}%`, background: item.score >= 80 ? '#22c55e' : item.score >= 60 ? '#f59e0b' : '#ef4444', borderRadius: '4px 4px 0 0', minHeight: '20px' }} />
              <span style={{ fontSize: '10px', color: '#666' }}>{item.date.slice(5)}</span>
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
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: 0 }}>Autonomous Tasks</h3>
          <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>{factoryTasks.length} tasks in queue</p>
        </div>
        <button onClick={() => setShowCreateTask(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d4b08c', color: '#1a1a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {showCreateTask && (
        <div style={{ padding: '20px', background: '#252525', borderRadius: '8px', border: '1px solid #333' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 16px 0' }}>Create Autonomous Task</h4>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>Spec Reference</label>
            <input type="text" value={newTaskSpec} onChange={(e) => setNewTaskSpec(e.target.value)} placeholder="e.g., spec/auth-refactor" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #444', background: '#1f1f1f', color: '#ffffff', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>Requirements (one per line)</label>
            <textarea value={newTaskRequirements} onChange={(e) => setNewTaskRequirements(e.target.value)} placeholder="e.g., Refactor auth middleware..." rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #444', background: '#1f1f1f', color: '#ffffff', fontSize: '14px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreateTask(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #444', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreateTask} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d4b08c', color: '#1a1a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Create Task</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {factoryTasks.map((task) => (
          <div key={task.id} style={{ padding: '16px', background: '#252525', borderRadius: '8px', border: selectedTask === task.id ? '1px solid #d4b08c' : '1px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {task.status === 'completed' && <CheckCircle size={20} color="#22c55e" />}
                {task.status === 'generating' && <ArrowsClockwise size={20} color="#d4b08c" style={{ animation: 'spin 2s linear infinite' }} />}
                {task.status === 'validating' && <FileCheck size={20} color="#3b82f6" />}
                {task.status === 'pending_approval' && <Clock size={20} color="#f59e0b" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff' }}>{task.specRef}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{task.status} • Created {new Date(task.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '100px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}><span>Progress</span><span>{task.progress}%</span></div>
                  <div style={{ width: '100%', height: '6px', background: '#1f1f1f', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${task.progress}%`, height: '100%', background: task.status === 'completed' ? '#22c55e' : '#d4b08c', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                </div>
                {selectedTask === task.id ? <CaretDown size={16} color="#888" /> : <CaretRight size={16} color="#888" />}
              </div>
            </div>

            {selectedTask === task.id && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #333' }}>
                {task.status === 'pending_approval' && (
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', margin: '0 0 12px 0' }}>Generated Changes Pending Approval</h5>
                    <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', marginBottom: '12px' }}>
                      <code style={{ fontSize: '12px', color: '#d4b08c', fontFamily: 'monospace' }}>
                        // Generated code example<br/>fn optimized_auth() {'{'}<br/>&nbsp;&nbsp;validate_jwt_token()?;<br/>{'}'}
                      </code>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => handleApproveChange(task.id, 'change-1')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#ffffff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ThumbsUp size={14} /> Approve & Merge
                      </button>
                      <button onClick={() => handleRejectChange(task.id, 'change-1')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ThumbsDown size={14} /> Reject
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <GitBranch size={16} color="#d4b08c" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: '#888' }}>Branch</div>
                    <div style={{ fontSize: '13px', color: '#ffffff' }}>auto/{task.specRef.split('/')[1]}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <FileCode size={16} color="#d4b08c" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: '#888' }}>Files Changed</div>
                    <div style={{ fontSize: '13px', color: '#ffffff' }}>12 files</div>
                  </div>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <Stack size={16} color="#d4b08c" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: '#888' }}>Risk Tier</div>
                    <div style={{ fontSize: '13px', color: '#ffffff' }}>Medium</div>
                  </div>
                  <div style={{ padding: '12px', background: '#1f1f1f', borderRadius: '6px', textAlign: 'center' }}>
                    <Shield size={16} color="#d4b08c" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: '#888' }}>Compliance</div>
                    <div style={{ fontSize: '13px', color: '#22c55e' }}>Passing</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ padding: '20px', background: '#252525', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: '#d4b08c' }}>127</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Tasks Completed</div>
        </div>
        <div style={{ padding: '20px', background: '#252525', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: '#22c55e' }}>94%</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Approval Rate</div>
        </div>
        <div style={{ padding: '20px', background: '#252525', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: '#3b82f6' }}>3.2k</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Lines Generated</div>
        </div>
        <div style={{ padding: '20px', background: '#252525', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', color: '#a855f7' }}>12</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Active Tasks</div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#252525', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `8px solid ${entropyColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span style={{ fontSize: '24px', fontWeight: '600', color: '#ffffff' }}>{entropyScore}</span>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: 0 }}>Entropy Score</h3>
            <p style={{ fontSize: '13px', color: entropyColor, margin: '4px 0 0 0' }}>{entropyStatus}</p>
            {gcErrors.cleanup && (
              <p style={{ fontSize: '12px', color: '#ef4444', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Warning size={12} /> {gcErrors.cleanup}
              </p>
            )}
          </div>
        </div>
        <button 
          onClick={handleTriggerCleanup} 
          disabled={isRunningGC} 
          style={{ padding: '12px 24px', borderRadius: '6px', border: 'none', background: isRunningGC ? '#333' : '#d4b08c', color: '#1a1a1a', fontSize: '14px', fontWeight: '500', cursor: isRunningGC ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {isRunningGC ? <ArrowsClockwise size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Lightning size={18} />}
          {isRunningGC ? 'Running Cleanup...' : 'Run Full Cleanup'}
        </button>
      </div>

      {/* Cleanup Queue */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 12px 0' }}>Cleanup Queue</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gcQueue.map((item) => (
            <div key={item.id} style={{ padding: '14px 16px', background: '#252525', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Recycle size={18} color="#d4b08c" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', textTransform: 'capitalize' }}>{item.agent.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{item.items} items queued</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', background: item.priority === 'high' ? 'rgba(239, 68, 68, 0.2)' : item.priority === 'medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#22c55e', textTransform: 'uppercase' }}>{item.priority}</span>
                <button 
                  onClick={() => handleRunGCAgent(item.agent)} 
                  disabled={runningAgents.has(item.agent)}
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    border: runningAgents.has(item.agent) ? '1px solid #333' : '1px solid #444', 
                    background: 'transparent', 
                    color: runningAgents.has(item.agent) ? '#666' : '#d4b08c', 
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
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              No items in cleanup queue
            </div>
          )}
        </div>
      </div>

      {/* Cleanup Policies */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 12px 0' }}>Cleanup Policies</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gcPolicies.map((policy) => (
            <div key={policy.id} style={{ padding: '14px 16px', background: '#252525', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <GearSix size={18} color="#888" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff' }}>{policy.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Threshold: {(policy.threshold * 100).toFixed(0)}%</div>
                </div>
              </div>
              <button onClick={() => handleUpdateGCPolicy(policy.id, { enabled: !policy.enabled })} style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', backgroundColor: policy.enabled ? '#d4b08c' : 'var(--border-subtle)', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease', padding: '0' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#ffffff', position: 'absolute', left: policy.enabled ? '2px' : '22px', top: '2px', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }} />
              </button>
            </div>
          ))}
          {gcPolicies.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              No policies configured
            </div>
          )}
        </div>
      </div>

      {/* Cleanup History */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 12px 0' }}>Cleanup History</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {gcHistory.map((record, idx) => (
            <div key={idx} style={{ padding: '14px 16px', background: '#252525', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ClockCounterClockwise size={18} color="#888" />
                <span style={{ fontSize: '14px', color: '#ffffff' }}>{record.date}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: '#d4b08c' }}>{record.agentsRun}</div><div style={{ fontSize: '11px', color: '#666' }}>Agents</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: '#ef4444' }}>{record.issuesFound}</div><div style={{ fontSize: '11px', color: '#666' }}>Issues</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: '#22c55e' }}>{record.issuesFixed}</div><div style={{ fontSize: '11px', color: '#666' }}>Fixed</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '14px', fontWeight: '500', color: '#3b82f6' }}>-{record.entropyReduction.toFixed(1)}%</div><div style={{ fontSize: '11px', color: '#666' }}>Entropy</div></div>
              </div>
            </div>
          ))}
          {gcHistory.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              No cleanup history available
            </div>
          )}
        </div>
      </div>

      {/* Available GC Agents */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: '0 0 12px 0' }}>Available GC Agents</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {Object.entries(GC_AGENT_INFO).map(([agentName, info]) => (
            <button 
              key={agentName} 
              onClick={() => handleRunGCAgent(agentName)} 
              disabled={runningAgents.has(agentName)}
              style={{ 
                padding: '16px', 
                background: runningAgents.has(agentName) ? '#1f1f1f' : '#252525', 
                borderRadius: '8px', 
                border: gcErrors[agentName] ? '1px solid #ef4444' : runningAgents.has(agentName) ? '1px solid #d4b08c' : '1px solid transparent', 
                cursor: runningAgents.has(agentName) ? 'not-allowed' : 'pointer', 
                textAlign: 'left', 
                transition: 'all 0.2s',
                opacity: runningAgents.has(agentName) ? 0.7 : 1
              }} 
              onMouseEnter={(e) => { 
                if (!runningAgents.has(agentName)) {
                  e.currentTarget.style.borderColor = '#d4b08c'; 
                }
              }} 
              onMouseLeave={(e) => { 
                if (!gcErrors[agentName] && !runningAgents.has(agentName)) {
                  e.currentTarget.style.borderColor = 'transparent'; 
                }
              }}
            >
              <div style={{ color: gcErrors[agentName] ? '#ef4444' : '#d4b08c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {runningAgents.has(agentName) ? <ArrowsClockwise size={16} style={{ animation: 'spin 1s linear infinite' }} /> : info.icon}
                {gcErrors[agentName] && <Warning size={14} />}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff', textTransform: 'capitalize', marginBottom: '4px' }}>
                {agentName.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '11px', color: gcErrors[agentName] ? '#ef4444' : '#888' }}>
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
          <button key={tab.id} onClick={() => setAgentOpsTab(tab.id as AgentOpsTab)} style={{ flex: 1, padding: '10px 16px', borderRadius: '6px', border: 'none', background: agentOpsTab === tab.id ? '#d4b08c' : 'transparent', color: agentOpsTab === tab.id ? '#1a1a1a' : 'var(--text-tertiary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
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
      <button onClick={() => onChange(!value)} style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', backgroundColor: value ? '#d4b08c' : 'var(--border-subtle)', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease', padding: '0' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-elevated)', position: 'absolute', left: value ? '2px' : '22px', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }} />
      </button>
    </div>
  );

  const NavButton: React.FC<{ item: any; activeSection: SettingsSection; onClick: () => void }> = ({ item, activeSection, onClick }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '8px 12px', border: 'none', backgroundColor: activeSection === item.id ? 'var(--bg-secondary)' : 'transparent', color: activeSection === item.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s ease', textAlign: 'left', borderRadius: '6px', position: 'relative' }} onMouseEnter={(e) => { if (activeSection !== item.id) { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }} onMouseLeave={(e) => { if (activeSection !== item.id) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}>
      {activeSection === item.id && <span style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '16px', backgroundColor: '#d4b08c', borderRadius: '0 2px 2px 0' }} />}
      {item.label}
    </button>
  );

  // Other panels (abbreviated for space)
  const renderGeneralPanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: '#ffffff', fontSize: '14px', cursor: 'pointer' }}>
          <option>English</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option>
        </select>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>Timezone</label>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: '#ffffff', fontSize: '14px', cursor: 'pointer' }}>
          <option>UTC</option><option>EST</option><option>CST</option><option>PST</option><option>GMT</option>
        </select>
      </div>
      <ToggleItem label="Show system messages" value={showSystemMessages} onChange={setShowSystemMessages} description="Display internal system operations" />
      <ToggleItem label="Enable telemetry" value={enableTelemetry} onChange={setEnableTelemetry} description="Help improve A2R by sharing usage data" />
      <ToggleItem label="Auto-save" value={autoSave} onChange={setAutoSave} description="Automatically save your work" />
    </div>
  );

  const renderAppearancePanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#ffffff' }}>Theme</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} style={{ padding: '8px 16px', borderRadius: '6px', border: theme === t ? '2px solid #d4b08c' : '1px solid var(--border-subtle)', backgroundColor: theme === t ? 'rgba(212, 176, 140, 0.1)' : 'var(--bg-secondary)', color: '#ffffff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>Default Models</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#d0d0d0', marginBottom: '6px' }}>Chat</label>
            <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', color: '#ffffff', fontSize: '13px' }}>
              {MODEL_OPTIONS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>
      <ToggleItem label="Streaming" value={streaming} onChange={setStreaming} description="Stream responses in real-time" />
    </div>
  );

  const renderApiKeysPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '24px' }}>
        {API_PROVIDERS.map((provider) => (
          <div key={provider.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#d4b08c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1612', fontWeight: '600' }}>{provider.letter}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>{provider.name}</div>
            </div>
            <button style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: '#d0d0d0', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderShortcutsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#ffffff', borderRight: '1px solid var(--border-subtle)' }}>Action</div>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#ffffff' }}>Shortcut</div>
        </div>
        {SHORTCUTS.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: index !== SHORTCUTS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ padding: '12px 16px', fontSize: '13px', color: '#ffffff', borderRight: '1px solid var(--border-subtle)' }}>{item.action}</div>
            <div style={{ padding: '12px 16px', fontSize: '12px', color: '#d0d0d0', fontFamily: 'monospace', backgroundColor: 'var(--bg-secondary)' }}>{item.shortcut}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAboutPanel = () => (
    <div style={{ maxWidth: '600px', textAlign: 'center' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '160px', height: '160px', margin: '0 auto' }}>
          {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ backgroundColor: '#d4b08c', borderRadius: '4px', opacity: i % 3 === 0 ? 0.3 : i % 2 === 0 ? 0.6 : 1 }} />)}
        </div>
      </div>
      <h1 style={{ fontSize: '32px', margin: '0 0 8px 0', color: '#ffffff' }}>A2R & <span style={{ color: '#d4b08c' }}>Coffee</span></h1>
      <p style={{ fontSize: '14px', color: '#888' }}>v0.9.1-beta</p>
    </div>
  );

  const renderInfrastructurePanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>Cloud Deployment</h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cloud size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Cloud Deploy</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Manage cloud deployments</div>
            </div>
          </div>
        </div>
      </section>
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
      const { listPolicies, listViolations, listApprovals, listSecurityEvents, getComplianceStatus, getSecurityOverview } = await import('@/lib/governance/policy.service');
      
      const [policiesRes, violationsRes, approvalsRes, eventsRes, complianceRes, overviewRes] = await Promise.all([
        listPolicies(),
        listViolations({ status: 'open' }),
        listApprovals({ status: 'pending' }),
        listSecurityEvents({ pageSize: 20 }),
        getComplianceStatus(),
        getSecurityOverview(),
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
              borderBottom: securityTab === tab.id ? '2px solid #d4b08c' : '2px solid transparent',
              background: 'transparent',
              color: securityTab === tab.id ? '#d4b08c' : '#888',
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
              <span style={{ padding: '2px 8px', background: securityTab === tab.id ? '#d4b08c20' : '#ef4444', borderRadius: 10, fontSize: 11, color: securityTab === tab.id ? '#d4b08c' : '#fff' }}>
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
          <p style={{ color: '#666', marginTop: 16 }}>Loading security data...</p>
        </div>
      ) : (
        <>
          {securityTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Threat Level */}
              <div style={{ padding: 24, background: '#252525', borderRadius: 12, border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                    <Shield size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Threat Level</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>Medium</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <StatCard label="Active Policies" value={policies.filter((p: any) => p.status === 'active').length} color="#22c55e" />
                <StatCard label="Open Violations" value={violations.filter((v: any) => v.status === 'open').length} color="#ef4444" />
                <StatCard label="Pending Approvals" value={approvals.filter((a: any) => a.status === 'pending').length} color="#f59e0b" />
                <StatCard label="Compliance Score" value={`${complianceStatus?.score || 0}%`} color="#3b82f6" />
              </div>

              {/* Recent Events */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>Recent Security Events</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {securityEvents.slice(0, 5).map((event: any) => (
                    <div key={event.id} style={{ padding: 14, background: '#252525', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Warning size={18} color={event.severity === 'critical' ? '#ef4444' : event.severity === 'high' ? '#f97316' : '#f59e0b'} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: '#fff' }}>{event.title}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{event.description}</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#666' }}>{new Date(event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {securityTab === 'policies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>Governance Policies</h3>
                <button style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#d4b08c', color: '#1a1a1a', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  + New Policy
                </button>
              </div>
              {policies.map((policy: any) => (
                <div key={policy.id} style={{ padding: 16, background: '#252525', borderRadius: 8, border: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: policy.status === 'active' ? '#22c55e20' : '#66666620', display: 'flex', alignItems: 'center', justifyContent: 'center', color: policy.status === 'active' ? '#22c55e' : '#888' }}>
                        <Shield size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{policy.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{policy.type} • {policy.enforcementMode}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ padding: '4px 10px', background: policy.severity === 'critical' ? '#ef444420' : policy.severity === 'high' ? '#f9731620' : '#f59e0b20', color: policy.severity === 'critical' ? '#ef4444' : policy.severity === 'high' ? '#f97316' : '#f59e0b', borderRadius: 4, fontSize: 12 }}>
                        {policy.severity}
                      </span>
                      {policy.violationCount > 0 && (
                        <span style={{ padding: '4px 10px', background: '#ef444420', color: '#ef4444', borderRadius: 4, fontSize: 12 }}>
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
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>Pending Approvals</h3>
              {approvals.filter((a: any) => a.status === 'pending').map((approval: any) => (
                <div key={approval.id} style={{ padding: 16, background: '#252525', borderRadius: 8, border: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{approval.title}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>Requested by {approval.requester?.agentName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>Reject</button>
                      <button style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Approve</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {securityTab === 'purpose' && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Target size={48} color="#444" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 8px 0' }}>Purpose Binding</h3>
              <p style={{ fontSize: 14, color: '#666', margin: 0 }}>Configure agent purpose alignment controls in the DAG view.</p>
            </div>
          )}

          {securityTab === 'compliance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ padding: 32, background: '#252525', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: complianceStatus?.score >= 80 ? '#22c55e' : complianceStatus?.score >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {complianceStatus?.score || 0}%
                </div>
                <div style={{ fontSize: 14, color: '#888', marginTop: 8 }}>Overall Compliance Score</div>
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>Frameworks</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {complianceStatus?.frameworks?.map((fw: any) => (
                    <div key={fw.id} style={{ padding: 16, background: '#252525', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 14, color: '#fff' }}>{fw.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 100, height: 6, background: '#333', borderRadius: 3 }}>
                          <div style={{ width: `${fw.score}%`, height: '100%', background: fw.score >= 80 ? '#22c55e' : fw.score >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: fw.score >= 80 ? '#22c55e' : fw.score >= 60 ? '#f59e0b' : '#ef4444' }}>{fw.score}%</span>
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

  const renderGizziioCodePanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <ToggleItem label="Allow bypass permissions mode" value={bypassPermissions} onChange={setBypassPermissions} description="Bypass all permission checks" />
        <ToggleItem label="Draw attention on notifications" value={drawAttentionNotifications} onChange={setDrawAttentionNotifications} description="Bounce dock icon on notifications" />
      </section>
    </div>
  );

  const renderCoworkPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff' }}>Cowork</h3>
        <p style={{ fontSize: '13px', color: '#888' }}>Manage Cowork settings</p>
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
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff' }}>Current Plan</h3>
        <div style={{ padding: '24px', background: 'linear-gradient(135deg, #252525 0%, #1f1f1f 100%)', borderRadius: '12px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#d4b08c', fontWeight: '500' }}>Pro Plan</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff' }}>$20 <span style={{ fontSize: '14px', color: '#888' }}>/ month</span></div>
            </div>
            <span style={{ padding: '4px 12px', background: '#22c55e20', borderRadius: '12px', fontSize: '12px', color: '#22c55e' }}>Active</span>
          </div>
        </div>
      </section>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general': return renderGeneralPanel();
      case 'appearance': return renderAppearancePanel();
      case 'models': return renderModelsPanel();
      case 'api-keys': return renderApiKeysPanel();
      case 'shortcuts': return renderShortcutsPanel();
      case 'gizziio-code': return renderGizziioCodePanel();
      case 'cowork': return renderCoworkPanel();
      case 'extensions': return renderExtensionsPanel();
      case 'billing': return renderBillingPanel();
      case 'infrastructure': return <ToastProvider><InfrastructureSettings /></ToastProvider>;
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

  const navigationItems = [
    { id: 'signin', label: 'Sign In', icon: <User size={18} />, group: 'account' },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} />, group: 'account' },
    { id: 'general', label: 'General', icon: <GearSix size={18} />, group: 'platform' },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, group: 'platform' },
    { id: 'models', label: 'Models', icon: <Cpu size={18} />, group: 'platform' },
    { id: 'api-keys', label: 'API Keys', icon: <Key size={18} />, group: 'platform' },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={18} />, group: 'platform' },
    { id: 'gizziio-code', label: 'Gizziio Code', icon: <Code size={18} />, group: 'products' },
    { id: 'cowork', label: 'Cowork', icon: <Briefcase size={18} />, group: 'products' },
    { id: 'extensions', label: 'Extensions', icon: <Puzzle size={18} />, group: 'products' },
    { id: 'infrastructure', label: 'Infrastructure', icon: <Cloud size={18} />, group: 'infrastructure' },
    { id: 'vps', label: 'VPS Connections', icon: <HardDrives size={18} />, group: 'infrastructure' },
    { id: 'security', label: 'Security', icon: <Shield size={18} />, group: 'infrastructure' },
    { id: 'agents', label: 'Agents', icon: <Robot size={18} />, group: 'infrastructure' },
    { id: 'about', label: 'About', icon: <Info size={18} />, group: 'about' },
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: '100vh', backgroundColor: 'transparent', overflow: 'hidden', position: 'relative', paddingTop: '80px', color: 'var(--text-primary)' }}>
      <button onClick={() => window.dispatchEvent(new CustomEvent('a2r:close-settings'))} style={{ position: 'absolute', top: 24, right: 24, width: 44, height: 44, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
        <X size={20} />
      </button>

      <div style={{ display: 'flex', width: '100%', maxWidth: '1200px', minWidth: '600px', height: 'calc(100vh - 80px)', margin: '0 auto' }}>
        <div style={{ width: '220px', minWidth: '180px', height: 'calc(100vh - 80px)', backgroundColor: 'transparent', padding: '16px 16px 32px', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '0 12px', marginBottom: '24px' }}>
            <button onClick={() => window.dispatchEvent(new CustomEvent('a2r:close-settings'))} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>
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

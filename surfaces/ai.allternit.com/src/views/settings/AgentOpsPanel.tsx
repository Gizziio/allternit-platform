// @ts-nocheck
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  ArrowsClockwise,
  Play,
  CaretDown,
  CaretRight,
  GitBranch,
  FileCode,
  Stack,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Warning,
  Lightning,
  Recycle,
  GearSix,
  ClockCounterClockwise,
  Copy,
  ShieldCheck,
  Eye,
  FileText,
  FileText as FileCheck,
  Info,
  X,
  ChartBar,
  Code,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/logger';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { PanelHeader } from '@/components/settings/PanelHeader';
import { Toggle } from '@/components/settings/Toggle';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from '@/components/settings/buttonStyles';

const logger = createModuleLogger('AgentOpsPanel');

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentOpsTab = 'evaluation' | 'factory' | 'gc';

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

// ─── Sub-components ───────────────────────────────────────────────────────────

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
          <button type="button"
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

// ─── Panel ────────────────────────────────────────────────────────────────────

export function AgentOpsPanel() {
  const [agentOpsTab, setAgentOpsTab] = useState<AgentOpsTab>('evaluation');

  // Evaluation state
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEval, setSelectedEval] = useState<string | null>(null);
  const [evalResults, setEvalResults] = useState<any>(null);
  const [benchmarkHistory, setBenchmarkHistory] = useState<any[]>([]);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [showCreateEval, setShowCreateEval] = useState(false);
  const [newEvalName, setNewEvalName] = useState('');
  const [newEvalType, setNewEvalType] = useState('unit');

  // Factory state
  const [factoryTasks, setFactoryTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskSpec, setNewTaskSpec] = useState('');
  const [newTaskRequirements, setNewTaskRequirements] = useState('');

  // GC state
  const [gcQueue, setGcQueue] = useState<GcQueueItem[]>([]);
  const [gcPolicies, setGcPolicies] = useState<GcPolicy[]>([]);
  const [gcHistory, setGcHistory] = useState<GcHistoryEntry[]>([]);
  const [isRunningGC, setIsRunningGC] = useState(false);
  const [entropyScore, setEntropyScore] = useState(85);
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
    } catch {
      setEvaluations([]);
    }
  }, []);

  const fetchBenchmarkHistory = useCallback(async () => {
    try {
      const data = await api.getBenchmarkHistory();
      setBenchmarkHistory(data.history || []);
    } catch (e) {
      logger.error({ err: e }, 'Failed to fetch benchmark history');
      setBenchmarkHistory([]);
    }
  }, []);

  const fetchFactoryTasks = useCallback(async () => {
    try {
      const data = await api.getFactoryTasks();
      setFactoryTasks(data.tasks || []);
    } catch (err) {
      logger.error({ err }, 'Failed to fetch factory tasks');
      setFactoryTasks([]);
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
    } catch (err) {
      logger.error({ err }, 'Failed to fetch GC data');
    }
  }, []);

  useEffect(() => {
    if (agentOpsTab === 'evaluation') { fetchEvaluations(); fetchBenchmarkHistory(); }
    else if (agentOpsTab === 'factory') fetchFactoryTasks();
    else if (agentOpsTab === 'gc') fetchGCData();
  }, [agentOpsTab, fetchEvaluations, fetchBenchmarkHistory, fetchFactoryTasks, fetchGCData]);

  // Handlers
  const handleRunEvaluation = async (evalId: string) => {
    setIsRunningEval(true);
    try {
      await api.runEvaluation(evalId);
      const results = await api.getEvaluationResults(evalId);
      setEvalResults(results);
      fetchEvaluations();
    } catch {
      setEvalResults(null);
    }
    setIsRunningEval(false);
  };

  const handleCreateEvaluation = async () => {
    if (!newEvalName.trim()) return;
    try {
      await api.createEvaluation({ name: newEvalName, type: newEvalType, config: {} });
      setShowCreateEval(false); setNewEvalName(''); fetchEvaluations();
    } catch {
      setShowCreateEval(false); setNewEvalName('');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskSpec.trim()) return;
    try {
      await api.createFactoryTask({ specRef: newTaskSpec, requirements: newTaskRequirements.split('\n').filter(r => r.trim()) });
      setShowCreateTask(false); setNewTaskSpec(''); setNewTaskRequirements(''); fetchFactoryTasks();
    } catch {
      setShowCreateTask(false); setNewTaskSpec(''); setNewTaskRequirements('');
    }
  };

  const handleApproveChange = async (taskId: string, changeId: string) => {
    try { await api.approveFactoryChange(taskId, changeId); fetchFactoryTasks(); }
    catch { fetchFactoryTasks(); }
  };

  const handleRejectChange = async (taskId: string, changeId: string) => {
    try { await api.rejectFactoryChange(taskId, changeId); fetchFactoryTasks(); }
    catch { fetchFactoryTasks(); }
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

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderEvaluationTab = () => (
    <div className="flex flex-col gap-6">
      <PanelHeader title="Evaluation tests">
        <span className="text-[13px] text-[var(--text-secondary)] mr-1">{evaluations.length} configured</span>
        <button type="button" onClick={() => setShowCreateEval(true)} className={QUIET_BUTTON_CLASS}>
          <Plus size={14} /> New evaluation
        </button>
      </PanelHeader>

      {showCreateEval && (
        <div className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-default)]">
          <h4 className="text-[14px] font-bold text-[var(--ui-text-primary)] m-0 mb-4">Create New Evaluation</h4>
          <div className="mb-4">
            <div className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Name</div>
            <input aria-label="Input" type="text" value={newEvalName} onChange={(e) => setNewEvalName(e.target.value)} placeholder="e.g., Agent Response Quality" className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)]" />
          </div>
          <div className="mb-4">
            <div className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Type</div>
            <select aria-label="Selection" value={newEvalType} onChange={(e) => setNewEvalType(e.target.value)} className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none cursor-pointer">
              <option value="unit">Unit Test</option>
              <option value="integration">Integration Test</option>
              <option value="benchmark">Benchmark</option>
              <option value="conformance">Conformance</option>
              <option value="ontology">Ontology</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreateEval(false)} className={QUIET_BUTTON_CLASS}>Cancel</button>
            <button type="button" onClick={handleCreateEvaluation} className={QUIET_BUTTON_CLASS}>Create</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {evaluations.map((evalItem) => (
          <div role="button" tabIndex={0} key={evalItem.id} className={cn(
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
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); handleRunEvaluation(evalItem.id); }}
                  disabled={isRunningEval}
                  className={QUIET_BUTTON_CLASS}
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
                    <div key={`agentops-idx-${idx}`} className="flex items-center gap-3 p-2.5 bg-[var(--surface-hover)] rounded-lg border border-solid border-transparent hover:border-[var(--ui-border-muted)] transition-colors">
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
        <SectionHeading>Benchmark history</SectionHeading>
        <div className="flex items-end gap-2 h-32 px-2">
          {benchmarkHistory.map((item, idx) => (
            <div key={`agentops-idx-${idx}`} className="flex-1 flex flex-col items-center gap-2 group">
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
      <PanelHeader title="Autonomous tasks">
        <span className="text-[13px] text-[var(--text-secondary)] mr-1">{factoryTasks.length} in queue</span>
        <button type="button" onClick={() => setShowCreateTask(true)} className={QUIET_BUTTON_CLASS}>
          <Plus size={14} /> New task
        </button>
      </PanelHeader>

      {showCreateTask && (
        <div className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-default)]">
          <h4 className="text-[14px] font-bold text-[var(--ui-text-primary)] m-0 mb-4">Create Autonomous Task</h4>
          <div className="mb-4">
            <div className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Spec Reference</div>
            <input aria-label="Input" type="text" value={newTaskSpec} onChange={(e) => setNewTaskSpec(e.target.value)} placeholder="e.g., spec/auth-refactor" className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)]" />
          </div>
          <div className="mb-4">
            <div className="block text-[12px] text-[var(--ui-text-muted)] mb-1.5 font-semibold uppercase tracking-wider">Requirements (one per line)</div>
            <textarea aria-label="Text Area" value={newTaskRequirements} onChange={(e) => setNewTaskRequirements(e.target.value)} placeholder="e.g., Refactor auth middleware..." rows={4} className="w-full p-2.5 px-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)] resize-y font-sans" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreateTask(false)} className={QUIET_BUTTON_CLASS}>Cancel</button>
            <button type="button" onClick={handleCreateTask} className={QUIET_BUTTON_CLASS}>Create task</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {factoryTasks.map((task) => (
          <div key={task.id} className={cn(
            "p-4 bg-[var(--surface-panel)] rounded-xl border border-solid transition-all",
            selectedTask === task.id ? "border-[var(--accent-primary)] shadow-md" : "border-transparent hover:border-[var(--ui-border-muted)]"
          )}>
            <div role="button" tabIndex={0} className="flex items-center justify-between cursor-pointer" onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
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
                      <button type="button" onClick={() => handleApproveChange(task.id, 'change-1')} className={cn(QUIET_BUTTON_CLASS, "flex-1 justify-center")}>
                        <ThumbsUp size={14} /> Approve & merge
                      </button>
                      <button type="button" onClick={() => handleRejectChange(task.id, 'change-1')} className={cn(DESTRUCTIVE_BUTTON_CLASS, "flex-1 justify-center")}>
                        <ThumbsDown size={14} /> Reject
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
          <div key={`agentops-i-${i}`} className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-transparent hover:border-[var(--ui-border-muted)] text-center transition-colors">
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
          <button type="button"
            onClick={handleTriggerCleanup}
            disabled={isRunningGC}
            className={QUIET_BUTTON_CLASS}
          >
            {isRunningGC ? <ArrowsClockwise size={14} className="animate-spin" /> : <Lightning size={14} weight="fill" />}
            {isRunningGC ? 'Running cleanup…' : 'Run full cleanup'}
          </button>
        </div>

        {/* Cleanup Queue */}
        <div>
          <SectionHeading>Cleanup queue</SectionHeading>
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
                  <button type="button"
                    onClick={() => handleRunGCAgent(item.agent)}
                    disabled={runningAgents.has(item.agent)}
                    className={QUIET_BUTTON_CLASS}
                  >
                    {runningAgents.has(item.agent) ? (
                      <><ArrowsClockwise size={12} className="animate-spin" /> Running…</>
                    ) : (
                      'Run now'
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
          <SectionHeading>Cleanup policies</SectionHeading>
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
                <Toggle value={policy.enabled} onChange={(enabled) => handleUpdateGCPolicy(policy.id, { enabled })} />
              </div>
            ))}
          </div>
        </div>

        {/* Cleanup History */}
        <div>
          <SectionHeading>Cleanup history</SectionHeading>
          <div className="flex flex-col gap-2">
            {gcHistory.map((record, idx) => (
              <div key={`agentops-idx-${idx}`} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:bg-white/[0.02] transition-colors">
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
                    <div key={`agentops-i-${i}`} className="text-center">
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
          <SectionHeading>Available GC agents</SectionHeading>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(GC_AGENT_INFO).map(([agentName, info]) => {
              const isRunning = runningAgents.has(agentName);
              const error = gcErrors[agentName];
              return (
                <button type="button"
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

  return (
    <div>
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl border border-solid border-[var(--border-subtle)] mb-6">
        {[
          { id: 'evaluation', label: 'Evaluation Harness', icon: <ChartBar size={16} /> },
          { id: 'factory', label: 'Code Factory', icon: <Code size={16} /> },
          { id: 'gc', label: 'GC Agents', icon: <Recycle size={16} /> },
        ].map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setAgentOpsTab(tab.id as AgentOpsTab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-none text-[13px] font-medium transition-colors cursor-pointer",
              agentOpsTab === tab.id
                ? "bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-sm"
                : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
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
}

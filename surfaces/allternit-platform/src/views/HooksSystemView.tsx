/**
 * HooksSystemView
 *
 * UI for Hooks System - Event-driven lifecycle automation.
 * Manage kernel, workspace, task, and human hooks with real-time execution logs.
 */

'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  Anchor,
  Shield,
  Plus,
  Power,
  Warning,
  CheckCircle,
  Clock,
  Lightning,
} from '@phosphor-icons/react';

interface Hook {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  lastTriggered: string;
  handler: string;
}

interface HookExecution {
  id: string;
  time: string;
  hookName: string;
  result: 'passed' | 'blocked' | 'error';
  duration: string;
}

type HookCategory = 'Kernel' | 'Workspace' | 'Task' | 'Human';

const HOOKS_BY_CATEGORY: Record<HookCategory, Hook[]> = {
  Kernel: [
    { id: 'k1', name: 'pre_tool_execution', enabled: true, priority: 1, lastTriggered: '3s ago', handler: 'ToolValidator' },
    { id: 'k2', name: 'post_tool_execution', enabled: true, priority: 2, lastTriggered: '2s ago', handler: 'TelemetryCollector' },
    { id: 'k3', name: 'on_error', enabled: true, priority: 1, lastTriggered: '1m ago', handler: 'ErrorHandler' },
    { id: 'k4', name: 'on_context_overflow', enabled: false, priority: 3, lastTriggered: 'Never', handler: 'ContextCompressor' },
    { id: 'k5', name: 'pre_model_call', enabled: true, priority: 1, lastTriggered: '5s ago', handler: 'ModelValidator' },
  ],
  Workspace: [
    { id: 'w1', name: 'on_file_change', enabled: true, priority: 2, lastTriggered: '14s ago', handler: 'FileWatcher' },
    { id: 'w2', name: 'on_branch_switch', enabled: true, priority: 1, lastTriggered: '32m ago', handler: 'BranchSync' },
    { id: 'w3', name: 'on_config_update', enabled: true, priority: 2, lastTriggered: '2h ago', handler: 'ConfigReloader' },
    { id: 'w4', name: 'on_dependency_change', enabled: false, priority: 1, lastTriggered: 'Never', handler: 'DependencyResolver' },
  ],
  Task: [
    { id: 't1', name: 'on_task_start', enabled: true, priority: 1, lastTriggered: '8s ago', handler: 'TaskLogger' },
    { id: 't2', name: 'on_task_complete', enabled: true, priority: 1, lastTriggered: '12s ago', handler: 'TaskNotifier' },
    { id: 't3', name: 'on_task_failure', enabled: true, priority: 2, lastTriggered: '4m ago', handler: 'FailureRecovery' },
    { id: 't4', name: 'on_subtask_created', enabled: true, priority: 3, lastTriggered: '1h ago', handler: 'SubtaskTracker' },
    { id: 't5', name: 'on_dependency_resolved', enabled: false, priority: 2, lastTriggered: 'Never', handler: 'DependencyResolver' },
  ],
  Human: [
    { id: 'h1', name: 'on_approval_required', enabled: true, priority: 1, lastTriggered: '45s ago', handler: 'ApprovalQueue' },
    { id: 'h2', name: 'on_message_send', enabled: true, priority: 2, lastTriggered: '6s ago', handler: 'MessageRouter' },
    { id: 'h3', name: 'on_user_input', enabled: true, priority: 1, lastTriggered: '19s ago', handler: 'InputProcessor' },
    { id: 'h4', name: 'on_escalation', enabled: true, priority: 1, lastTriggered: '52m ago', handler: 'EscalationManager' },
  ],
};


interface StatsData {
  totalHooks: number;
  activeHooks: number;
  triggeredToday: number;
  failedCount: number;
}

function HookRow({ hook, onToggle }: { hook: Hook; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-semibold text-[var(--text-primary)] mb-1">
          {hook.name}
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          Handler: {hook.handler}
        </div>
      </div>

      <div className="flex items-center gap-6 ml-4 flex-shrink-0">
        <div className="text-xs text-[var(--text-tertiary)] w-20 text-right">
          {hook.lastTriggered}
        </div>

        <div className="text-xs font-mono text-[var(--text-secondary)] w-12 text-center">
          P{hook.priority}
        </div>

        <button
          onClick={() => onToggle(hook.id)}
          className={`p-2 rounded-lg transition-colors ${
            hook.enabled
              ? 'text-green-500 bg-rgba(52, 199, 89, 0.1)'
              : 'text-[var(--text-tertiary)] bg-[var(--bg-secondary)]'
          }`}
          title={hook.enabled ? 'Disable' : 'Enable'}
        >
          <Power size={16} />
        </button>
      </div>
    </div>
  );
}

function ExecutionLogEntry({ execution }: { execution: HookExecution }) {
  const resultConfig: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    passed: { bg: 'rgba(52, 199, 89, 0.08)', color: 'var(--status-success)', icon: <CheckCircle size={16} /> },
    blocked: { bg: 'rgba(255, 159, 10, 0.08)', color: '#ff9f0a', icon: <Shield size={16} /> },
    error: { bg: 'rgba(255, 59, 48, 0.08)', color: 'var(--status-error)', icon: <Warning size={16} /> },
  };

  const config = resultConfig[execution.result];

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 text-sm">
      <div className="flex items-center gap-3 flex-1">
        <Clock className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
        <span className="text-[var(--text-tertiary)] font-mono text-xs w-16">
          {execution.time}
        </span>
        <span className="text-[var(--text-primary)] font-mono">
          {execution.hookName}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ background: config.bg, color: config.color }}
        >
          {config.icon}
          <span className="text-xs font-medium capitalize">{execution.result}</span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)] w-10 text-right">
          {execution.duration}
        </span>
      </div>
    </div>
  );
}

export function HooksSystemView() {
  const [activeTab, setActiveTab] = useState<HookCategory>('Kernel');
  const [hooks, setHooks] = useState(HOOKS_BY_CATEGORY);

  const handleToggleHook = (category: HookCategory, hookId: string) => {
    setHooks((prev) => ({
      ...prev,
      [category]: prev[category].map((h) =>
        h.id === hookId ? { ...h, enabled: !h.enabled } : h
      ),
    }));
  };

  const allHooks = Object.values(hooks).flat();
  const activeHooks = allHooks.filter((h) => h.enabled);
  const stats: StatsData = {
    totalHooks: allHooks.length,
    activeHooks: activeHooks.length,
    triggeredToday: 28,
    failedCount: 1,
  };

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Anchor className="w-7 h-7 text-[var(--accent-primary)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Hooks System
              </h1>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Event-driven lifecycle automation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm font-semibold text-[var(--text-secondary)]">
              Total Hooks
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)] mt-1">
              {stats.totalHooks}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-secondary)]">
              Active
            </div>
            <div className="text-2xl font-bold text-green-500 mt-1">
              {stats.activeHooks}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-secondary)]">
              Triggered Today
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)] mt-1">
              {stats.triggeredToday}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-secondary)]">
              Failed
            </div>
            <div className="text-2xl font-bold text-red-500 mt-1">
              {stats.failedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-[var(--border-subtle)] flex gap-8">
        {(['Kernel', 'Workspace', 'Task', 'Human'] as HookCategory[]).map((category) => (
          <button
            key={category}
            onClick={() => setActiveTab(category)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === category
                ? 'text-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            }`}
          >
            {category} ({hooks[category].length})
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Hooks list */}
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
                Registered Hooks
              </h2>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] text-xs font-medium hover:opacity-90 transition-opacity">
                <Plus size={16} />
                Add Hook
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
              {hooks[activeTab].map((hook) => (
                <HookRow
                  key={hook.id}
                  hook={hook}
                  onToggle={(id) => handleToggleHook(activeTab, id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Event log */}
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="px-6 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <Lightning size={16} />
              Recent Executions
            </h2>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden">
              {/* Execution history populated via real hook event stream */}
            </div>
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}

export default HooksSystemView;

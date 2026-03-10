/**
 * Live Execution Monitor
 * 
 * Real-time monitoring of agent executions, DAGs, and WIHs.
 * Features:
 * - Live log streaming
 * - DAG visualization
 * - WIH status tracking
 * - Execution timeline
 * - Error highlighting
 * 
 * @module LiveExecutionMonitor
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Square,
  Filter,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Zap,
  GitBranch,
  Layers,
  Box,
  MoreHorizontal,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';

import {
  SAND,
  MODE_COLORS,
  createGlassStyle,
  RADIUS,
  SPACE,
  TEXT,
  STATUS,
  type AgentMode,
} from '@/design/a2r.tokens';

// ============================================================================
// Types
// ============================================================================

export interface LiveExecutionMonitorProps {
  executionId?: string;
  dagId?: string;
  mode?: AgentMode;
  onStop?: () => void;
  onRestart?: () => void;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface DagNode {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  dependencies: string[];
  agent?: string;
}

export interface DagExecution {
  id: string;
  nodes: DagNode[];
  edges: { from: string; to: string }[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
}

export interface WihInfo {
  id: string;
  title: string;
  status: 'ready' | 'claimed' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockLogs(): LogEntry[] {
  const levels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error'];
  const sources = ['kernel', 'agent', 'tool', 'dag', 'wih', 'runtime'];
  const messages = [
    'Initializing agent session',
    'Tool execution started: read_file',
    'Received message from user',
    'Processing with model gpt-4',
    'DAG node completed successfully',
    'WIH claimed by agent-worker-1',
    'Memory operation: storing context',
    'Policy check passed',
    'Checkpoint created',
    'Streaming response chunks',
  ];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `log-${Date.now() - i * 1000}`,
    timestamp: new Date(Date.now() - i * 1000),
    level: levels[Math.floor(Math.random() * levels.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    metadata: Math.random() > 0.7 ? { tool: 'read_file', duration: 120 } : undefined,
  })).reverse();
}

function generateMockDag(): DagExecution {
  const nodes: DagNode[] = [
    { id: 'node-1', name: 'Parse Request', status: 'completed', dependencies: [], duration: 150 },
    { id: 'node-2', name: 'Retrieve Context', status: 'completed', dependencies: ['node-1'], duration: 320 },
    { id: 'node-3', name: 'Analyze Code', status: 'running', dependencies: ['node-2'], duration: 0 },
    { id: 'node-4', name: 'Generate Response', status: 'pending', dependencies: ['node-3'], duration: 0 },
    { id: 'node-5', name: 'Validate Output', status: 'pending', dependencies: ['node-4'], duration: 0 },
  ];

  return {
    id: 'dag-1',
    nodes,
    edges: [
      { from: 'node-1', to: 'node-2' },
      { from: 'node-2', to: 'node-3' },
      { from: 'node-3', to: 'node-4' },
      { from: 'node-4', to: 'node-5' },
    ],
    status: 'running',
    progress: 40,
  };
}

function generateMockWihs(): WihInfo[] {
  return [
    { id: 'wih-1', title: 'Review code changes', status: 'completed', priority: 1, createdAt: new Date() },
    { id: 'wih-2', title: 'Run test suite', status: 'in_progress', assignee: 'agent-1', priority: 2, createdAt: new Date() },
    { id: 'wih-3', title: 'Generate documentation', status: 'ready', priority: 3, createdAt: new Date() },
    { id: 'wih-4', title: 'Security scan', status: 'ready', priority: 1, createdAt: new Date() },
    { id: 'wih-5', title: 'Deploy to staging', status: 'ready', priority: 4, createdAt: new Date() },
  ];
}

// ============================================================================
// Main Component
// ============================================================================

export function LiveExecutionMonitor({
  executionId,
  dagId,
  mode = 'code',
  onStop,
  onRestart,
}: LiveExecutionMonitorProps) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;
  const [activeTab, setActiveTab] = useState<'logs' | 'dag' | 'wihs'>('logs');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dag, setDag] = useState<DagExecution | null>(null);
  const [wihs, setWihs] = useState<WihInfo[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [filterLevel, setFilterLevel] = useState<LogEntry['level'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Initialize data
  useEffect(() => {
    setLogs(generateMockLogs());
    setDag(generateMockDag());
    setWihs(generateMockWihs());
  }, []);

  // Simulate live log streaming
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setLogs((prev) => {
        const newLog: LogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date(),
          level: Math.random() > 0.9 ? 'warn' : 'info',
          source: ['kernel', 'agent', 'tool'][Math.floor(Math.random() * 3)],
          message: `Streaming update at ${new Date().toLocaleTimeString()}`,
        };
        return [...prev.slice(-499), newLog];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current && activeTab === 'logs') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, activeTab]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesSearch = !searchQuery || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div 
      className="flex flex-col h-full overflow-hidden"
      style={{ background: '#0D0B09' }}
    >
      {/* Header */}
      <MonitorHeader
        executionId={executionId}
        isLive={isLive}
        setIsLive={setIsLive}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStop={onStop}
        onRestart={onRestart}
        modeColors={modeColors as typeof MODE_COLORS.code}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'logs' && (
          <LogsPanel
            logs={filteredLogs}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            logsEndRef={logsEndRef}
            logsContainerRef={logsContainerRef}
            onScroll={handleScroll}
            modeColors={modeColors as typeof MODE_COLORS.code}
          />
        )}
        {activeTab === 'dag' && dag && (
          <DagPanel
            dag={dag}
            modeColors={modeColors as typeof MODE_COLORS.code}
          />
        )}
        {activeTab === 'wihs' && (
          <WihsPanel
            wihs={wihs}
            modeColors={modeColors as typeof MODE_COLORS.code}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function MonitorHeader({
  executionId,
  isLive,
  setIsLive,
  activeTab,
  setActiveTab,
  onStop,
  onRestart,
  modeColors,
}: {
  executionId?: string;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: 'logs' | 'dag' | 'wihs') => void;
  onStop?: () => void;
  onRestart?: () => void;
  modeColors: typeof MODE_COLORS.code;
}) {
  const tabs = [
    { id: 'logs', label: 'Logs', icon: Terminal },
    { id: 'dag', label: 'DAG', icon: GitBranch },
    { id: 'wihs', label: 'WIHs', icon: Layers },
  ];

  return (
    <div 
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{ 
        borderColor: modeColors.border,
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: modeColors.soft,
            }}
          >
            <Activity size={16} style={{ color: modeColors.accent }} />
          </div>
          <div>
            <div className="text-sm font-medium" style={{ color: TEXT.primary }}>
              Live Execution
            </div>
            <div className="text-xs" style={{ color: TEXT.tertiary }}>
              {executionId || 'exec-12345'}
            </div>
          </div>
        </div>

        {/* Live Indicator */}
        <button
          onClick={() => setIsLive(!isLive)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            background: isLive ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
            color: isLive ? '#4ade80' : TEXT.tertiary,
            border: `1px solid ${isLive ? 'rgba(74,222,128,0.3)' : 'transparent'}`,
          }}
        >
          <span 
            className={`w-2 h-2 rounded-full ${isLive ? 'animate-pulse' : ''}`}
            style={{ background: isLive ? '#4ade80' : TEXT.tertiary }}
          />
          {isLive ? 'LIVE' : 'PAUSED'}
        </button>
      </div>

      {/* Tabs */}
      <div 
        className="flex items-center rounded-lg p-1"
        style={{ background: 'rgba(0,0,0,0.3)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? modeColors.soft : 'transparent',
                color: activeTab === tab.id ? modeColors.accent : TEXT.secondary,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onRestart && (
          <button
            onClick={onRestart}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: TEXT.secondary,
            }}
          >
            <RotateCcw size={16} />
          </button>
        )}
        {onStop && (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: '#f87171',
              color: '#fff',
            }}
          >
            <Square size={14} fill="currentColor" />
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function LogsPanel({
  logs,
  filterLevel,
  setFilterLevel,
  searchQuery,
  setSearchQuery,
  autoScroll,
  setAutoScroll,
  logsEndRef,
  logsContainerRef,
  onScroll,
  modeColors,
}: {
  logs: LogEntry[];
  filterLevel: LogEntry['level'] | 'all';
  setFilterLevel: (level: LogEntry['level'] | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  autoScroll: boolean;
  setAutoScroll: (auto: boolean) => void;
  logsEndRef: React.RefObject<HTMLDivElement>;
  logsContainerRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  modeColors: typeof MODE_COLORS.code;
}) {
  const levelColors = {
    debug: { bg: 'rgba(255,255,255,0.05)', color: TEXT.tertiary },
    info: { bg: 'transparent', color: TEXT.secondary },
    warn: { bg: 'rgba(251,191,36,0.05)', color: '#fbbf24' },
    error: { bg: 'rgba(248,113,113,0.05)', color: '#f87171' },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div 
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: modeColors.border }}
      >
        {/* Level Filter */}
        <div className="flex items-center gap-1">
          {(['all', 'debug', 'info', 'warn', 'error'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className="px-2 py-1 rounded text-xs font-medium capitalize transition-all"
              style={{
                background: filterLevel === level ? modeColors.soft : 'transparent',
                color: filterLevel === level ? modeColors.accent : TEXT.tertiary,
              }}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: TEXT.tertiary }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none w-48"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </div>

        {/* Auto-scroll Toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: autoScroll ? modeColors.soft : 'transparent',
            color: autoScroll ? modeColors.accent : TEXT.tertiary,
            border: `1px solid ${autoScroll ? modeColors.border : 'transparent'}`,
          }}
        >
          Auto-scroll
        </button>

        <button
          className="p-1.5 rounded-lg transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: TEXT.secondary,
          }}
        >
          <Download size={14} />
        </button>
      </div>

      {/* Logs */}
      <div 
        ref={logsContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto font-mono text-sm p-4"
        style={{ background: '#0a0908' }}
      >
        {logs.map((log, index) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.1 }}
            className="flex gap-3 py-1 px-2 rounded"
            style={{
              background: levelColors[log.level].bg,
            }}
          >
            <span className="text-xs shrink-0 w-16" style={{ color: TEXT.tertiary }}>
              {log.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span 
              className="text-xs shrink-0 w-12 font-semibold uppercase"
              style={{ color: levelColors[log.level].color }}
            >
              {log.level}
            </span>
            <span className="text-xs shrink-0 w-16" style={{ color: modeColors.accent }}>
              [{log.source}]
            </span>
            <span style={{ color: levelColors[log.level].color }}>
              {log.message}
            </span>
          </motion.div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

function DagPanel({
  dag,
  modeColors,
}: {
  dag: DagExecution;
  modeColors: typeof MODE_COLORS.code;
}) {
  const statusColors = {
    pending: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', icon: Clock },
    running: { bg: modeColors.soft, border: modeColors.accent, icon: Activity },
    completed: { bg: 'rgba(74,222,128,0.1)', border: '#4ade80', icon: CheckCircle },
    failed: { bg: 'rgba(248,113,113,0.1)', border: '#f87171', icon: XCircle },
    skipped: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.05)', icon: Box },
  };

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* DAG Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
            DAG Execution
          </h3>
          <p className="text-sm" style={{ color: TEXT.secondary }}>
            {dag.id} • {dag.nodes.length} nodes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{
              background: dag.status === 'running' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
              color: dag.status === 'running' ? '#4ade80' : '#fbbf24',
            }}
          >
            {dag.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2" style={{ color: TEXT.secondary }}>
          <span>Overall Progress</span>
          <span>{dag.progress}%</span>
        </div>
        <div 
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: modeColors.accent }}
            initial={{ width: 0 }}
            animate={{ width: `${dag.progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* DAG Visualization */}
      <div className="space-y-4">
        {dag.nodes.map((node, index) => {
          const status = statusColors[node.status];
          const StatusIcon = status.icon;
          
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Connector Line */}
              {index > 0 && (
                <div className="flex justify-center mb-2">
                  <div 
                    className="w-0.5 h-4"
                    style={{ background: modeColors.border }}
                  />
                </div>
              )}

              {/* Node Card */}
              <div
                className="p-4 rounded-xl flex items-center gap-4"
                style={{
                  background: status.bg,
                  border: `1px solid ${status.border}`,
                }}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${status.border}30` }}
                >
                  <StatusIcon size={20} style={{ color: status.border }} />
                </div>

                <div className="flex-1">
                  <div className="font-medium" style={{ color: TEXT.primary }}>
                    {node.name}
                  </div>
                  <div className="text-sm flex items-center gap-3" style={{ color: TEXT.tertiary }}>
                    <span className="capitalize">{node.status}</span>
                    {node.duration && node.duration > 0 && (
                      <>
                        <span>•</span>
                        <span>{node.duration}ms</span>
                      </>
                    )}
                  </div>
                </div>

                {node.status === 'running' && (
                  <div 
                    className="w-24 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: status.border }}
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function WihsPanel({
  wihs,
  modeColors,
}: {
  wihs: WihInfo[];
  modeColors: typeof MODE_COLORS.code;
}) {
  const statusColors = {
    ready: { bg: 'rgba(255,255,255,0.05)', color: TEXT.tertiary },
    claimed: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24' },
    in_progress: { bg: modeColors.soft, color: modeColors.accent },
    completed: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80' },
    failed: { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
  };

  const priorityLabels = ['Low', 'Medium', 'High', 'Critical'];

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
            Work In Hand (WIHs)
          </h3>
          <p className="text-sm" style={{ color: TEXT.secondary }}>
            {wihs.length} tasks • {wihs.filter(w => w.status === 'in_progress').length} active
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {wihs.map((wih, index) => {
          const status = statusColors[wih.status];
          return (
            <motion.div
              key={wih.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl"
              style={{
                background: status.bg,
                border: `1px solid ${modeColors.border}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div 
                    className="w-2 h-2 rounded-full mt-2"
                    style={{ 
                      background: status.color,
                      boxShadow: `0 0 8px ${status.color}`,
                    }}
                  />
                  <div>
                    <div className="font-medium" style={{ color: TEXT.primary }}>
                      {wih.title}
                    </div>
                    <div className="text-sm flex items-center gap-2 mt-1" style={{ color: TEXT.tertiary }}>
                      <span className="capitalize">{wih.status.replace('_', ' ')}</span>
                      {wih.assignee && (
                        <>
                          <span>•</span>
                          <span>{wih.assignee}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: wih.priority <= 1 ? '#f87171' : wih.priority === 2 ? '#fbbf24' : TEXT.tertiary,
                    }}
                  >
                    P{wih.priority}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

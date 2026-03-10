/**
 * A2rchitect Super-Agent OS - A2r Console Drawer
 * 
 * The main agent control center featuring:
 * - Agent Terminal: xterm.js-based console for direct agent interaction
 * - Kanban Board: Visual task management for agent workflows
 * - Automation Hub: Trigger and monitor automated sequences
 */

import * as React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import type { TaskNode, Agent } from '../types/programs';

// ============================================================================
// Types
// ============================================================================

interface A2rConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConsoleTab = 'terminal' | 'kanban' | 'automation';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'agent';
  content: string;
  timestamp: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

interface KanbanColumn {
  id: string;
  title: string;
  status: TaskNode['status'];
  color: string;
}

interface KanbanTask extends TaskNode {
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

interface AutomationSequence {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  triggers: string[];
  lastRun?: string;
  nextRun?: string;
  runCount: number;
}

// ============================================================================
// Agent Terminal Component
// ============================================================================

const AgentTerminal: React.FC = () => {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [activeAgent, setActiveAgent] = useState<string>('system');
  const [agents, setAgents] = useState<Agent[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((line: Omit<TerminalLine, 'id' | 'timestamp'>) => {
    setLines(prev => [...prev, {
      ...line,
      id: `line-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  const handleCommand = useCallback(async (command: string) => {
    // Add command to history
    addLine({ type: 'input', content: command });
    setInput('');

    const [cmd, ...args] = command.trim().split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        addLine({
          type: 'system',
          content: `Available commands:
  help              Show this help message
  agents            List all available agents
  use <agent>       Switch to agent context
  run <task>        Run a task with current agent
  status            Show agent status
  clear             Clear terminal
  logs              Show recent logs
  workflows         List active workflows`,
        });
        break;

      case 'clear':
        setLines([]);
        break;

      case 'agents':
        addLine({
          type: 'output',
          content: `Available agents:
  🤖 orchestrator   - Main workflow coordinator
  🔍 researcher     - Information gathering
  💻 developer      - Code generation & review
  🎨 designer       - UI/UX design tasks
  📊 analyst        - Data analysis & visualization`,
        });
        break;

      case 'use':
        if (args[0]) {
          setActiveAgent(args[0]);
          addLine({
            type: 'system',
            content: `Switched to agent: ${args[0]}`,
          });
        } else {
          addLine({
            type: 'error',
            content: 'Usage: use <agent-name>',
          });
        }
        break;

      case 'run':
        if (args.length > 0) {
          const task = args.join(' ');
          addLine({
            type: 'system',
            content: `🚀 Starting task with ${activeAgent}: "${task}"`,
          });
          
          // Simulate agent processing
          setTimeout(() => {
            addLine({
              type: 'agent',
              content: `Processing task: ${task}`,
              agentId: activeAgent,
            });
          }, 500);
          
          setTimeout(() => {
            addLine({
              type: 'output',
              content: `✅ Task completed successfully`,
            });
          }, 2000);
        } else {
          addLine({
            type: 'error',
            content: 'Usage: run <task-description>',
          });
        }
        break;

      case 'status':
        addLine({
          type: 'output',
          content: `Agent: ${activeAgent}
Status: active
Tasks completed: 42
Uptime: 2h 15m`,
        });
        break;

      case 'logs':
        addLine({
          type: 'output',
          content: `Recent activity:
[10:32:45] Task completed: Code review
[10:28:12] New workflow started: Data analysis
[10:15:33] Agent connected: researcher`,
        });
        break;

      case 'workflows':
        addLine({
          type: 'output',
          content: `Active workflows:
  #1234 - Data Pipeline (running)
  #1235 - Report Generation (paused)
  #1236 - Code Review Queue (idle)`,
        });
        break;

      default:
        addLine({
          type: 'error',
          content: `Unknown command: ${cmd}. Type 'help' for available commands.`,
        });
    }
  }, [activeAgent, addLine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input);
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }, [input, handleCommand]);

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-green-400';
      case 'output': return 'text-gray-300';
      case 'error': return 'text-red-400';
      case 'system': return 'text-blue-400';
      case 'agent': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  const getLinePrefix = (type: TerminalLine['type'], agentId?: string) => {
    switch (type) {
      case 'input': return '❯';
      case 'error': return '✗';
      case 'system': return 'ℹ';
      case 'agent': return `🤖 ${agentId || 'agent'}`;
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 font-mono text-sm">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-green-400">●</span>
          <span>Agent Terminal</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Active: {activeAgent}</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded">Ctrl+L clear</span>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="text-gray-500 mb-4">
          A2rchitect Agent Terminal v1.0.0
          Type 'help' for available commands.
        </div>
        {lines.map(line => (
          <div key={line.id} className={`${getLineColor(line.type)} whitespace-pre-wrap break-all`}>
            {line.type === 'input' && (
              <span className="text-green-400 mr-2">{getLinePrefix(line.type)}</span>
            )}
            {line.type === 'agent' && (
              <span className="text-yellow-400 mr-2">{getLinePrefix(line.type, line.agentId)}</span>
            )}
            {line.type === 'error' && (
              <span className="text-red-400 mr-2">{getLinePrefix(line.type)}</span>
            )}
            {line.type === 'system' && (
              <span className="text-blue-400 mr-2">{getLinePrefix(line.type)}</span>
            )}
            {line.content}
          </div>
        ))}
      </div>

      {/* Terminal Input */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-t border-gray-700">
        <span className="text-green-400">❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-gray-100 placeholder-gray-500"
          placeholder="Type a command..."
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
};

// ============================================================================
// Kanban Board Component
// ============================================================================

const KanbanBoard: React.FC = () => {
  const store = useSidecarStore();
  
  const columns: KanbanColumn[] = [
    { id: 'pending', title: '📋 Pending', status: 'pending', color: 'bg-gray-500' },
    { id: 'running', title: '🔄 In Progress', status: 'running', color: 'bg-blue-500' },
    { id: 'completed', title: '✅ Completed', status: 'completed', color: 'bg-green-500' },
    { id: 'error', title: '❌ Error', status: 'error', color: 'bg-red-500' },
  ];

  const [tasks, setTasks] = useState<KanbanTask[]>([
    { 
      id: 'task-1', 
      name: 'Research Phase', 
      status: 'completed',
      dependencies: [],
      assignee: 'researcher',
      priority: 'high',
      dueDate: '2026-03-10',
    },
    { 
      id: 'task-2', 
      name: 'Data Analysis', 
      status: 'running',
      dependencies: ['task-1'],
      assignee: 'analyst',
      priority: 'medium',
      dueDate: '2026-03-11',
    },
    { 
      id: 'task-3', 
      name: 'Code Implementation', 
      status: 'pending',
      dependencies: ['task-2'],
      assignee: 'developer',
      priority: 'high',
      dueDate: '2026-03-12',
    },
    { 
      id: 'task-4', 
      name: 'UI Design Review', 
      status: 'pending',
      dependencies: [],
      assignee: 'designer',
      priority: 'low',
      dueDate: '2026-03-13',
    },
  ]);

  const [draggedTask, setDraggedTask] = useState<KanbanTask | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  // Subscribe to DAG updates (placeholder for real implementation)
  useEffect(() => {
    // TODO: Connect to workspace service for real-time updates
  }, []);

  const handleDragStart = (task: KanbanTask) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskNode['status']) => {
    e.preventDefault();
    if (!draggedTask) return;

    setTasks(prev => prev.map(task => 
      task.id === draggedTask.id 
        ? { ...task, status }
        : task
    ));
    setDraggedTask(null);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    
    const newTask: KanbanTask = {
      id: `task-${Date.now()}`,
      name: newTaskName,
      status: 'pending',
      dependencies: [],
      assignee: 'unassigned',
      priority: 'medium',
    };
    
    setTasks(prev => [...prev, newTask]);
    setNewTaskName('');
    setShowAddTask(false);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTasksForColumn = (status: TaskNode['status']) => {
    return tasks.filter(task => task.status === status);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Board Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h2 className="font-semibold">Kanban Board</h2>
          <span className="text-sm text-gray-500">({tasks.length} tasks)</span>
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          ➕ Add Task
        </button>
      </div>

      {/* Board Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map(column => (
            <div
              key={column.id}
              className="w-72 flex flex-col bg-gray-100 dark:bg-gray-800 rounded-lg"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, column.status)}
            >
              {/* Column Header */}
              <div className={`px-4 py-3 rounded-t-lg ${column.color} text-white`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{column.title}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
                    {getTasksForColumn(column.status).length}
                  </span>
                </div>
              </div>

              {/* Column Tasks */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {getTasksForColumn(column.status).map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm cursor-move hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-sm">{task.name}</span>
                      <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600">
                        ⋮
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {task.assignee && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded">
                            @{task.assignee}
                          </span>
                        )}
                        {task.priority && (
                          <span className={`px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      {task.dueDate && (
                        <span className="text-gray-400">
                          📅 {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Task</h3>
            <input
              type="text"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Task name..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-700"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Automation Hub Component
// ============================================================================

const AutomationHub: React.FC = () => {
  const [sequences, setSequences] = useState<AutomationSequence[]>([
    {
      id: 'auto-1',
      name: 'Daily Report Generation',
      description: 'Automatically generate and email daily analytics reports',
      status: 'idle',
      progress: 0,
      triggers: ['schedule: daily 9am', 'manual'],
      runCount: 42,
    },
    {
      id: 'auto-2',
      name: 'Code Review Pipeline',
      description: 'Run automated code review and security scans on PRs',
      status: 'running',
      progress: 65,
      triggers: ['github: pull_request'],
      lastRun: '2026-03-09T10:30:00Z',
      runCount: 156,
    },
    {
      id: 'auto-3',
      name: 'Data Backup',
      description: 'Backup all project data to S3',
      status: 'completed',
      progress: 100,
      triggers: ['schedule: hourly'],
      lastRun: '2026-03-09T11:00:00Z',
      runCount: 720,
    },
    {
      id: 'auto-4',
      name: 'Dependency Updates',
      description: 'Check for and apply security updates',
      status: 'error',
      progress: 30,
      triggers: ['schedule: weekly'],
      lastRun: '2026-03-08T02:00:00Z',
      runCount: 12,
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const getStatusColor = (status: AutomationSequence['status']) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: AutomationSequence['status']) => {
    switch (status) {
      case 'running': return '▶️';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'paused': return '⏸️';
      default: return '⏹️';
    }
  };

  const handleRunSequence = (id: string) => {
    setSequences(prev => prev.map(seq => 
      seq.id === id 
        ? { ...seq, status: 'running', progress: 0 }
        : seq
    ));

    // Simulate progress
    const interval = setInterval(() => {
      setSequences(prev => {
        const seq = prev.find(s => s.id === id);
        if (!seq || seq.status !== 'running') {
          clearInterval(interval);
          return prev;
        }
        
        const newProgress = seq.progress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          return prev.map(s => 
            s.id === id 
              ? { ...s, status: 'completed', progress: 100, lastRun: new Date().toISOString(), runCount: s.runCount + 1 }
              : s
          );
        }
        
        return prev.map(s => 
          s.id === id 
            ? { ...s, progress: newProgress }
            : s
        );
      });
    }, 500);
  };

  const handleToggleSequence = (id: string) => {
    setSequences(prev => prev.map(seq => {
      if (seq.id !== id) return seq;
      return {
        ...seq,
        status: seq.status === 'paused' ? 'idle' : 'paused',
      };
    }));
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Hub Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="font-semibold">Automation Hub</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          ➕ New Sequence
        </button>
      </div>

      {/* Sequences List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sequences.map(seq => (
          <div
            key={seq.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(seq.status)}</span>
                <div>
                  <h3 className="font-medium">{seq.name}</h3>
                  <p className="text-sm text-gray-500">{seq.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunSequence(seq.id)}
                  disabled={seq.status === 'running'}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {seq.status === 'running' ? 'Running...' : '▶ Run'}
                </button>
                <button
                  onClick={() => handleToggleSequence(seq.id)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {seq.status === 'paused' ? '▶️' : '⏸️'}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {seq.status === 'running' && (
              <div className="mb-3">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(seq.status)} transition-all duration-300`}
                    style={{ width: `${seq.progress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">{seq.progress}% complete</div>
              </div>
            )}

            {/* Sequence Details */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <span>🔄</span>
                <span>{seq.runCount} runs</span>
              </div>
              {seq.lastRun && (
                <div className="flex items-center gap-1">
                  <span>📅</span>
                  <span>Last: {new Date(seq.lastRun).toLocaleDateString()}</span>
                </div>
              )}
              {seq.nextRun && (
                <div className="flex items-center gap-1">
                  <span>⏰</span>
                  <span>Next: {new Date(seq.nextRun).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>⚡</span>
                <span className="flex gap-1">
                  {seq.triggers.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      {t}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create Automation Sequence</h3>
            <p className="text-gray-500 mb-4">
              Automation sequences can be created via the WorkflowBuilder or by writing a workflow file.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Open WorkflowBuilder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main A2r Console Component
// ============================================================================

export const A2rConsole: React.FC<A2rConsoleProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('terminal');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full sm:w-[900px] h-[80vh] sm:h-[600px] bg-white dark:bg-gray-900 rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-200">
        {/* Drawer Header with Tabs */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <span className="text-xl">🤖</span>
            <span className="font-semibold">A2r Console</span>
            
            {/* Tab Navigation */}
            <div className="flex gap-1 ml-4">
              {[
                { id: 'terminal', label: 'Terminal', icon: '💻' },
                { id: 'kanban', label: 'Kanban', icon: '📊' },
                { id: 'automation', label: 'Automation', icon: '🤖' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ConsoleTab)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content Area */}
        <div className="h-[calc(100%-60px)]">
          {activeTab === 'terminal' && <AgentTerminal />}
          {activeTab === 'kanban' && <KanbanBoard />}
          {activeTab === 'automation' && <AutomationHub />}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// A2r Console Toggle Button
// ============================================================================

export const A2rConsoleToggle: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
      >
        <span className="text-xl">🤖</span>
        <span>A2r</span>
      </button>
      
      <A2rConsole isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default A2rConsole;

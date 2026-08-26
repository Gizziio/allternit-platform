/**
 * AutomationTasksView.tsx
 *
 * Unified view for Automation Tasks (replacing Cron/Scheduled tasks).
 * Aggregates and manages Goals (Workflows), Routines (Schedules), and Loops (Continuous/Monitoring).
 * Fully aligned with the Premium Sand Nude UI design system.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  Clock,
  Plus,
  X,
  Play,
  Trash,
  PencilSimple,
  CaretDown,
  FolderOpen,
  Robot,
  CircleNotch,
  Target,
  Repeat,
  MagnifyingGlass,
  ChatCircleDots,
  Warning,
  Sparkle,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { ModelPicker, type ModelSelection } from '@/components/model-picker';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useAgentStore } from '@/lib/agents';
import { HeartbeatScheduler } from '@/components/agent-workspace';
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  runRoutine,
  listLoops,
  createLoop,
  updateLoop,
  deleteLoop,
  runLoop,
} from '@/lib/automation-api';
import {
  listScheduledJobs,
  createScheduledJob,
  deleteScheduledJob,
  updateScheduledJob,
  runScheduledJobNow,
} from '@/lib/agents/scheduled-jobs.service';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  DayOfWeekSelector,
  parseCronDays,
  applyCronDays,
} from './DayOfWeekSelector';

// Unified types
type TaskType = 'goal' | 'routine' | 'loop' | 'heartbeat';
type Frequency = 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'continuous';

interface UnifiedTask {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  prompt: string;
  status: string;
  frequency: Frequency;
  schedule_expression?: string;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  priority?: string;
  targetDate?: string;
  goalId?: string;
  routineId?: string;
  agentId?: string;
  executorName?: string;
  folder?: string;
}

interface AutomationTasksViewProps {
  initialTab?: 'all' | 'goal' | 'routine' | 'loop' | 'heartbeat';
  agentId?: string;
  title?: string;
  hideAgentSelector?: boolean;
  embedded?: boolean;
  /** Hide only the page title/description; keep filters, tabs, search, and create controls. */
  hideTitle?: boolean;
}

export function AutomationTasksView({
  initialTab = 'all',
  agentId,
  title,
  hideAgentSelector,
  embedded,
  hideTitle,
}: AutomationTasksViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'goal' | 'routine' | 'loop' | 'heartbeat'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'type'>('date');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTask, setEditingTask] = useState<UnifiedTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [selectedHeartbeatAgent, setSelectedHeartbeatAgent] = useState<string | null>(agentId ?? null);

  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [goalsList, setGoalsList] = useState<any[]>([]);
  const [routinesList, setRoutinesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keepAwake, setKeepAwake] = useState(true);

  const [prefilledData, setPrefilledData] = useState<any>(null);

  const { agents, fetchAgents } = useAgentStore();

  useEffect(() => {
    fetchAgents();
    loadAllTasks();
  }, []);

  const loadAllTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [goals, routines, loops, heartbeats] = await Promise.all([
        listGoals().catch(() => []),
        listRoutines().catch(() => []),
        listLoops().catch(() => []),
        listScheduledJobs().catch(() => []),
      ]);

      setGoalsList(goals);
      setRoutinesList(routines);

      const unified: UnifiedTask[] = [];

      // Map Goals
      goals.forEach(g => {
        unified.push({
          id: g.id,
          type: 'goal',
          name: g.title,
          description: g.description || '',
          prompt: '',
          status: g.status,
          frequency: 'manual',
          isActive: g.status === 'active',
          createdAt: g.created_at || new Date().toISOString(),
          updatedAt: g.updated_at || new Date().toISOString(),
          progress: g.progress,
          priority: g.priority,
          targetDate: g.target_date,
          agentId: g.agent_id,
          executorName: g.agent_id ? agents.find(a => a.id === g.agent_id)?.name : 'Default Model',
        });
      });

      // Map Routines
      routines.forEach(r => {
        let freq: Frequency = 'manual';
        if (r.schedule_type === 'cron') {
          if (r.schedule_expression === '0 * * * *') freq = 'hourly';
          else if (r.schedule_expression === '0 9 * * *') freq = 'daily';
          else if (r.schedule_expression === '0 9 * * 1-5') freq = 'weekdays';
          else if (r.schedule_expression === '0 9 * * 1') freq = 'weekly';
        } else if (r.schedule_type === 'manual') {
          freq = 'manual';
        }

        unified.push({
          id: r.id,
          type: 'routine',
          name: r.name,
          description: r.description || '',
          prompt: r.description || '',
          status: r.status,
          frequency: freq,
          schedule_expression: r.schedule_expression,
          isActive: r.status === 'active',
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
          goalId: r.goal_id,
          agentId: r.agent_id,
          executorName: r.agent_id ? agents.find(a => a.id === r.agent_id)?.name : 'Default Model',
        });
      });

      // Map Loops
      loops.forEach(l => {
        let freq: Frequency = 'continuous';
        if (l.schedule_type === 'interval') freq = 'continuous';
        else if (l.schedule_type === 'cron') freq = 'daily';

        unified.push({
          id: l.id,
          type: 'loop',
          name: l.name,
          description: l.description || '',
          prompt: l.description || '',
          status: l.status,
          frequency: freq,
          schedule_expression: l.schedule_expression,
          isActive: l.status === 'active',
          createdAt: l.created_at || new Date().toISOString(),
          updatedAt: l.updated_at || new Date().toISOString(),
          goalId: l.goal_id,
          agentId: l.agent_id,
          executorName: l.agent_id ? agents.find(a => a.id === l.agent_id)?.name : 'Default Model',
        });
      });

      // Map Heartbeats
      heartbeats.forEach(hb => {
        let freq: Frequency = 'manual';
        if (hb.schedule === '0 * * * *') freq = 'hourly';
        else if (hb.schedule === '0 9 * * *') freq = 'daily';
        else if (hb.schedule === '0 9 * * 1-5') freq = 'weekdays';
        else if (hb.schedule === '0 9 * * 1') freq = 'weekly';

        unified.push({
          id: hb.id || '',
          type: 'heartbeat',
          name: hb.name,
          description: hb.description || '',
          prompt: hb.prompt || '',
          status: hb.enabled ? 'active' : 'paused',
          frequency: freq,
          schedule_expression: hb.schedule,
          isActive: hb.enabled,
          createdAt: hb.createdAt || new Date().toISOString(),
          updatedAt: hb.updatedAt || new Date().toISOString(),
          agentId: hb.parameters?.agentId as string,
          executorName: hb.parameters?.agentId ? agents.find(a => a.id === (hb.parameters?.agentId as string))?.name : 'Default Model',
          folder: hb.parameters?.folder as string,
        });
      });

      setTasks(unified);
    } catch (e) {
      console.error(e);
      setError('Failed to load automation tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Bot-scoped filter
    if (agentId) {
      result = result.filter((t) => t.agentId === agentId);
    }

    // Tab filter
    if (activeTab !== 'all') {
      result = result.filter(t => t.type === activeTab);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'type') {
        return a.type.localeCompare(b.type);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [tasks, activeTab, searchQuery, sortBy, agentId]);

  const handleCreateTask = async (data: Omit<UnifiedTask, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isActive'> & {
    addRoutine?: boolean;
    routineName?: string;
    routinePrompt?: string;
    routineFrequency?: Frequency;
    routineScheduleExpression?: string;
    addLoop?: boolean;
    loopName?: string;
    loopPrompt?: string;
    loopFrequency?: Frequency;
    loopScheduleExpression?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      if (data.type === 'goal') {
        const goal = await createGoal({
          title: data.name,
          description: data.description || undefined,
          priority: (data.priority as any) || 'medium',
          target_date: data.targetDate || undefined,
          agent_id: data.agentId || undefined,
        });

        const goalId = goal.id;

        // Package creation: Routine
        if (data.addRoutine && data.routineName && data.routinePrompt) {
          let schedule_type: any = 'cron';
          let schedule_expression = data.routineScheduleExpression || '0 9 * * *';
          if (data.routineFrequency === 'manual') {
            schedule_type = 'manual';
            schedule_expression = '';
          }

          await createRoutine({
            name: data.routineName,
            description: `Scheduled routine supporting goal: ${data.name}`,
            schedule_type,
            schedule_expression,
            goal_id: goalId,
            agent_id: data.agentId || undefined,
            execution_domain: 'local',
            config: {},
          });
        }

        // Package creation: Loop
        if (data.addLoop && data.loopName && data.loopPrompt) {
          await createLoop({
            name: data.loopName,
            description: `Monitoring loop supporting goal: ${data.name}`,
            schedule_type: data.loopFrequency === 'continuous' ? 'interval' : 'cron',
            schedule_expression: data.loopScheduleExpression || '5m',
            goal_id: goalId,
            agent_id: data.agentId || undefined,
            execution_domain: 'local',
            config: {},
          });
        }

      } else if (data.type === 'routine') {
        let schedule_type: any = 'cron';
        let schedule_expression = data.schedule_expression || '0 9 * * *';
        if (data.frequency === 'manual') {
          schedule_type = 'manual';
          schedule_expression = '';
        }

        await createRoutine({
          name: data.name,
          description: data.description || undefined,
          schedule_type,
          schedule_expression,
          goal_id: data.goalId || undefined,
          agent_id: data.agentId || undefined,
          execution_domain: 'local',
          config: {},
        });
      } else if (data.type === 'loop') {
        await createLoop({
          name: data.name,
          description: data.description || undefined,
          schedule_type: data.frequency === 'continuous' ? 'interval' : 'cron',
          schedule_expression: data.schedule_expression || '5m',
          goal_id: data.goalId || undefined,
          agent_id: data.agentId || undefined,
          execution_domain: 'local',
          config: {},
        });
      } else if (data.type === 'heartbeat') {
        await createScheduledJob({
          name: data.name,
          description: data.description,
          schedule: data.schedule_expression || '0 9 * * *',
          prompt: data.prompt,
          taskType: data.agentId ? 'agent-task' : 'custom-task',
          parameters: {
            folder: data.folder || '/workspace',
            agentId: data.agentId,
            mode: data.agentId ? 'agent' : 'task',
          },
          enabled: true,
          maxRetries: 3,
          timeout: 300,
          notifyOnSuccess: false,
          notifyOnFailure: true,
        });
      }

      setShowCreateForm(false);
      setPrefilledData(null);
      await loadAllTasks();
    } catch (e) {
      console.error(e);
      setError('Failed to create automation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Omit<UnifiedTask, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      if (updates.type === 'goal') {
        await updateGoal(taskId, {
          title: updates.name,
          description: updates.description || undefined,
          priority: (updates.priority as any) || 'medium',
          target_date: updates.targetDate || undefined,
        });
      } else if (updates.type === 'routine') {
        await updateRoutine(taskId, {
          name: updates.name,
          description: updates.description || undefined,
          schedule_expression: updates.schedule_expression,
          goal_id: updates.goalId || undefined,
          agent_id: updates.agentId || undefined,
        });
      } else if (updates.type === 'loop') {
        await updateLoop(taskId, {
          name: updates.name,
          description: updates.description || undefined,
          schedule_expression: updates.schedule_expression,
          goal_id: updates.goalId || undefined,
          agent_id: updates.agentId || undefined,
        });
      } else if (updates.type === 'heartbeat') {
        await updateScheduledJob(taskId, {
          name: updates.name,
          description: updates.description,
          schedule: updates.schedule_expression || '0 9 * * *',
          prompt: updates.prompt,
          parameters: {
            folder: updates.folder || '/workspace',
            agentId: updates.agentId,
            mode: updates.agentId ? 'agent' : 'task',
          },
        });
      }

      setShowEditForm(false);
      setEditingTask(null);
      setSelectedTask(null);
      await loadAllTasks();
    } catch (e) {
      console.error(e);
      setError('Failed to update automation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (task: UnifiedTask) => {
    setIsLoading(true);
    setError(null);
    try {
      if (task.type === 'goal') {
        await deleteGoal(task.id);
      } else if (task.type === 'routine') {
        await deleteRoutine(task.id);
      } else if (task.type === 'loop') {
        await deleteLoop(task.id);
      } else if (task.type === 'heartbeat') {
        await deleteScheduledJob(task.id);
      }

      setSelectedTask(null);
      await loadAllTasks();
    } catch (e) {
      console.error(e);
      setError('Failed to delete automation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunNow = async (task: UnifiedTask) => {
    setRunningTaskId(task.id);
    setError(null);
    try {
      if (task.type === 'routine') {
        await runRoutine(task.id);
      } else if (task.type === 'loop') {
        await runLoop(task.id);
      } else if (task.type === 'heartbeat') {
        await runScheduledJobNow(task.id);
      }
      await loadAllTasks();
    } catch (e) {
      console.error(e);
      setError(`Failed to trigger task: ${task.name}`);
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleToggleActive = async (task: UnifiedTask, checked: boolean) => {
    setError(null);
    try {
      if (task.type === 'goal') {
        await updateGoal(task.id, { status: checked ? 'active' : 'paused' });
      } else if (task.type === 'routine') {
        await updateRoutine(task.id, { status: checked ? 'active' : 'paused' });
      } else if (task.type === 'loop') {
        await updateLoop(task.id, { status: checked ? 'active' : 'paused' });
      } else if (task.type === 'heartbeat') {
        await updateScheduledJob(task.id, { enabled: checked });
      }
      await loadAllTasks();
    } catch (e) {
      console.error(e);
      setError(`Failed to update status for ${task.name}`);
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    setPrefilledData({
      type: suggestion.type,
      name: suggestion.name,
      description: suggestion.description,
      prompt: suggestion.prompt,
      frequency: suggestion.frequency,
      schedule_expression: suggestion.schedule_expression,
    });
    setShowCreateForm(true);
  };

  return (
    <div className={cn(
      "w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)]",
      embedded ? "" : "h-full overflow-auto"
    )}>
      <div className={cn(
        "w-full max-w-6xl mx-auto px-8 flex flex-col",
        embedded ? "pt-0 pb-0" : "pt-10 pb-12 h-full"
      )}>

        {!hideTitle && (
          <div className="mb-6">
            <h1
              className="text-3xl font-medium tracking-tight m-0"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {title || 'Automation Tasks'}
            </h1>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
              {agentId
                ? 'Workflows, schedules, and loops for this bot'
                : 'Manage workflows, persistent schedules, and continuous execution loops'}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Filter / Tabs Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors cursor-pointer"
                >
                  Type: <span className="font-medium text-[var(--text-primary)]">{activeTab === 'all' ? 'All' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s</span>
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setActiveTab('all')} className={cn(activeTab === 'all' && 'font-medium')}>All</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab('goal')} className={cn(activeTab === 'goal' && 'font-medium')}>Goals</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab('routine')} className={cn(activeTab === 'routine' && 'font-medium')}>Routines</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab('loop')} className={cn(activeTab === 'loop' && 'font-medium')}>Loops</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab('heartbeat')} className={cn(activeTab === 'heartbeat' && 'font-medium')}>Agent Heartbeats</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors cursor-pointer"
                >
                  Sort: <span className="font-medium text-[var(--text-primary)]">{sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}</span>
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSortBy('date')} className={cn(sortBy === 'date' && 'font-medium')}>Date</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy('name')} className={cn(sortBy === 'name' && 'font-medium')}>Name</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy('type')} className={cn(sortBy === 'type' && 'font-medium')}>Type</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* New Task dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--bg-elevated)] text-sm font-medium hover:opacity-90 transition-all cursor-pointer"
              >
                New task
                <CaretDown size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { setPrefilledData(null); setShowCreateForm(true); }}>
                <Plus size={16} className="mr-2" />
                Set up manually
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                const ev = new CustomEvent('allternit:switch-mode', { detail: { mode: 'chat', text: '/schedule ' } });
                window.dispatchEvent(ev);
              }}>
                <Robot size={16} className="mr-2" />
                Create with Assistant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-2 mt-6 border-b border-[var(--border-subtle)] pb-2 flex-wrap">
          <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} icon={CalendarCheck}>All</TabButton>
          <TabButton active={activeTab === 'goal'} onClick={() => setActiveTab('goal')} icon={Target}>Goals</TabButton>
          <TabButton active={activeTab === 'routine'} onClick={() => setActiveTab('routine')} icon={Clock}>Routines</TabButton>
          <TabButton active={activeTab === 'loop'} onClick={() => setActiveTab('loop')} icon={Repeat}>Loops</TabButton>
          <TabButton active={activeTab === 'heartbeat'} onClick={() => setActiveTab('heartbeat')} icon={Robot}>Agent Heartbeats</TabButton>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <MagnifyingGlass
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search automation tasks…"
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-solid border-[var(--border-default)] text-[15px] outline-none transition-colors focus:border-[var(--text-primary)]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Info Banner */}
        <div className="mt-6 p-4 rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] flex flex-wrap items-center justify-between gap-3 text-[var(--text-secondary)] text-[13px]">
          <div className="flex items-center gap-2">
            <CalendarCheck size={16} className="text-[var(--accent-primary)]" />
            <span>Automation tasks only run while your computer is awake and online.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--text-tertiary)]">Keep awake</span>
            <ToggleSwitch checked={keepAwake} onChange={setKeepAwake} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 p-3 px-6 bg-[var(--status-error-bg)] border border-solid border-[var(--status-error)]/30 rounded-xl flex items-center gap-2 text-[var(--status-error)] text-[13px]">
            <Warning size={16} /> {error}
            <button type="button" onClick={() => setError(null)} className="ml-auto bg-transparent border-none text-[var(--status-error)] cursor-pointer text-[12px] hover:opacity-80">Dismiss</button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="mt-8 flex-1">
          {activeTab === 'heartbeat' && selectedHeartbeatAgent ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4 p-[12px_16px] bg-[var(--bg-elevated)] rounded-xl border border-solid border-[var(--border-default)]">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-[10px] bg-[linear-gradient(135deg,rgba(167,139,250,0.2)_0%,rgba(167,139,250,0.1)_100%)] flex items-center justify-center"><Robot size={18} className="text-[#a78bfa]" /></div>
                  <div><div className="text-[14px] font-semibold text-[var(--text-primary)]">{agents.find(a => a.id === selectedHeartbeatAgent)?.name || 'Unknown Agent'}</div><div className="text-[12px] text-[var(--text-tertiary)]">Managing heartbeat tasks</div></div>
                </div>
                <button type="button" onClick={() => setSelectedHeartbeatAgent(null)} className="p-[8px_16px] rounded-lg border border-solid border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] text-[13px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-white/5 transition-colors"><X size={16} /> Change Agent</button>
              </div>
              <div className="flex-1 overflow-auto bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-2xl p-4">
                <HeartbeatScheduler agentId={selectedHeartbeatAgent} onClose={() => setSelectedHeartbeatAgent(null)} theme={{ bg: 'transparent', bgCard: 'var(--bg-elevated)', textPrimary: 'var(--text-primary)', textSecondary: 'var(--text-secondary)', textMuted: 'var(--text-tertiary)', accent: 'var(--text-primary)', borderSubtle: 'var(--border-subtle)' }} />
              </div>
            </div>
          ) : activeTab === 'heartbeat' && !selectedHeartbeatAgent ? (
            <div>
              <div className="mb-5 p-[16px_20px] bg-[var(--bg-elevated)] rounded-xl border border-solid border-[var(--border-default)]">
                <h3 className="m-0 mb-2 text-base font-semibold text-[var(--text-primary)] flex items-center gap-2"><Clock size={18} /> Agent Heartbeat Tasks</h3>
                <p className="m-0 text-[13px] text-[var(--text-secondary)] leading-relaxed">Configure periodic tasks that agents execute automatically. Heartbeat tasks are stored in each agent's workspace and synced with the scheduler.</p>
              </div>
              {agents.length === 0 ? (
                <EmptyState icon={Robot} title="No agents available" description="Create an agent first to configure heartbeat tasks." />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                  {agents.map(agent => (
                    <div role="button" tabIndex={0} key={agent.id} onClick={() => setSelectedHeartbeatAgent(agent.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedHeartbeatAgent(agent.id); }} className="p-5 bg-[var(--bg-elevated)] rounded-xl border border-solid border-[var(--border-default)] cursor-pointer transition-all hover:border-[var(--border-hover)]">
                      <div className="flex items-start gap-4">
                        <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 bg-[var(--border-subtle)]")}><Robot size={22} className="text-[var(--text-secondary)]" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1"><span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{agent.name}</span><span className={cn("size-2 rounded-full", agent.status === 'running' ? "bg-[var(--status-success)]" : "bg-[var(--text-tertiary)]")} /></div>
                          <p className="m-0 mb-3 text-[13px] text-[var(--text-tertiary)] leading-normal line-clamp-2">{agent.description || 'No description'}</p>
                          <div className="flex items-center gap-3"><span className="text-[12px] text-[var(--text-secondary)] px-2.5 py-1 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-md">{agent.type}</span><span className="text-[12px] text-[var(--text-primary)] flex items-center gap-1"><Clock size={12} /> Configure Heartbeats</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : filteredTasks.length > 0 ? (
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={`${task.type}-${task.id}`}
                    task={task}
                    isRunning={runningTaskId === task.id}
                    onClick={() => setSelectedTask(task)}
                    onRunNow={() => handleRunNow(task)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-20 flex flex-col justify-center items-center">
              <EmptyState
                icon={Clock}
                title="No automation tasks yet"
                description="Click 'New task' above to configure your first Goal, Routine, or Loop."
              />
            </div>
          )}
        </div>

      </div>

      {/* Forms & Overlays */}
      {showCreateForm && (
        <AutomationWizardForm
          mode="create"
          goals={goalsList}
          routines={routinesList}
          agents={agents}
          prefilledData={prefilledData}
          agentId={agentId}
          hideAgentSelector={hideAgentSelector}
          onClose={() => { setShowCreateForm(false); setPrefilledData(null); }}
          onSave={(taskId, data) => handleCreateTask(data)}
        />
      )}

      {showEditForm && editingTask && (
        <AutomationWizardForm
          mode="edit"
          goals={goalsList}
          routines={routinesList}
          agents={agents}
          initialTask={editingTask}
          agentId={agentId}
          hideAgentSelector={hideAgentSelector}
          onClose={() => { setShowEditForm(false); setEditingTask(null); }}
          onSave={handleUpdateTask}
        />
      )}

      {selectedTask && (
        <TaskDetailOverlay
          task={selectedTask}
          isRunning={runningTaskId === selectedTask.id}
          agents={agents}
          goals={goalsList}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => handleToggleActive(selectedTask, updates.isActive ?? true)}
          onDelete={() => handleDeleteTask(selectedTask)}
          onRunNow={() => handleRunNow(selectedTask)}
          onEdit={() => { setEditingTask(selectedTask); setShowEditForm(true); }}
        />
      )}
    </div>
  );
}

// Subcomponents
function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg border-none flex items-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
        active
          ? "bg-[var(--text-primary)] text-[var(--bg-elevated)] shadow-sm font-bold"
          : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]/10"
      )}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

function TaskCard({ task, onClick, onRunNow, isRunning }: { task: UnifiedTask; onClick: () => void; onRunNow: () => void; isRunning: boolean }) {
  const getIcon = () => {
    switch (task.type) {
      case 'goal': return Target;
      case 'routine': return Clock;
      case 'loop': return Repeat;
      default: return Robot;
    }
  };

  const getTypeLabel = () => {
    switch (task.type) {
      case 'goal': return 'Goal';
      case 'routine': return 'Routine';
      case 'loop': return 'Loop';
      default: return 'Heartbeat';
    }
  };

  const getTypeStyle = () => {
    switch (task.type) {
      case 'goal': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'routine': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'loop': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    }
  };

  const Icon = getIcon();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="p-6 bg-[var(--bg-elevated)] rounded-xl border border-solid border-[var(--border-default)] cursor-pointer flex flex-col justify-between hover:border-[var(--border-hover)] transition-all group min-h-[160px]"
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-solid", getTypeStyle())}>
              {getTypeLabel()}
            </span>
            {task.type !== 'goal' && (
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {task.frequency}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-semibold", task.isActive ? "bg-emerald-500/10 text-emerald-600 border border-solid border-emerald-500/20" : "bg-zinc-500/10 text-[var(--text-tertiary)]")}>
              {task.isActive ? 'Active' : 'Paused'}
            </span>
            {task.type !== 'goal' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRunNow(); }}
                disabled={isRunning}
                className="size-7 rounded-lg border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--border-hover)] transition-all cursor-pointer"
                title="Run Now"
              >
                {isRunning ? <CircleNotch size={14} className="animate-spin" /> : <Play size={14} />}
              </button>
            )}
          </div>
        </div>

        <h3 className="m-0 mb-1.5 text-[15px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--text-secondary)] transition-colors">
          {task.name}
        </h3>
        <p className="m-0 text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
          {task.description || 'No description provided.'}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-solid border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1">
          {task.type === 'goal' ? (
            <><Target size={12} /> Progress: {task.progress || 0}%</>
          ) : (
            <><Sparkle size={12} /> {task.executorName || 'Default Model'}</>
          )}
        </span>
        <span>
          {task.type === 'goal' && task.targetDate ? (
            `Target: ${new Date(task.targetDate).toLocaleDateString()}`
          ) : (
            task.schedule_expression || 'Manual'
          )}
        </span>
      </div>
    </div>
  );
}



// Wizard Form for Creating/Editing (Goal, Routine, Loop, Heartbeat combined)
function AutomationWizardForm({
  mode,
  goals,
  routines,
  agents,
  prefilledData,
  initialTask,
  agentId,
  hideAgentSelector,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  goals: any[];
  routines: any[];
  agents: any[];
  prefilledData?: any;
  initialTask?: UnifiedTask;
  agentId?: string;
  hideAgentSelector?: boolean;
  onClose: () => void;
  onSave: (taskId: string, data: any) => void;
}) {
  const [formData, setFormData] = useState({
    type: initialTask?.type || prefilledData?.type || 'routine' as TaskType,
    name: initialTask?.name || prefilledData?.name || '',
    description: initialTask?.description || prefilledData?.description || '',
    prompt: initialTask?.prompt || prefilledData?.prompt || '',
    frequency: initialTask?.frequency || prefilledData?.frequency || 'daily' as Frequency,
    schedule_expression: initialTask?.schedule_expression || prefilledData?.schedule_expression || '0 9 * * *',
    selectedDays: parseCronDays(initialTask?.schedule_expression || prefilledData?.schedule_expression || '0 9 * * *'),
    goalId: initialTask?.goalId || '',
    routineId: initialTask?.routineId || '',
    agentId: initialTask?.agentId || agentId || '',
    priority: initialTask?.priority || 'medium',
    targetDate: initialTask?.targetDate || '',
    folder: initialTask?.folder || '',
    executorType: (initialTask?.agentId || agentId ? 'agent' : 'model') as 'model' | 'agent',
    modelSelection: null as ModelSelection | null,

    // Packaging optional fields
    addRoutine: false,
    routineName: '',
    routinePrompt: '',
    routineFrequency: 'daily' as Frequency,
    routineScheduleExpression: '0 9 * * *',
    addLoop: false,
    loopName: '',
    loopPrompt: '',
    loopFrequency: 'continuous' as Frequency,
    loopScheduleExpression: '5m',
  });

  const [showModelPicker, setShowModelPicker] = useState(false);

  const isValid = formData.name.trim() && formData.description.trim() &&
    (formData.type === 'goal' ? true : formData.prompt.trim() && (formData.executorType === 'model' ? true : formData.agentId));

  const handleSave = () => {
    if (!isValid) return;
    onSave(initialTask?.id || '', {
      ...formData,
      schedule_expression: formData.type === 'loop' && formData.frequency === 'continuous' ? formData.schedule_expression || '5m' : formData.schedule_expression,
    });
  };

  const handleFrequencyChange = (freq: Frequency) => {
    let expr = '0 9 * * *';
    let days: number[] = [0, 1, 2, 3, 4, 5, 6];
    if (freq === 'hourly') {
      expr = '0 * * * *';
    } else if (freq === 'daily') {
      expr = '0 9 * * *';
    } else if (freq === 'weekdays') {
      expr = '0 9 * * 1-5';
      days = [1, 2, 3, 4, 5];
    } else if (freq === 'weekly') {
      expr = '0 9 * * 1';
      days = [1];
    } else if (freq === 'continuous') {
      expr = '5m';
      days = [];
    } else if (freq === 'manual') {
      expr = '';
      days = [];
    }

    setFormData({ ...formData, frequency: freq, schedule_expression: expr, selectedDays: days });
  };

  return (
    <OverlayContainer onClose={onClose}>
      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-solid border-[var(--border-default)] w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-[var(--text-primary)]">
        {/* Title */}
        <div className="p-5 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="m-0 text-lg font-medium text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-serif)' }}>
            {mode === 'create' ? 'Create Automation' : 'Edit Automation'}
          </h2>
          <button type="button" onClick={onClose} className="size-8 rounded-lg border-none bg-transparent text-[var(--text-secondary)] cursor-pointer flex items-center justify-center hover:bg-white/5"><X size={20} /></button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Type Select (Disabled in Edit Mode) */}
          <FormField label="Task Type" required>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={mode === 'edit'}
                onClick={() => setFormData({ ...formData, type: 'goal', frequency: 'manual' })}
                className={cn(
                  "flex-1 py-2 rounded-lg border border-solid flex items-center justify-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
                  formData.type === 'goal'
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] font-bold"
                    : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-50"
                )}
              >
                <Target size={16} /> Goal
              </button>
              <button
                type="button"
                disabled={mode === 'edit'}
                onClick={() => setFormData({ ...formData, type: 'routine', frequency: 'daily' })}
                className={cn(
                  "flex-1 py-2 rounded-lg border border-solid flex items-center justify-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
                  formData.type === 'routine'
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] font-bold"
                    : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-50"
                )}
              >
                <Clock size={16} /> Routine
              </button>
              <button
                type="button"
                disabled={mode === 'edit'}
                onClick={() => setFormData({ ...formData, type: 'loop', frequency: 'continuous' })}
                className={cn(
                  "flex-1 py-2 rounded-lg border border-solid flex items-center justify-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
                  formData.type === 'loop'
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] font-bold"
                    : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-50"
                )}
              >
                <Repeat size={16} /> Loop
              </button>
              <button
                type="button"
                disabled={mode === 'edit'}
                onClick={() => setFormData({ ...formData, type: 'heartbeat', frequency: 'daily', executorType: 'agent' })}
                className={cn(
                  "flex-1 py-2 rounded-lg border border-solid flex items-center justify-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
                  formData.type === 'heartbeat'
                    ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] font-bold"
                    : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-50"
                )}
              >
                <Robot size={16} /> Heartbeat
              </button>
            </div>
          </FormField>

          {/* Name */}
          <FormField label="Name *" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={formData.type === 'goal' ? "Objective name" : "Task name"}
              className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--text-primary)]"
            />
          </FormField>

          {/* Description */}
          <FormField label="Description *" required>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide a brief summary of the task..."
              className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--text-primary)]"
            />
          </FormField>

          {/* Prompt / Instructions (Not for Goal) */}
          {formData.type !== 'goal' && (
            <FormField label="Instructions / Prompt *" required>
              <textarea
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="What instructions should the executor run? (e.g. Triage support tickets...)"
                rows={4}
                className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none resize-none focus:border-[var(--text-primary)]"
              />
            </FormField>
          )}

          {/* Goal Association (Routines & Loops only) */}
          {formData.type !== 'goal' && (
            <FormField label="Associated Goal (Workflow)">
              <div className="relative">
                <select
                  value={formData.goalId}
                  onChange={(e) => setFormData({ ...formData, goalId: e.target.value })}
                  className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[14px] outline-none appearance-none focus:border-[var(--text-primary)]"
                >
                  <option value="">No goal selected</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]" />
              </div>
            </FormField>
          )}

          {/* Routine Association (Loops only) */}
          {formData.type === 'loop' && (
            <FormField label="Associated Routine (Schedule)">
              <div className="relative">
                <select
                  value={formData.routineId}
                  onChange={(e) => setFormData({ ...formData, routineId: e.target.value })}
                  className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[14px] outline-none appearance-none focus:border-[var(--text-primary)]"
                >
                  <option value="">No routine selected</option>
                  {routines.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]" />
              </div>
            </FormField>
          )}

          {/* Goal Fields & Packaging */}
          {formData.type === 'goal' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Priority">
                  <div className="relative">
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[14px] outline-none appearance-none focus:border-[var(--text-primary)]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]" />
                  </div>
                </FormField>
                <FormField label="Target Date">
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--text-primary)]"
                  />
                </FormField>
              </div>

              {/* Packaging Section */}
              <div className="pt-4 mt-2 border-t border-solid border-[var(--border-subtle)] space-y-4">
                <h3 className="m-0 text-sm font-semibold text-[var(--text-secondary)]">Package Tasks (Optional)</h3>
                
                {/* Add Scheduled Routine */}
                <div className="p-4 rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] font-semibold text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={formData.addRoutine}
                      onChange={(e) => setFormData({ ...formData, addRoutine: e.target.checked, routineName: e.target.checked ? `${formData.name} Sync` : '' })}
                      className="size-4 accent-[var(--text-primary)]"
                    />
                    Schedule a Routine for this Goal
                  </label>
                  
                  {formData.addRoutine && (
                    <div className="space-y-3 pt-2 pl-4 border-l border-solid border-[var(--border-subtle)]">
                      <FormField label="Routine Name *" required>
                        <input
                          type="text"
                          value={formData.routineName}
                          onChange={(e) => setFormData({ ...formData, routineName: e.target.value })}
                          placeholder="Daily sync, weekly review..."
                          className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                        />
                      </FormField>
                      <FormField label="Routine Instructions *" required>
                        <textarea
                          value={formData.routinePrompt}
                          onChange={(e) => setFormData({ ...formData, routinePrompt: e.target.value })}
                          placeholder="What should run on this schedule?"
                          rows={2}
                          className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none resize-none"
                        />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Frequency">
                          <select
                            value={formData.routineFrequency}
                            onChange={(e) => {
                              const freq = e.target.value as Frequency;
                              let expr = '0 9 * * *';
                              if (freq === 'hourly') expr = '0 * * * *';
                              else if (freq === 'daily') expr = '0 9 * * *';
                              else if (freq === 'weekdays') expr = '0 9 * * 1-5';
                              else if (freq === 'weekly') expr = '0 9 * * 1';
                              setFormData({ ...formData, routineFrequency: freq, routineScheduleExpression: expr });
                            }}
                            className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </FormField>
                        <FormField label="Expression">
                          <input
                            type="text"
                            value={formData.routineScheduleExpression}
                            onChange={(e) => setFormData({ ...formData, routineScheduleExpression: e.target.value })}
                            className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                          />
                        </FormField>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Monitoring Loop */}
                <div className="p-4 rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] font-semibold text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={formData.addLoop}
                      onChange={(e) => setFormData({ ...formData, addLoop: e.target.checked, loopName: e.target.checked ? `${formData.name} Monitor` : '' })}
                      className="size-4 accent-[var(--text-primary)]"
                    />
                    Run a Monitoring Loop for this Goal
                  </label>
                  
                  {formData.addLoop && (
                    <div className="space-y-3 pt-2 pl-4 border-l border-solid border-[var(--border-subtle)]">
                      <FormField label="Loop Name *" required>
                        <input
                          type="text"
                          value={formData.loopName}
                          onChange={(e) => setFormData({ ...formData, loopName: e.target.value })}
                          placeholder="Topic check, price alert..."
                          className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                        />
                      </FormField>
                      <FormField label="Loop Instructions *" required>
                        <textarea
                          value={formData.loopPrompt}
                          onChange={(e) => setFormData({ ...formData, loopPrompt: e.target.value })}
                          placeholder="What should be monitored continuously?"
                          rows={2}
                          className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none resize-none"
                        />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Frequency">
                          <select
                            value={formData.loopFrequency}
                            onChange={(e) => {
                              const freq = e.target.value as Frequency;
                              let expr = '5m';
                              if (freq === 'continuous') expr = '5m';
                              setFormData({ ...formData, loopFrequency: freq, loopScheduleExpression: expr });
                            }}
                            className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                          >
                            <option value="continuous">Continuous</option>
                          </select>
                        </FormField>
                        <FormField label="Delay Interval">
                          <input
                            type="text"
                            value={formData.loopScheduleExpression}
                            onChange={(e) => setFormData({ ...formData, loopScheduleExpression: e.target.value })}
                            placeholder="5m"
                            className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                          />
                        </FormField>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Frequency & Schedule (Routine & Loop only) */}
          {formData.type !== 'goal' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Frequency">
                <div className="relative">
                  <select
                    value={formData.frequency}
                    onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
                    className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[14px] outline-none appearance-none focus:border-[var(--text-primary)]"
                  >
                    {formData.type === 'loop' ? (
                      <option value="continuous">Continuous</option>
                    ) : (
                      <>
                        <option value="manual">Manual</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="weekly">Weekly</option>
                      </>
                    )}
                  </select>
                  <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]" />
                </div>
              </FormField>
              <FormField label={formData.frequency === 'continuous' ? "Delay Interval" : "Schedule Expression"}>
                <input
                  type="text"
                  value={formData.schedule_expression}
                  onChange={(e) => setFormData({ ...formData, schedule_expression: e.target.value, selectedDays: parseCronDays(e.target.value) })}
                  placeholder={formData.frequency === 'continuous' ? "5m" : "0 9 * * *"}
                  className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--text-primary)]"
                />
              </FormField>
            </div>
          )}

          {/* Day-of-week selector (supplements cron for scheduled frequencies) */}
          {formData.type !== 'goal' &&
            formData.frequency !== 'manual' &&
            formData.frequency !== 'continuous' && (
            <FormField label="Days of week">
              <DayOfWeekSelector
                value={formData.selectedDays}
                onChange={(days) =>
                  setFormData({
                    ...formData,
                    selectedDays: days,
                    schedule_expression: applyCronDays(formData.schedule_expression, days),
                  })
                }
              />
            </FormField>
          )}

          {/* Executor / Agent Allocation (Not for Goal) */}
          {formData.type !== 'goal' && !hideAgentSelector && (
            <div className="space-y-3 pt-4 border-t border-solid border-[var(--border-subtle)]">
              <FormField label="Executor Selection">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, executorType: 'model', agentId: agentId || '' })}
                    className={cn(
                      "flex-1 py-2 rounded-lg border border-solid flex items-center justify-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
                      formData.executorType === 'model'
                        ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] font-bold"
                        : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-white/5"
                    )}
                  >
                    <Sparkle size={16} /> Default Model
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, executorType: 'agent', modelSelection: null })}
                    className={cn(
                      "flex-1 py-2 rounded-lg border border-solid flex items-center justify-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-all",
                      formData.executorType === 'agent'
                        ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-elevated)] font-bold"
                        : "border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-white/5"
                    )}
                  >
                    <Robot size={16} /> Assign to Agent
                  </button>
                </div>
              </FormField>

              {formData.executorType === 'model' && (
                <FormField label="Model">
                  <button
                    type="button"
                    onClick={() => setShowModelPicker(true)}
                    className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] cursor-pointer flex items-center justify-between text-left"
                  >
                    <span className="flex items-center gap-2">
                      {formData.modelSelection ? (
                        <>
                          <Sparkle size={16} className="text-[var(--text-primary)]" />
                          {formData.modelSelection.modelName || formData.modelSelection.modelId}
                        </>
                      ) : (
                        'Select model…'
                      )}
                    </span>
                    <CaretDown size={16} />
                  </button>
                </FormField>
              )}

              {formData.executorType === 'agent' && (
                <FormField label="Agent">
                  <div className="relative">
                    <select
                      value={formData.agentId}
                      onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                      className="w-full p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[14px] outline-none appearance-none focus:border-[var(--text-primary)]"
                    >
                      <option value="">Select agent...</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]" />
                  </div>
                </FormField>
              )}

              {/* Working Folder */}
              <FormField label="Working Folder">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.folder}
                    onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                    placeholder="/workspace"
                    className="flex-1 p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-[14px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, folder: '/workspace/tasks' })}
                    className="p-2.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-lg text-[var(--text-primary)] cursor-pointer flex items-center gap-2 hover:bg-white/5 transition-colors"
                  >
                    <FolderOpen size={18} /> Browse
                  </button>
                </div>
              </FormField>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-solid border-[var(--border-subtle)] flex gap-3 justify-end bg-[var(--bg-elevated)]">
          <button type="button" onClick={onClose} className="p-2.5 px-5 rounded-lg border border-solid border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] text-[14px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className={cn(
              "p-2.5 px-6 rounded-lg border-none text-[14px] font-semibold transition-all",
              isValid
                ? "bg-[var(--text-primary)] text-[var(--bg-elevated)] cursor-pointer hover:opacity-95 font-medium"
                : "bg-[var(--border-subtle)] text-[var(--text-tertiary)] cursor-not-allowed"
            )}
          >
            {mode === 'create' ? 'Save' : 'Update'}
          </button>
        </div>
      </div>

      {showModelPicker && (
        <ModelSelectionProvider>
          <ModelPicker
            open={showModelPicker}
            onOpenChange={setShowModelPicker}
            onSelect={(sel) => { setFormData({ ...formData, modelSelection: sel }); setShowModelPicker(false); }}
            onCancel={() => setShowModelPicker(false)}
          />
        </ModelSelectionProvider>
      )}
    </OverlayContainer>
  );
}

// Overlay Container and helper panels
function OverlayContainer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div role="presentation" className="fixed inset-0 bg-black/30 backdrop-blur-md z-[9998]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90%] max-w-[560px]" role="presentation">{children}</div>
    </>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn("text-[11px] font-bold uppercase tracking-wider", required ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]")}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-10 h-5.5 rounded-full border-none cursor-pointer relative transition-colors duration-200",
        checked ? "bg-emerald-500/20" : "bg-zinc-500/20"
      )}
    >
      <div className={cn("size-4 rounded-full absolute top-0.75 transition-all duration-200", checked ? "left-5.25 bg-emerald-600" : "left-0.75 bg-[var(--text-tertiary)]")} />
    </button>
  );
}

// Details Overlay
function TaskDetailOverlay({
  task,
  isRunning,
  agents,
  goals,
  onClose,
  onUpdate,
  onDelete,
  onRunNow,
  onEdit,
}: {
  task: UnifiedTask;
  isRunning: boolean;
  agents: any[];
  goals: any[];
  onClose: () => void;
  onUpdate: (updates: Partial<UnifiedTask>) => void;
  onDelete: () => void;
  onRunNow: () => void;
  onEdit: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getTypeName = () => {
    switch (task.type) {
      case 'goal': return 'Goal';
      case 'routine': return 'Routine';
      case 'loop': return 'Loop';
      default: return 'Heartbeat';
    }
  };

  const getExecutorName = () => {
    if (task.agentId) {
      return agents.find(a => a.id === task.agentId)?.name || task.agentId;
    }
    return task.executorName || 'Default Model';
  };

  return (
    <OverlayContainer onClose={onClose}>
      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-solid border-[var(--border-default)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl text-[var(--text-primary)]">
        {/* Header */}
        <div className="p-6 border-b border-solid border-[var(--border-subtle)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="m-0 mb-1.5 text-lg font-bold text-[var(--text-primary)]">{task.name}</h2>
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-[var(--text-primary)] font-semibold">{getTypeName()}</span>
                {task.type !== 'goal' && task.nextRun && <span>Next run: {new Date(task.nextRun).toLocaleString()}</span>}
              </div>
            </div>
            <button type="button" onClick={onClose} className="size-8 rounded-lg border-none bg-transparent text-[var(--text-secondary)] cursor-pointer flex items-center justify-center hover:bg-white/5"><X size={20} /></button>
          </div>

          <div className="flex gap-2">
            <ActionButton onClick={onEdit} icon={PencilSimple}>Edit</ActionButton>
            <ActionButton onClick={() => setShowDeleteConfirm(true)} icon={Trash} variant="danger">Delete</ActionButton>
            {task.type !== 'goal' && (
              <ActionButton onClick={onRunNow} icon={isRunning ? CircleNotch : Play} variant="primary" isLoading={isRunning}>
                {isRunning ? 'Running…' : 'Run Now'}
              </ActionButton>
            )}
          </div>
        </div>

        {/* Details list */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-3.5 bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-xl">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Status ({task.isActive ? 'Active' : 'Paused'})</span>
            <ToggleSwitch checked={task.isActive} onChange={(checked) => onUpdate({ isActive: checked })} />
          </div>

          <div className="space-y-4">
            <DetailItem label="Description" value={task.description || 'No description provided.'} />
            {task.type !== 'goal' && <DetailItem label="Instructions / Prompt" value={task.prompt} />}
            {task.type === 'goal' && <DetailItem label="Priority" value={task.priority || 'medium'} />}
            {task.type === 'goal' && task.targetDate && <DetailItem label="Target Date" value={new Date(task.targetDate).toLocaleDateString()} />}
            {task.type !== 'goal' && <DetailItem label="Executor" value={getExecutorName()} icon={task.agentId ? Robot : Sparkle} />}
            {task.type !== 'goal' && task.goalId && <DetailItem label="Parent Goal" value={goals.find(g => g.id === task.goalId)?.title || task.goalId} />}
            {task.type !== 'goal' && <DetailItem label="Frequency" value={task.frequency} />}
            {task.type !== 'goal' && task.schedule_expression && <DetailItem label="Expression" value={task.schedule_expression} />}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title={`Delete ${getTypeName()}?`}
          message={`Are you sure you want to delete "${task.name}"? This action cannot be undone.`}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => { onDelete(); setShowDeleteConfirm(false); }}
        />
      )}
    </OverlayContainer>
  );
}

function ActionButton({ onClick, icon: Icon, children, variant = 'default', isLoading = false }: { onClick: () => void; icon: React.ElementType; children: React.ReactNode; variant?: 'default' | 'danger' | 'primary'; isLoading?: boolean }) {
  const colors = {
    default: "border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]",
    danger: "bg-red-500/10 text-red-600 hover:opacity-95",
    primary: "bg-[var(--text-primary)] text-[var(--bg-elevated)] hover:opacity-90"
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "flex-1 py-2 rounded-lg border-none flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-all",
        isLoading ? "cursor-not-allowed bg-zinc-500/10 text-[var(--text-tertiary)]" : cn("cursor-pointer", colors[variant])
      )}
    >
      {isLoading ? <CircleNotch size={14} className="animate-spin" /> : <Icon size={14} />} {children}
    </button>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        <span>{value}</span>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="py-16 text-center text-[var(--text-tertiary)]">
      <Icon size={48} className="opacity-25 mx-auto mb-4" />
      <h3 className="text-base font-bold text-[var(--text-secondary)] m-0 mb-1">{title}</h3>
      <p className="text-[13px] m-0 max-w-[280px] mx-auto leading-relaxed">{description}</p>
    </div>
  );
}

function DeleteConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div role="presentation" className="fixed inset-0 bg-black/20 z-[10002]" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-elevated)] rounded-2xl border border-solid border-[var(--border-default)] p-6 min-w-[320px] z-[10003] shadow-2xl">
        <h3 className="m-0 mb-2 text-[15px] font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="m-0 mb-4 text-[13px] text-[var(--text-tertiary)] leading-relaxed">{message}</p>
        <div className="flex gap-2.5 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-solid border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] text-[12px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-lg border-none bg-red-600 text-white text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity">Delete</button>
        </div>
      </div>
    </>
  );
}

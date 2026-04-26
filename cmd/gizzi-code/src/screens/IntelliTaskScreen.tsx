import * as React from 'react';
const { useState, useEffect, useCallback, useMemo, useRef } = React;
import { Box, Text, useInput } from 'ink';
import { IntelliScheduleEngine } from '../scheduler/IntelliScheduleEngine';

interface TaskItem {
  id: string;
  title: string;
  priority: number;
  estimatedMinutes?: number;
  deadline?: number; // timestamp
  dependencies: string[];
  status?: string;
  assignee_type?: string;
  assignee_id?: string;
  assignee_name?: string;
}

interface CommentItem {
  id: string;
  author: string;
  body: string;
  created_at?: string;
}

function formatPriority(priority: number): string {
  if (priority >= 67) return '↑↑↑';
  if (priority >= 34) return '↑↑';
  return '↑';
}

function formatDeadline(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function riskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'high': return 'red';
    case 'medium': return 'yellow';
    case 'low': return 'green';
  }
}

function riskDot(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
}

const STATUS_CYCLE = ['backlog', 'todo', 'in-progress', 'in-review', 'done'];

function nextStatus(current?: string): string {
  if (!current) return 'todo';
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return 'todo';
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

interface IntelliTaskScreenProps {
  tasks: TaskItem[];
  comments?: Record<string, CommentItem[]>;
  onSelect?: (taskId: string) => void;
  onQuit?: () => void;
  onStatusChange?: (taskId: string, status: string) => void;
  onAssign?: (taskId: string) => void;
}

export function IntelliTaskScreen({ tasks, comments, onSelect, onQuit, onStatusChange, onAssign }: IntelliTaskScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>([]);
  const [scheduleMap, setScheduleMap] = useState<Map<string, { startTime: number; endTime: number; risk: 'low' | 'medium' | 'high' }>>(new Map());
  const [showHelp, setShowHelp] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [taskList, setTaskList] = useState<TaskItem[]>(tasks);
  const [activeStrategy, setActiveStrategy] = useState('greedy');
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [showWorkload, setShowWorkload] = useState(false);

  const engine = useMemo(() => new IntelliScheduleEngine(), []);
  const taskListRef = useRef(taskList);
  taskListRef.current = taskList;
  const editingRef = useRef(editingTaskId);
  editingRef.current = editingTaskId;

  const runOptimization = useCallback(() => {
    if (editingRef.current) return;
    const input = {
      tasks: taskListRef.current,
      constraints: {
        availableHoursPerDay: 8,
        startTime: Date.now(),
        bufferMinutes: 15,
      },
    };
    const result = engine.optimize(input);
    setOrderedTaskIds(result.orderedTasks);
    const map = new Map<string, { startTime: number; endTime: number; risk: 'low' | 'medium' | 'high' }>();
    for (const entry of result.schedule) {
      map.set(entry.taskId, entry);
    }
    setScheduleMap(map);
    setSelectedIndex(prev => {
      if (result.orderedTasks.length === 0) return 0;
      return Math.min(prev, result.orderedTasks.length - 1);
    });
  }, [engine]);

  useEffect(() => {
    runOptimization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingTaskId) {
      runOptimization();
    }
  }, [editingTaskId, runOptimization]);

  useInput((input, key) => {
    if (editingTaskId) {
      if (key.return) {
        const minutes = parseInt(editValue, 10);
        if (!isNaN(minutes) && minutes > 0) {
          setTaskList(prev => prev.map(t => t.id === editingTaskId ? { ...t, estimatedMinutes: minutes } : t));
        }
        setEditingTaskId(null);
        setEditValue('');
      } else if (key.escape) {
        setEditingTaskId(null);
        setEditValue('');
      } else if (key.delete || key.backspace) {
        setEditValue(prev => prev.slice(0, -1));
      } else if (/^\d$/.test(input)) {
        setEditValue(prev => prev + input);
      }
      return;
    }

    if (input === 'j' || key.downArrow) {
      setSelectedIndex(prev => {
        if (orderedTaskIds.length === 0) return 0;
        return Math.min(prev + 1, orderedTaskIds.length - 1);
      });
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (input === 'o') {
      runOptimization();
    } else if (input === 'g') {
      const strategies = ['greedy', 'balanced', 'priority-first', 'earliest-deadline', 'genetic', 'monte-carlo'];
      const idx = strategies.indexOf(activeStrategy);
      const next = strategies[(idx + 1) % strategies.length];
      setActiveStrategy(next);
    } else if (input === 't') {
      const taskId = orderedTaskIds[selectedIndex];
      if (taskId) {
        setTimers(prev => {
          if (prev[taskId]) {
            const elapsed = Math.round((Date.now() - prev[taskId]) / 60000);
            setTaskList(tl => tl.map(t => t.id === taskId ? { ...t, estimatedMinutes: (t.estimatedMinutes || 0) + elapsed } : t));
            const { [taskId]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [taskId]: Date.now() };
        });
      }
    } else if (input === 'n') {
      setShowNotes(prev => !prev);
    } else if (input === 'd') {
      setShowDeps(prev => !prev);
    } else if (input === 'w') {
      setShowWorkload(prev => !prev);
    } else if (input === 'e') {
      const taskId = orderedTaskIds[selectedIndex];
      if (taskId) {
        const task = taskList.find(t => t.id === taskId);
        if (task) {
          setEditingTaskId(taskId);
          setEditValue(String(task.estimatedMinutes ?? ''));
        }
      }
    } else if (input === 'm') {
      const taskId = orderedTaskIds[selectedIndex];
      if (taskId && onStatusChange) {
        const task = taskList.find(t => t.id === taskId);
        if (task) {
          const newStatus = nextStatus(task.status);
          setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
          onStatusChange(taskId, newStatus);
        }
      }
    } else if (input === 'a') {
      const taskId = orderedTaskIds[selectedIndex];
      if (taskId && onAssign) {
        onAssign(taskId);
      }
    } else if (key.return) {
      const taskId = orderedTaskIds[selectedIndex];
      if (taskId && onSelect) {
        onSelect(taskId);
      }
    } else if (input === 'q' || key.escape) {
      if (onQuit) {
        onQuit();
      }
    } else if (input === '?') {
      setShowHelp(prev => !prev);
    }
  });

  const orderedTasks = useMemo(() => {
    return orderedTaskIds.map(id => taskList.find(t => t.id === id)).filter((t): t is TaskItem => t !== undefined);
  }, [orderedTaskIds, taskList]);

  const selectedTaskId = orderedTaskIds[selectedIndex];
  const selectedTaskComments = selectedTaskId ? (comments?.[selectedTaskId] || []) : [];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>IntelliSchedule — {taskList.length} tasks | Strategy: {activeStrategy} | Press ? for help</Text>
      </Box>

      {orderedTasks.length === 0 && (
        <Text dimColor>No tasks to schedule.</Text>
      )}

      {orderedTasks.map((task, index) => {
        const isSelected = index === selectedIndex;
        const schedule = scheduleMap.get(task.id);
        const rank = index + 1;
        const assigneeLabel = task.assignee_name || task.assignee_id || '';

        return (
          <Box key={task.id} flexDirection="column">
            <Box>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {rank}. {task.title} {formatPriority(task.priority)} {task.estimatedMinutes ? `${task.estimatedMinutes}m ` : ''}{task.deadline ? formatDeadline(task.deadline) + ' ' : ''}
                {task.status ? `[${task.status}] ` : ''}
                {assigneeLabel ? `(@${assigneeLabel}) ` : ''}
                {schedule ? (
                  <Text color={riskColor(schedule.risk)}>{riskDot(schedule.risk)}</Text>
                ) : (
                  ''
                )}
              </Text>
            </Box>
            {isSelected && selectedTaskComments.length > 0 && (
              <Box flexDirection="column" marginLeft={2} marginTop={1} marginBottom={1}>
                <Text dimColor bold>Comments:</Text>
                {selectedTaskComments.map((comment) => (
                  <Box key={comment.id}>
                    <Text dimColor>{comment.author}: {comment.body}</Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}

      {editingTaskId && (
        <Box marginTop={1}>
          <Text color="yellow">Edit estimate (minutes): {editValue}</Text>
        </Box>
      )}

      {showHelp && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" paddingLeft={1} paddingRight={1}>
          <Text bold>Keybindings</Text>
          <Text>j / ↓  next task</Text>
          <Text>k / ↑  previous task</Text>
          <Text>o      optimize (re-run scheduler)</Text>
          <Text>g      switch strategy ({activeStrategy})</Text>
          <Text>e      edit selected task estimate</Text>
          <Text>m      move selected task to next status</Text>
          <Text>a      assign selected task to agent</Text>
          <Text>t      start/stop time tracker</Text>
          <Text>n      toggle notes view</Text>
          <Text>d      toggle dependency graph</Text>
          <Text>w      toggle workload view</Text>
          <Text>Enter  select task / start it</Text>
          <Text>q / Esc  quit screen</Text>
          <Text>?      toggle help</Text>
        </Box>
      )}
    </Box>
  );
}

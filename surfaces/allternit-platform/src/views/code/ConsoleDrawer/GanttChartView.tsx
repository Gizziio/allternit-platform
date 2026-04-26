import React, { useMemo } from 'react';
import { useBoardStore } from '@/stores/board.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { IntelliScheduleEngine } from '@/lib/intelli-schedule/IntelliScheduleEngine';

const DAY_WIDTH = 60;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 32;

export function GanttChartView() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { items } = useBoardStore();

  const workspaceItems = useMemo(() => {
    if (!activeWorkspaceId) return [];
    return items.filter((i) => i.workspaceId === activeWorkspaceId && i.estimatedMinutes);
  }, [items, activeWorkspaceId]);

  const schedule = useMemo(() => {
    if (workspaceItems.length === 0) return null;
    const engine = new IntelliScheduleEngine();
    return engine.optimize({
      tasks: workspaceItems.map((i) => ({
        id: i.id,
        title: i.title,
        priority: i.priority ?? 50,
        estimatedMinutes: i.estimatedMinutes ?? 60,
        deadline: i.deadline ? new Date(i.deadline) : undefined,
        dependencies: i.dependencies ?? [],
        tags: i.labels ?? [],
      })),
      constraints: {
        availableHoursPerDay: 8,
        startTime: new Date(),
        bufferMinutes: 15,
      },
    });
  }, [workspaceItems]);

  const days = useMemo(() => {
    if (!schedule || schedule.schedule.length === 0) return [];
    const start = new Date(schedule.schedule[0].startTime);
    start.setHours(0, 0, 0, 0);
    const end = new Date(Math.max(...schedule.schedule.map((s) => s.endTime.getTime())));
    end.setHours(23, 59, 59, 999);
    const d: Date[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      d.push(new Date(t));
    }
    return d;
  }, [schedule]);

  const getX = (date: Date) => {
    if (days.length === 0) return 0;
    const dayIndex = Math.floor((date.getTime() - days[0].getTime()) / 86400000);
    return dayIndex * DAY_WIDTH + 160;
  };

  const getWidth = (start: Date, end: Date) => {
    const ms = end.getTime() - start.getTime();
    return Math.max((ms / 86400000) * DAY_WIDTH, 4);
  };

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'high': return '#ff3b30';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  };

  if (!activeWorkspaceId) {
    return <div style={{ padding: 24, color: '#9ca3af' }}>Select a workspace to view Gantt chart.</div>;
  }

  if (workspaceItems.length === 0) {
    return <div style={{ padding: 24, color: '#9ca3af' }}>No scheduled items in this workspace. Add estimates to tasks.</div>;
  }

  if (!schedule) {
    return <div style={{ padding: 24, color: '#9ca3af' }}>Scheduling...</div>;
  }

  const chartWidth = days.length * DAY_WIDTH + 180;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>
          Gantt Chart - {workspaceItems.length} tasks
        </span>
      </div>
      <div style={{ position: 'relative', minWidth: chartWidth, flex: 1 }}>
        {/* Day headers */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 2, background: '#111827', height: HEADER_HEIGHT, borderBottom: '1px solid #374151' }}>
          <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid #374151', padding: '6px 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Task</div>
          {days.map((d) => (
            <div key={d.toISOString()} style={{ width: DAY_WIDTH, flexShrink: 0, borderRight: '1px solid #1f2937', padding: '6px 4px', fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
              {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>

        {/* Task rows */}
        {schedule.orderedTasks.map((taskId, idx) => {
          const entry = schedule.schedule.find((s) => s.taskId === taskId);
          const task = workspaceItems.find((t) => t.id === taskId);
          if (!entry || !task) return null;

          return (
            <div key={taskId} style={{ display: 'flex', height: ROW_HEIGHT, borderBottom: '1px solid #1f2937', alignItems: 'center' }}>
              <div style={{ width: 160, flexShrink: 0, padding: '0 8px', fontSize: 12, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.title}
              </div>
              <div style={{ position: 'relative', flex: 1, height: '100%' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: getX(entry.startTime) - 160,
                    top: 6,
                    width: getWidth(entry.startTime, entry.endTime),
                    height: ROW_HEIGHT - 14,
                    background: riskColor(entry.risk),
                    borderRadius: 4,
                    opacity: 0.85,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 6px',
                    fontSize: 10,
                    color: '#fff',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${task.title}: ${entry.startTime.toLocaleString()} - ${entry.endTime.toLocaleString()} (${entry.risk} risk)`}
                >
                  {task.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

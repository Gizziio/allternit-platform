import React, { useMemo } from 'react';
import { useBoardStore } from '@/stores/board.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { IntelliScheduleEngine } from '@/lib/intelli-schedule/IntelliScheduleEngine';

const HOURS_PER_DAY = 8;

export function WorkloadPanel() {
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
        availableHoursPerDay: HOURS_PER_DAY,
        startTime: new Date(),
        bufferMinutes: 15,
      },
    });
  }, [workspaceItems]);

  const dayAllocations = useMemo(() => {
    if (!schedule) return [];
    const map = new Map<string, number>();
    for (const entry of schedule.schedule) {
      let current = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      while (current < end) {
        const key = current.toISOString().split('T')[0];
        const dayStart = new Date(current);
        dayStart.setHours(9, 0, 0, 0);
        const dayEnd = new Date(current);
        dayEnd.setHours(9 + HOURS_PER_DAY, 0, 0, 0);
        const slotStart = current < dayStart ? dayStart : current;
        const slotEnd = end < dayEnd ? end : dayEnd;
        const minutes = Math.max(0, (slotEnd.getTime() - slotStart.getTime()) / 60000);
        map.set(key, (map.get(key) || 0) + minutes);
        current = new Date(current.getTime() + 86400000);
        current.setHours(9, 0, 0, 0);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, minutes]) => ({ date, minutes, hours: minutes / 60 }));
  }, [schedule]);

  if (!activeWorkspaceId) {
    return <div style={{ padding: 24, color: 'var(--ui-text-muted)' }}>Select a workspace to view workload.</div>;
  }

  if (workspaceItems.length === 0) {
    return <div style={{ padding: 24, color: 'var(--ui-text-muted)' }}>No scheduled items in this workspace.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
        Workload Analysis - {HOURS_PER_DAY}h/day capacity
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dayAllocations.map((day) => {
          const pct = Math.min((day.hours / HOURS_PER_DAY) * 100, 100);
          const over = day.hours > HOURS_PER_DAY;
          return (
            <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 90, fontSize: 11, color: 'var(--ui-text-muted)' }}>
                {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ flex: 1, height: 20, background: 'var(--surface-panel)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: over ? 'var(--status-error)' : pct > 80 ? 'var(--status-warning)' : 'var(--status-success)',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }}
                />
                <span style={{ position: 'absolute', right: 6, top: 2, fontSize: 10, color: 'var(--ui-text-primary)' }}>
                  {day.hours.toFixed(1)}h
                </span>
              </div>
              {over && (
                <span style={{ fontSize: 10, color: 'var(--status-error)' }}>Over</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

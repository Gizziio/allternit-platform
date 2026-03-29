/**
 * Timeline View - Gantt-style task flow
 * 
 * Features:
 * - Time-based task bars
 * - Agent lanes
 * - Current time indicator
 * - Zoom controls
 * - Task status coloring
 */

import React, { useMemo } from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
import { TEXT } from '@/design/a2r.tokens';
import { TimelineTask, TimelineMetrics } from '../types';

interface TimelineViewProps {
  tasks: TimelineTask[];
  metrics: TimelineMetrics;
  modeColors: {
    accent: string;
  };
}

export function TimelineView({ tasks, metrics, modeColors }: TimelineViewProps) {
  // Calculate time range
  const timeRange = useMemo(() => {
    const starts = tasks.map(t => t.start);
    const ends = tasks.filter(t => t.end !== null).map(t => t.end!);
    const now = 0; // Current time
    const min = Math.min(...starts, ...ends, now) - 2;
    const max = Math.max(...starts, ...ends, now) + 2;
    return { min, max, duration: max - min };
  }, [tasks]);

  // Group tasks by agent
  const lanes = useMemo(() => {
    const grouped = new Map<string, TimelineTask[]>();
    tasks.forEach(task => {
      const list = grouped.get(task.agentId) || [];
      list.push(task);
      grouped.set(task.agentId, list);
    });
    return Array.from(grouped.entries());
  }, [tasks]);

  const laneHeight = 48;
  const barHeight = 28;
  const headerHeight = 40;

  const getTaskWidth = (start: number, end: number | null) => {
    const endTime = end ?? 0; // Current time
    const width = ((endTime - start) / timeRange.duration) * 100;
    return Math.max(width, 2); // Minimum 2% width
  };

  const getTaskLeft = (start: number) => {
    return ((start - timeRange.min) / timeRange.duration) * 100;
  };

  const formatTimeLabel = (minutes: number) => {
    if (minutes === 0) return 'now';
    if (minutes > 0) return `+${minutes}m`;
    return `${minutes}m`;
  };

  // Generate time grid lines
  const timeGrid = useMemo(() => {
    const lines = [];
    const step = Math.ceil(timeRange.duration / 8);
    for (let t = Math.floor(timeRange.min / step) * step; t <= timeRange.max; t += step) {
      const left = ((t - timeRange.min) / timeRange.duration) * 100;
      if (left >= 0 && left <= 100) {
        lines.push({ value: t, left });
      }
    }
    return lines;
  }, [timeRange]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div 
        className="px-6 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-6 text-xs">
          <span style={{ color: TEXT.secondary }}>
            {metrics.totalTasks} tasks total
          </span>
          <span style={{ color: TEXT.secondary }}>
            {metrics.activeTasks} active
          </span>
          <span style={{ color: modeColors.accent }}>
            {metrics.completedTasks} completed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="w-7 h-7 rounded flex items-center justify-center text-xs"
            style={{ 
              background: 'rgba(255,255,255,0.03)',
              color: TEXT.tertiary,
            }}
          >
            <Minus size={10} weight="bold" />
          </button>
          <span className="text-xs" style={{ color: TEXT.secondary }}>100%</span>
          <button 
            className="w-7 h-7 rounded flex items-center justify-center text-xs"
            style={{ 
              background: 'rgba(255,255,255,0.03)',
              color: TEXT.tertiary,
            }}
          >
            <Plus size={10} weight="bold" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px] p-6">
          {/* Time Axis */}
          <div 
            className="relative mb-4"
            style={{ height: headerHeight, marginLeft: 120 }}
          >
            {timeGrid.map((line, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 text-xs"
                style={{ 
                  left: `${line.left}%`,
                  color: line.value === 0 ? modeColors.accent : TEXT.tertiary,
                }}
              >
                {formatTimeLabel(line.value)}
              </div>
            ))}
            
            {/* Now line indicator */}
            <div
              className="absolute top-6 bottom-0 w-px"
              style={{ 
                left: `${getTaskLeft(0)}%`,
                background: modeColors.accent,
              }}
            >
              <div 
                className="absolute -top-1 -left-1 w-2 h-2 rounded-full"
                style={{ background: modeColors.accent }}
              />
            </div>
          </div>

          {/* Lanes */}
          <div className="space-y-2">
            {lanes.map(([agentId, agentTasks], laneIdx) => {
              const firstTask = agentTasks[0];
              return (
                <div 
                  key={agentId} 
                  className="flex items-center"
                  style={{ height: laneHeight }}
                >
                  {/* Agent Label */}
                  <div 
                    className="w-28 flex-shrink-0 pr-4 text-right"
                  >
                    <div 
                      className="text-xs font-medium truncate"
                      style={{ color: firstTask.agentColor }}
                    >
                      {firstTask.agentName}
                    </div>
                    <div 
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: TEXT.tertiary }}
                    >
                      {firstTask.agentRole}
                    </div>
                  </div>

                  {/* Task Bars */}
                  <div className="flex-1 relative h-full">
                    {/* Grid lines */}
                    {timeGrid.map((line, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px"
                        style={{ 
                          left: `${line.left}%`,
                          background: 'rgba(255,255,255,0.03)',
                        }}
                      />
                    ))}

                    {/* Now line */}
                    <div
                      className="absolute top-0 bottom-0 w-px z-10"
                      style={{ 
                        left: `${getTaskLeft(0)}%`,
                        background: `${modeColors.accent}50`,
                      }}
                    />

                    {/* Tasks */}
                    {agentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="absolute h-7 rounded-md flex items-center px-2 overflow-hidden"
                        style={{
                          left: `${getTaskLeft(task.start)}%`,
                          width: `${getTaskWidth(task.start, task.end)}%`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 
                            task.status === 'completed' 
                              ? `${task.agentColor}30`
                              : `${task.agentColor}50`,
                          border: `1px solid ${task.agentColor}`,
                          boxShadow: task.status === 'active' 
                            ? `0 0 10px ${task.agentColor}40` 
                            : 'none',
                        }}
                      >
                        <span 
                          className="text-[10px] font-medium truncate"
                          style={{ color: TEXT.primary }}
                        >
                          {task.name}
                        </span>
                        
                        {/* Progress bar for active tasks */}
                        {task.status === 'active' && (
                          <div 
                            className="absolute bottom-0 left-0 h-1 rounded-b-md transition-all"
                            style={{ 
                              width: `${task.progress}%`,
                              background: task.agentColor,
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div 
            className="mt-6 pt-4 border-t flex items-center gap-6 text-xs"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ background: modeColors.accent }}
              />
              <span style={{ color: TEXT.secondary }}>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ background: modeColors.accent, opacity: 0.5 }}
              />
              <span style={{ color: TEXT.secondary }}>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-px h-3"
                style={{ background: modeColors.accent }}
              />
              <span style={{ color: TEXT.secondary }}>Now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

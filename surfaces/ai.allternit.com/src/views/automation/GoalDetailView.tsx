"use client";

import React, { useEffect, useState } from 'react';
import { Target, ArrowLeft, Clock, Play, Pause, Trash } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { Button } from '@/components/ui/button';
import type { Goal, GoalChildren } from '@/lib/agents/automation.types';
import { getGoal, getGoalChildren } from '@/lib/automation-api';

interface GoalDetailViewProps {
  goalId: string;
  onBack?: () => void;
}

export function GoalDetailView({ goalId, onBack }: GoalDetailViewProps) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [children, setChildren] = useState<GoalChildren>({ routines: [], loops: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [goalData, childrenData] = await Promise.all([
          getGoal(goalId),
          getGoalChildren(goalId),
        ]);
        setGoal(goalData);
        setChildren(childrenData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load goal details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [goalId]);

  const statusColor: Record<string, string> = {
    active: 'var(--status-success)',
    completed: 'var(--status-info)',
    paused: 'var(--status-warning)',
    disabled: 'var(--ui-text-muted)',
    error: 'var(--status-error)',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <p className="text-sm mb-4" style={{ color: 'var(--status-error)' }}>
          {error || 'Goal not found'}
        </p>
        {onBack && (
          <Button onClick={onBack} variant="ghost" className="flex items-center gap-2">
            <ArrowLeft size={16} /> Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button onClick={onBack} variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft size={20} />
            </Button>
          )}
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <Target size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {goal.title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Goal details and linked automation
            </p>
          </div>
        </div>
        <span
          className="px-3 py-1 text-xs font-semibold rounded-full"
          style={{
            backgroundColor: statusColor[goal.status] || 'var(--ui-text-muted)',
            color: '#ffffff',
          }}
        >
          {goal.status}
        </span>
      </div>

      <GlassSurface className="p-6 rounded-lg">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Priority
            </p>
            <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
              {goal.priority}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Progress
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {goal.progress}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Target Date
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {goal.target_date || 'None'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Created
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {new Date(goal.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        {goal.description && (
          <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {goal.description}
            </p>
          </div>
        )}
      </GlassSurface>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassSurface className="p-5 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
            Linked Routines ({children.routines.length})
          </h2>
          {children.routines.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No routines linked to this goal.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {children.routines.map((routine) => (
                <div
                  key={routine.id}
                  className="p-3 rounded-lg border border-[var(--border-subtle)] flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {routine.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {routine.schedule_type}: {routine.schedule_expression}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: statusColor[routine.status] || 'var(--ui-text-muted)',
                      color: '#ffffff',
                    }}
                  >
                    {routine.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassSurface>

        <GlassSurface className="p-5 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Play size={18} style={{ color: 'var(--accent-primary)' }} />
            Linked Loops ({children.loops.length})
          </h2>
          {children.loops.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No loops linked to this goal.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {children.loops.map((loop) => (
                <div
                  key={loop.id}
                  className="p-3 rounded-lg border border-[var(--border-subtle)] flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {loop.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {loop.schedule_type}: {loop.schedule_expression}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: statusColor[loop.status] || 'var(--ui-text-muted)',
                      color: '#ffffff',
                    }}
                  >
                    {loop.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassSurface>
      </div>
    </div>
  );
}

export default GoalDetailView;

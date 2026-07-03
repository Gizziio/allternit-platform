"use client";
import React from 'react';
import { Check, Circle, ListChecks } from '@phosphor-icons/react';
import type { TodoProgress } from '../../lib/design/todo-progress';

interface TodoProgressCardProps {
  progress: TodoProgress;
}

export function TodoProgressCard({ progress }: TodoProgressCardProps) {
  if (progress.totalCount === 0) return null;

  return (
    <div style={{
      background: 'var(--surface-panel)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
          color: 'var(--accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ListChecks size={16} weight="bold" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
            Plan progress
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {progress.completedCount} of {progress.totalCount} steps complete
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-primary)' }}>
          {progress.percent}%
        </div>
      </div>

      <div style={{
        height: 4, borderRadius: 2,
        background: 'var(--surface-hover)',
        overflow: 'hidden', marginBottom: 12,
      }}>
        <div style={{
          width: `${progress.percent}%`, height: '100%',
          background: 'var(--accent-primary)',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {progress.items.slice(0, 8).map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: item.completed
                ? 'var(--status-success)'
                : 'var(--surface-hover)',
              color: item.completed ? '#fff' : 'var(--text-tertiary)',
            }}>
              {item.completed ? <Check size={10} weight="bold" /> : <Circle size={8} weight="fill" />}
            </div>
            <span style={{
              fontSize: 12, lineHeight: 1.4,
              color: item.completed ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              textDecoration: item.completed ? 'line-through' : 'none',
            }}>
              {item.label}
            </span>
          </div>
        ))}
        {progress.items.length > 8 && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 24 }}>
            +{progress.items.length - 8} more steps
          </div>
        )}
      </div>
    </div>
  );
}

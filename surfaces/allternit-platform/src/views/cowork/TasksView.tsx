import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  tag: string;
  assignee: string;
  column: 'todo' | 'in-progress' | 'done';
}

const getPriorityColor = (priority: Task['priority']) => {
  switch (priority) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#3b82f6';
    default:
      return 'var(--text-secondary)';
  }
};

const getTagBg = (tag: string) => {
  switch (tag) {
    case 'Agent':
      return '#dbeafe';
    case 'Code':
      return '#ddd6fe';
    case 'Docs':
      return '#fce7f3';
    default:
      return 'var(--bg-secondary)';
  }
};

const getTagColor = (tag: string) => {
  switch (tag) {
    case 'Agent':
      return '#0369a1';
    case 'Code':
      return '#5b21b6';
    case 'Docs':
      return '#be185d';
    default:
      return 'var(--text-secondary)';
  }
};

export const TasksView: React.FC = () => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [taskItems, setTaskItems] = useState<Task[]>([]);

  useEffect(() => {
    fetch('/api/v1/workspace/tasks').then(r => r.json()).then(setTaskItems).catch(() => {});
  }, []);

  const columns = ['todo', 'in-progress', 'done'] as const;
  const columnLabels = { todo: 'TODO', 'in-progress': 'IN PROGRESS', done: 'DONE' };

  const getTasksForColumn = (columnId: string) => {
    return taskItems.filter((task) => task.column === columnId);
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <CheckSquare size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Tasks</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Project task management</p>
      </div>

      {/* Kanban Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--spacing-lg)',
          minHeight: '600px',
        }}
      >
        {columns.map((column) => {
          const tasks = getTasksForColumn(column);
          return (
            <div key={column} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Column Header */}
              <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <h2
                  style={{
                    margin: 0,
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {columnLabels[column]}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {tasks.length}
                </span>
              </div>

              {/* Task Cards Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', flex: 1 }}>
                {tasks.map((task) => (
                  <GlassSurface
                    key={task.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      cursor: 'grab',
                      transition: 'all 0.2s ease',
                      boxShadow:
                        hoveredTaskId === task.id
                          ? '0 20px 40px rgba(0, 0, 0, 0.15)'
                          : '0 8px 16px rgba(0, 0, 0, 0.08)',
                    }}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                  >
                    {/* Task Title */}
                    <h3
                      style={{
                        margin: '0 0 var(--spacing-md) 0',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      {task.title}
                    </h3>

                    {/* Priority and Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                      {/* Priority Dot */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getPriorityColor(task.priority),
                          flexShrink: 0,
                        }}
                      />

                      {/* Tag Chip */}
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: getTagBg(task.tag),
                          color: getTagColor(task.tag),
                          fontWeight: 500,
                        }}
                      >
                        {task.tag}
                      </span>
                    </div>

                    {/* Assignee Avatar */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#af52de',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {task.assignee}
                    </div>
                  </GlassSurface>
                ))}
                {tasks.length === 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      color: 'var(--text-tertiary)',
                      fontSize: '13px',
                    }}
                  >
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TasksView;

import React, { useState } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { tokens } from '../../design/tokens';
import { RailRowMenu } from '../../shell/rail/RailRowMenu';
import { useCoworkStore, Task, TaskProject } from './CoworkStore';
import {
  Plus,
  Robot,
  CalendarCheck,
  List,
  CheckSquare,
  FolderOpen,
  FolderPlus,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';

export function CoworkRail() {
  // Use useStoreWithEqualityFn with shallow for array/object selectors to avoid Zustand v4 issues
  const tasks = useStoreWithEqualityFn(useCoworkStore, (s) => s.tasks, shallow);
  const projects = useStoreWithEqualityFn(useCoworkStore, (s) => s.projects, shallow);
  const activeTaskId = useStoreWithEqualityFn(useCoworkStore, (s) => s.activeTaskId);
  const activeProjectId = useStoreWithEqualityFn(useCoworkStore, (s) => s.activeProjectId);
  const activeTab = useStoreWithEqualityFn(useCoworkStore, (s) => s.activeTab);
  const setActiveTask = useStoreWithEqualityFn(useCoworkStore, (s) => s.setActiveTask);
  const setActiveProject = useStoreWithEqualityFn(useCoworkStore, (s) => s.setActiveProject);
  const setActiveTab = useStoreWithEqualityFn(useCoworkStore, (s) => s.setActiveTab);
  const deleteTask = useStoreWithEqualityFn(useCoworkStore, (s) => s.deleteTask);
  const renameTask = useStoreWithEqualityFn(useCoworkStore, (s) => s.renameTask);
  const deleteProject = useStoreWithEqualityFn(useCoworkStore, (s) => s.deleteProject);
  const renameProject = useStoreWithEqualityFn(useCoworkStore, (s) => s.renameProject);
  const createProject = useStoreWithEqualityFn(useCoworkStore, (s) => s.createProject);
  const createTask = useStoreWithEqualityFn(useCoworkStore, (s) => s.createTask);

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    return new Set(projects.map((p) => p.id));
  });

  const toggleProject = (projectId: string) => {
    const next = new Set(expandedProjects);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    setExpandedProjects(next);
  };

  // Filter tasks by type based on active tab
  const agentTasks = tasks.filter((t) => !t.projectId && t.mode === 'agent');
  const regularTasks = tasks.filter((t) => !t.projectId && t.mode !== 'agent');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.md,
        padding: `${tokens.space.sm}px`,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {/* Quick Actions - Top Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <QuickActionButton
          icon={Plus as any}
          label="New Task"
          shortcut="⌘N"
          onClick={() => createTask('New Task')}
          isPrimary
        />
        <QuickActionButton
          icon={Robot as any}
          label="Agent Hub"
          onClick={() => { /* Open Agent Hub */ }}
        />
        <QuickActionButton
          icon={CalendarCheck as any}
          label="Cron"
          onClick={() => { /* Open Cron/Scheduler */ }}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

      {/* Tasks Section with Tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Tabs Header */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: `0 ${tokens.space.xs}px`,
            marginBottom: tokens.space.sm,
          }}
        >
          <TabButton
            active={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            count={regularTasks.length}
          >
            Tasks
          </TabButton>
          <TabButton
            active={activeTab === 'agent-tasks'}
            onClick={() => setActiveTab('agent-tasks')}
            count={agentTasks.length}
          >
            Agent Tasks
          </TabButton>
        </div>

        {/* Projects Section */}
        <div style={{ marginBottom: tokens.space.md }}>
          <SectionHeader
            title="Projects"
            count={projects.length}
            onAdd={() => createProject('New Project')}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              const projectTasks = tasks.filter((t) => t.projectId === project.id);
              const isActive = activeProjectId === project.id;

              return (
                <div key={project.id}>
                  <CoworkRailItem
                    icon={FolderOpen as any}
                    label={project.title}
                    isActive={isActive}
                    onClick={() => setActiveProject(project.id)}
                    badge={projectTasks.length > 0 ? projectTasks.length : undefined}
                    isFolder
                    isExpanded={isExpanded}
                    onToggle={() => toggleProject(project.id)}
                    actions={
                      <RailRowMenu
                        onDelete={() => deleteProject(project.id)}
                        onRename={() => {
                          const newTitle = prompt('Rename project:', project.title);
                          if (newTitle) renameProject(project.id, newTitle);
                        }}
                      />
                    }
                  />

                  {/* Project Tasks */}
                  {isExpanded && projectTasks.length > 0 && (
                    <div
                      style={{
                        marginLeft: 20,
                        paddingLeft: tokens.space.sm,
                        borderLeft: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {projectTasks.map((task) => (
                        <CoworkRailItem
                          key={task.id}
                          icon={task.mode === 'agent' ? (Robot as any) : (CheckSquare as any)}
                          label={task.title}
                          isActive={activeTaskId === task.id}
                          isNested
                          onClick={() => setActiveTask(task.id)}
                          actions={
                            <RailRowMenu
                              onDelete={() => deleteTask(task.id)}
                              onRename={() => {
                                const newTitle = prompt('Rename task:', task.title);
                                if (newTitle) renameTask(task.id, newTitle);
                              }}
                            />
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* New Project Button */}
            <NewItemButton
              icon={FolderPlus as any}
              label="New Project"
              onClick={() => createProject('New Project')}
            />
          </div>
        </div>

        {/* Active Tab Content */}
        {activeTab === 'tasks' && regularTasks.length > 0 && (
          <div>
            <SectionHeader title="Active Tasks" count={regularTasks.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {regularTasks.map((task) => (
                <CoworkRailItem
                  key={task.id}
                  icon={CheckSquare as any}
                  label={task.title}
                  isActive={activeTaskId === task.id}
                  onClick={() => setActiveTask(task.id)}
                  actions={
                    <RailRowMenu
                      onDelete={() => deleteTask(task.id)}
                      onRename={() => {
                        const newTitle = prompt('Rename task:', task.title);
                        if (newTitle) renameTask(task.id, newTitle);
                      }}
                    />
                  }
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'agent-tasks' && agentTasks.length > 0 && (
          <div>
            <SectionHeader title="Agent Tasks" count={agentTasks.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {agentTasks.map((task) => (
                <CoworkRailItem
                  key={task.id}
                  icon={Robot as any}
                  label={task.title}
                  isActive={activeTaskId === task.id}
                  onClick={() => setActiveTask(task.id)}
                  actions={
                    <RailRowMenu
                      onDelete={() => deleteTask(task.id)}
                      onRename={() => {
                        const newTitle = prompt('Rename task:', task.title);
                        if (newTitle) renameTask(task.id, newTitle);
                      }}
                    />
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Quick Action Button Component
interface QuickActionButtonProps {
  icon: React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  isPrimary?: boolean;
}

function QuickActionButton({ icon: Icon, label, shortcut, onClick, isPrimary }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.sm,
        padding: `${tokens.space.sm}px ${tokens.space.md}px`,
        borderRadius: tokens.radius.md,
        border: isPrimary ? 'none' : '1px solid var(--border-subtle)',
        background: isPrimary ? 'var(--accent-primary)' : 'transparent',
        color: isPrimary ? 'var(--accent-primary-text)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
    >
      <Icon size={18} weight={isPrimary ? "bold" : "regular"} />
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{shortcut}</span>
      )}
    </button>
  );
}

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}

function TabButton({ active, onClick, count, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        borderRadius: tokens.radius.sm,
        border: 'none',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.space.xs,
      }}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-elevated)',
            padding: '2px 6px',
            borderRadius: tokens.radius.sm,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// Section Header Component
interface SectionHeaderProps {
  title: string;
  count?: number;
  onAdd?: () => void;
}

function SectionHeader({ title, count, onAdd }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        marginBottom: tokens.space.xs,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-tertiary)',
        }}
      >
        {title}
        {count !== undefined && (
          <span
            style={{
              marginLeft: tokens.space.xs,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              opacity: 0.7,
            }}
          >
            ({count})
          </span>
        )}
      </span>
      {onAdd && (
        <button
          onClick={onAdd}
          style={{
            background: 'transparent',
            border: 'none',
            padding: tokens.space.xs,
            cursor: 'pointer',
            borderRadius: tokens.radius.sm,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Add new"
        >
          <Plus size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}

// Cowork Rail Item Component
interface CoworkRailItemProps {
  icon: React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
  label: string;
  isActive?: boolean;
  isNested?: boolean;
  isFolder?: boolean;
  isExpanded?: boolean;
  badge?: number;
  onClick: () => void;
  onToggle?: () => void;
  actions?: React.ReactNode;
}

function CoworkRailItem({
  icon: Icon,
  label,
  isActive,
  isNested,
  isFolder,
  isExpanded,
  badge,
  onClick,
  onToggle,
  actions,
}: CoworkRailItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.xs,
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        paddingLeft: isNested ? tokens.space.md : tokens.space.sm,
        borderRadius: tokens.radius.md,
        background: isActive ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'all 0.1s ease',
      }}
    >
      {isFolder && onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-tertiary)',
          }}
        >
          {isExpanded ? (
            <CaretDown size={12} weight="bold" />
          ) : (
            <CaretRight size={12} weight="bold" />
          )}
        </button>
      )}
      
      <Icon size={16} weight={isActive ? "fill" : "regular"} />
      
      <span
        onClick={onClick}
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>

      {badge !== undefined && badge > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-elevated)',
            padding: '2px 6px',
            borderRadius: tokens.radius.sm,
            marginLeft: 'auto',
          }}
        >
          {badge}
        </span>
      )}

      {actions && (
        <div
          style={{
            opacity: 0,
            transition: 'opacity 0.15s ease',
          }}
          className="rail-item-actions"
        >
          {actions}
        </div>
      )}
    </div>
  );
}

// New Item Button Component
interface NewItemButtonProps {
  icon: React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
  label: string;
  onClick: () => void;
}

function NewItemButton({ icon: Icon, label, onClick }: NewItemButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.sm,
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        borderRadius: tokens.radius.md,
        border: '1px dashed var(--border-subtle)',
        background: 'transparent',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        width: '100%',
        textAlign: 'left',
        marginTop: tokens.space.xs,
        transition: 'all 0.15s ease',
      }}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

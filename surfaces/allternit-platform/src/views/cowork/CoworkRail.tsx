import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { tokens } from '../../design/tokens';
import { RailRowMenu } from '../../shell/rail/RailRowMenu';
import { InlineRename, type InlineRenameHandle } from '@/components/InlineRename';
import { groupSessionsByTime } from '@/lib/groupSessionsByTime';
import { useCoworkStore, type Task } from './CoworkStore';
import {
  Plus,
  Robot,
  CalendarCheck,
  CheckSquare,
  FolderOpen,
  FolderPlus,
  CaretDown,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';

export function CoworkRail() {
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

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() =>
    new Set(projects.map((p) => p.id)),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Per-item rename refs
  const renameRefs = useRef<Map<string, InlineRenameHandle>>(new Map());
  const getOrCreateRef = (id: string): React.RefCallback<InlineRenameHandle> => (handle) => {
    if (handle) {
      renameRefs.current.set(id, handle);
    } else {
      renameRefs.current.delete(id);
    }
  };

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  // Tasks not in any project, filtered by active tab and search
  const rootTasks = useMemo(() => {
    const base = tasks
      .filter((t) => !t.projectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const byTab = activeTab === 'agent-tasks'
      ? base.filter((t) => t.mode === 'agent')
      : base.filter((t) => t.mode !== 'agent');

    if (!searchQuery.trim()) return byTab;
    const q = searchQuery.toLowerCase();
    return byTab.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, activeTab, searchQuery]);

  const agentTaskCount = useMemo(
    () => tasks.filter((t) => !t.projectId && t.mode === 'agent').length,
    [tasks],
  );
  const regularTaskCount = useMemo(
    () => tasks.filter((t) => !t.projectId && t.mode !== 'agent').length,
    [tasks],
  );

  const timeGroups = useMemo(
    () => groupSessionsByTime<Task>(rootTasks, (t) => t.updatedAt),
    [rootTasks],
  );

  const isSearchActive = searchQuery.trim().length > 0 || isSearchFocused;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.sm,
        padding: `${tokens.space.sm}px`,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {/* Quick Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <QuickActionButton
          icon={Plus}
          label="New Task"
          shortcut="⌘N"
          onClick={() => createTask('New Task')}
          isPrimary
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <QuickActionButton
            icon={Robot}
            label="Agent Hub"
            onClick={() => { /* Open Agent Hub */ }}
          />
          <QuickActionButton
            icon={CalendarCheck}
            label="Cron"
            onClick={() => { /* Open Cron */ }}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />

      {/* Search */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <MagnifyingGlass
          size={14}
          style={{
            position: 'absolute',
            left: 8,
            color: isSearchActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            pointerEvents: 'none',
            transition: `color ${tokens.motion.fast}`,
          }}
        />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder="Search tasks…"
          style={{
            width: '100%',
            background: isSearchActive ? 'var(--bg-tertiary)' : 'transparent',
            border: `1px solid ${isSearchActive ? 'var(--border-default)' : 'var(--border-subtle)'}`,
            borderRadius: tokens.radius.sm,
            color: 'var(--text-primary)',
            fontSize: 12,
            padding: '5px 28px 5px 28px',
            outline: 'none',
            transition: `all ${tokens.motion.fast}`,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 6,
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        <TabButton
          active={activeTab === 'tasks'}
          onClick={() => setActiveTab('tasks')}
          count={regularTaskCount}
        >
          Tasks
        </TabButton>
        <TabButton
          active={activeTab === 'agent-tasks'}
          onClick={() => setActiveTab('agent-tasks')}
          count={agentTaskCount}
        >
          Agent
        </TabButton>
      </div>

      {/* Projects — hidden while searching */}
      {!searchQuery && (
        <div style={{ marginBottom: tokens.space.xs }}>
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
                    icon={FolderOpen}
                    label={project.title}
                    isActive={isActive}
                    onClick={() => setActiveProject(project.id)}
                    badge={projectTasks.length > 0 ? projectTasks.length : undefined}
                    isFolder
                    isExpanded={isExpanded}
                    onToggle={() => toggleProject(project.id)}
                    renameRef={getOrCreateRef(`proj-${project.id}`)}
                    onSaveRename={(title) => renameProject(project.id, title)}
                    actions={
                      <RailRowMenu
                        onDelete={() => deleteProject(project.id)}
                        onRename={() =>
                          renameRefs.current.get(`proj-${project.id}`)?.startEdit()
                        }
                      />
                    }
                  />

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
                          icon={task.mode === 'agent' ? Robot : CheckSquare}
                          label={task.title}
                          isActive={activeTaskId === task.id}
                          isNested
                          onClick={() => setActiveTask(task.id)}
                          renameRef={getOrCreateRef(task.id)}
                          onSaveRename={(title) => renameTask(task.id, title)}
                          actions={
                            <RailRowMenu
                              onDelete={() => deleteTask(task.id)}
                              onRename={() =>
                                renameRefs.current.get(task.id)?.startEdit()
                              }
                            />
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <NewItemButton
              icon={FolderPlus}
              label="New Project"
              onClick={() => createProject('New Project')}
            />
          </div>
        </div>
      )}

      {/* Time-grouped task list */}
      {timeGroups.length > 0 && (
        <div style={{ flex: 1 }}>
          {!searchQuery && (
            <SectionHeader
              title={activeTab === 'agent-tasks' ? 'Agent Tasks' : 'Tasks'}
              count={rootTasks.length}
            />
          )}
          {timeGroups.map((group) => (
            <div key={group.key} style={{ marginBottom: tokens.space.sm }}>
              <TimeGroupLabel label={group.label} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((task) => (
                  <CoworkRailItem
                    key={task.id}
                    icon={task.mode === 'agent' ? Robot : CheckSquare}
                    label={task.title}
                    isActive={activeTaskId === task.id}
                    onClick={() => setActiveTask(task.id)}
                    renameRef={getOrCreateRef(task.id)}
                    onSaveRename={(title) => renameTask(task.id, title)}
                    actions={
                      <RailRowMenu
                        onDelete={() => deleteTask(task.id)}
                        onRename={() => renameRefs.current.get(task.id)?.startEdit()}
                      />
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty search state */}
      {searchQuery && timeGroups.length === 0 && (
        <div
          style={{
            padding: `${tokens.space.lg}px ${tokens.space.md}px`,
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          No tasks matching &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time group label
// ---------------------------------------------------------------------------

function TimeGroupLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-tertiary)',
        padding: `${tokens.space.xs}px ${tokens.space.md}px`,
        marginTop: tokens.space.xs,
        opacity: 0.6,
      }}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Button
// ---------------------------------------------------------------------------

interface QuickActionButtonProps {
  icon: React.ComponentType<{ size?: number; weight?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  isPrimary?: boolean;
}

function QuickActionButton({ icon: Icon, label, shortcut, onClick, isPrimary }: QuickActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.sm,
        padding: `${tokens.space.sm}px ${tokens.space.md}px`,
        borderRadius: tokens.radius.sm,
        border: isPrimary ? 'none' : '1px solid var(--border-subtle)',
        background: isPrimary
          ? 'var(--accent-cowork, var(--accent-primary))'
          : isHovered
            ? 'var(--rail-hover)'
            : 'transparent',
        color: isPrimary ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: isPrimary ? 600 : 500,
        width: '100%',
        textAlign: 'left',
        transition: `all ${tokens.motion.fast}`,
      }}
    >
      <Icon size={16} weight={isPrimary ? 'bold' : 'regular'} />
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{shortcut}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

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
        background: active ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.space.xs,
        transition: `all ${tokens.motion.fast}`,
      }}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
            background: 'var(--bg-secondary)',
            padding: '1px 5px',
            borderRadius: tokens.radius.full,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

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
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cowork Rail Item
// ---------------------------------------------------------------------------

interface CoworkRailItemProps {
  icon: React.ComponentType<{ size?: number; weight?: string; color?: string; style?: React.CSSProperties }>;
  label: string;
  isActive?: boolean;
  isNested?: boolean;
  isFolder?: boolean;
  isExpanded?: boolean;
  badge?: number;
  onClick: () => void;
  onToggle?: () => void;
  actions?: React.ReactNode;
  renameRef?: React.RefCallback<InlineRenameHandle>;
  onSaveRename?: (newName: string) => void;
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
  renameRef,
  onSaveRename,
}: CoworkRailItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <button
        onClick={onClick}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space.xs,
          padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
          paddingLeft: isNested ? tokens.space.md : tokens.space.sm,
          paddingRight: actions ? 36 : tokens.space.sm,
          borderRadius: tokens.radius.sm,
          border: 'none',
          background: isActive
            ? 'var(--rail-active-bg)'
            : isHovered
              ? 'var(--rail-hover)'
              : 'transparent',
          color: isActive ? 'var(--rail-active-fg)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          textAlign: 'left',
          transition: `all ${tokens.motion.fast}`,
          minWidth: 0,
          width: '100%',
        }}
      >
        {isFolder && onToggle && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              cursor: 'pointer',
              opacity: 0.5,
              transition: `transform ${tokens.motion.fast}`,
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              flexShrink: 0,
            }}
          >
            <CaretDown size={10} weight="bold" />
          </span>
        )}

        <Icon
          size={isNested ? 14 : 16}
          weight={isActive ? 'fill' : 'regular'}
          color={isActive ? 'var(--rail-active-fg)' : 'var(--text-tertiary)'}
          style={{ flexShrink: 0 }}
        />

        {renameRef && onSaveRename ? (
          <InlineRename
            ref={renameRef}
            value={label}
            onSave={onSaveRename}
            style={{
              color: isActive ? 'var(--rail-active-fg)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )}

        {badge !== undefined && badge > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              background: 'var(--bg-secondary)',
              padding: '1px 5px',
              borderRadius: tokens.radius.full,
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {actions && (
        <div
          style={{
            position: 'absolute',
            right: tokens.space.xs,
            opacity: isHovered ? 1 : 0,
            pointerEvents: isHovered ? 'auto' : 'none',
            transition: `opacity ${tokens.motion.fast}`,
            zIndex: 10,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Item Button
// ---------------------------------------------------------------------------

interface NewItemButtonProps {
  icon: React.ComponentType<{ size?: number; weight?: string }>;
  label: string;
  onClick: () => void;
}

function NewItemButton({ icon: Icon, label, onClick }: NewItemButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.sm,
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        borderRadius: tokens.radius.sm,
        border: '1px dashed var(--border-subtle)',
        background: isHovered ? 'var(--rail-hover)' : 'transparent',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        width: '100%',
        textAlign: 'left',
        marginTop: tokens.space.xs,
        transition: `all ${tokens.motion.fast}`,
      }}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

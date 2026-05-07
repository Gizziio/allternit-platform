/**
 * CoworkProjectView - Project view for Cowork mode
 * Uses BaseProjectView for consistent layout
 * Shows tasks list with real ChatComposer, tabs, and wired functionality
 */

import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Robot,
  PencilSimple,
  Trash,
  DotsThreeOutline,
} from '@phosphor-icons/react';
import { useCoworkStore } from './CoworkStore';
import { useNav } from '@/nav/useNav';
import {
  BaseProjectView,
  ProjectItemCard,
  ProjectMenuButton,
} from '../BaseProjectView';
import { ChatComposer } from '../chat/ChatComposer';

interface CoworkProjectViewProps {
  projectId?: string;
}

const COWORK_PROJECT_UNAVAILABLE = {
  instructions: 'Project-level instructions are not yet backed by shared persistence in CoworkProjectView.',
  sources: 'Project-level sources are not yet backed by shared persistence or a real file picker in CoworkProjectView.',
} as const;

function CoworkProjectNotice({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)',
      background: 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--ui-text-primary)',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <p style={{
        margin: 0,
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--ui-text-secondary)',
      }}>
        {description}
      </p>
    </div>
  );
}

export function CoworkProjectView({ projectId }: CoworkProjectViewProps) {
  const {
    projects,
    tasks,
    activeProjectId,
    setActiveProject,
    createTask,
    deleteTask,
    renameTask,
    deleteProject,
    renameProject,
    activeTaskId,
    setActiveTask,
  } = useCoworkStore();

  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState('tasks');
  const [isStarred, setIsStarred] = useState(false);
  const [composerInput, setComposerInput] = useState('');

  // Get current project
  const currentProjectId = projectId || activeProjectId;
  const project = useMemo(() =>
    projects.find(p => p.id === currentProjectId),
    [projects, currentProjectId]
  );

  // Filter tasks for this project
  const projectTasks = useMemo(() =>
    (tasks || []).filter(t => t.projectId === currentProjectId && t.mode !== 'agent'),
    [tasks, currentProjectId]
  );

  const projectAgentTasks = useMemo(() =>
    (tasks || []).filter(t => t.projectId === currentProjectId && t.mode === 'agent'),
    [tasks, currentProjectId]
  );

  const displayTasks = activeTab === 'tasks' ? projectTasks : projectAgentTasks;
  const hasContent = displayTasks.length > 0;

  // Handle back to workspace
  const handleBack = () => {
    setActiveProject(null);
    dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
  };

  // Handle create task from composer
  const handleSend = (text: string) => {
    if (!text.trim() || !currentProjectId) return;

    const mode = activeTab === 'agent-tasks' ? 'agent' : 'task';
    createTask(text.trim(), mode, currentProjectId);
    setComposerInput('');
  };

  // Handle new task button
  const handleNewTask = () => {
    if (!currentProjectId) return;
    const mode = activeTab === 'agent-tasks' ? 'agent' : 'task';
    createTask(`New ${mode === 'agent' ? 'Agent ' : ''}Task`, mode, currentProjectId);
  };

  // Handle project rename
  const handleRename = () => {
    const newTitle = prompt('Rename project:', project?.title);
    if (newTitle && currentProjectId) {
      renameProject(currentProjectId, newTitle.trim());
    }
  };

  // Handle project delete
  const handleDelete = () => {
    if (confirm(`Delete "${project?.title}"? All tasks will be unassigned.`)) {
      if (currentProjectId) {
        deleteProject(currentProjectId);
        setActiveProject(null);
        dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
      }
    }
  };

  if (!project) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ui-text-secondary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p>Project not found</p>
          <button
            onClick={handleBack}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: 'color-mix(in srgb, var(--accent-cowork) 10%, var(--surface-panel))',
              border: 'none',
              borderRadius: 8,
              color: 'var(--accent-cowork)',
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Menu content for the 3-dot menu
  const menuContent = (
    <ProjectMenuButton>
      <button
        onClick={handleRename}
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          background: 'transparent',
          color: 'var(--ui-text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <PencilSimple size={16} />
        Edit details
      </button>
      <button
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          background: 'transparent',
          color: 'var(--ui-text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m21 15-9 9-9-9" />
          <path d="M12 3v18" />
        </svg>
        Archive
      </button>
      <button
        onClick={handleDelete}
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          background: 'transparent',
          color: 'var(--status-error)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <Trash size={16} />
        Delete
      </button>
    </ProjectMenuButton>
  );

  // Real ChatComposer as input bar
  const inputBar = (
    <ChatComposer
      onSend={handleSend}
      placeholder={`Message ${project.title}`}
      inputValue={composerInput}
      showTopActions={false}
      variant="default"
    />
  );

  // Sidebar sections
  const sidebarSectionsData = {
    memory: null,
    instructions: (
      <CoworkProjectNotice
        title="Instructions Unavailable"
        description={COWORK_PROJECT_UNAVAILABLE.instructions}
      />
    ),
    files: (
      <CoworkProjectNotice
        title="Sources Unavailable"
        description={COWORK_PROJECT_UNAVAILABLE.sources}
      />
    ),
  };

  return (
    <>
      <BaseProjectView
        title={project.title}
        description="Project workspace"
        onBack={handleBack}
        onToggleStar={() => setIsStarred(!isStarred)}
        isStarred={isStarred}
        tabs={[
          { id: 'tasks', label: 'Tasks', count: projectTasks.length },
          { id: 'agent-tasks', label: 'Agent Tasks', count: projectAgentTasks.length },
          { id: 'sources', label: 'Sources', count: 0 },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewItem={handleNewTask}
        newButtonLabel="New Task"
        menuContent={menuContent}
        inputBar={inputBar}
        sidebarSections={sidebarSectionsData}
        showEmptyState={!hasContent}
        emptyState={{
          message: activeTab === 'tasks'
            ? 'Tasks will appear here.'
            : activeTab === 'agent-tasks'
            ? 'Agent tasks will appear here.'
            : 'Project sources are not available here yet.',
          subMessage: activeTab === 'tasks'
            ? 'Create a task to get started with this project.'
            : activeTab === 'agent-tasks'
            ? 'Create an agent task to get autonomous assistance.'
            : COWORK_PROJECT_UNAVAILABLE.sources,
        }}
      >
        {/* Content based on active tab */}
        {(activeTab === 'tasks' || activeTab === 'agent-tasks') && (
          <div>
            {displayTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isActive={activeTaskId === task.id}
                onClick={() => setActiveTask(task.id)}
                onRename={(newTitle) => renameTask(task.id, newTitle)}
                onDelete={() => deleteTask(task.id)}
                isAgent={task.mode === 'agent'}
              />
            ))}
          </div>
        )}
        {activeTab === 'sources' && (
          <div>
            <ProjectItemCard
              title="Sources unavailable"
              subtitle={COWORK_PROJECT_UNAVAILABLE.sources}
              icon={<CheckSquare size={18} />}
            />
          </div>
        )}
      </BaseProjectView>
    </>
  );
}

// Task Card Component
interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    mode?: string;
  };
  isActive: boolean;
  onClick: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  isAgent?: boolean;
}

function TaskCard({ task, isActive, onClick, onRename, onDelete, isAgent }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        style={{
          padding: '16px 20px',
          background: 'transparent',
          borderRadius: 12,
          border: '1px solid var(--ui-border-default)',
          marginBottom: 8,
        }}
      >
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            if (e.key === 'Escape') {
              setEditTitle(task.title);
              setIsEditing(false);
            }
          }}
          onBlur={handleSaveRename}
          autoFocus
          style={{
            width: '100%',
            fontSize: 14,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--ui-text-primary)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 20px',
        background: isActive ? 'var(--surface-active)' : 'transparent',
        borderRadius: 12,
        border: `1px solid ${isActive ? 'var(--ui-border-default)' : 'var(--ui-border-muted)'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'var(--transition-fast)',
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--surface-hover)';
          e.currentTarget.style.borderColor = 'var(--ui-border-default)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
        }
      }}
    >
      {/* Status dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: task.status === 'completed' ? 'var(--status-success)' :
                   task.status === 'in_progress' ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
        flexShrink: 0,
      }} />

      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'var(--surface-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ui-text-secondary)',
        flexShrink: 0,
      }}>
        {isAgent ? <Robot size={18} /> : <CheckSquare size={18} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--accent-primary)' : 'var(--ui-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {task.title}
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--ui-text-muted)',
          marginTop: 2,
        }}>
          {isAgent ? 'Agent task' : 'Task'} • {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Menu */}
      <div
        style={{ position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: showMenu ? 'var(--surface-active)' : 'transparent',
            color: 'var(--ui-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DotsThreeOutline size={16} />
        </button>

        {showMenu && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
              }}
              onClick={() => setShowMenu(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                minWidth: 140,
                background: 'var(--surface-floating)',
                borderRadius: 10,
                border: '1px solid var(--ui-border-muted)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 9999,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  setEditTitle(task.title);
                  setIsEditing(true);
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--ui-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <PencilSimple size={14} />
                Rename
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--status-error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--status-error) 10%, transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash size={14} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

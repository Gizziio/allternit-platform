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
  ProjectMenuButton,
} from '../BaseProjectView';
import { cn } from '@/lib/utils';
import { ChatComposer } from '../chat/ChatComposer';

interface CoworkProjectViewProps {
  projectId?: string;
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
    updateProjectInstructions,
    activeTaskId,
    setActiveTask,
  } = useCoworkStore();

  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState('tasks');
  const [isStarred, setIsStarred] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState('');

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
    setRenameValue(project?.title ?? '');
    setIsRenamingProject(true);
  };

  const handleRenameConfirm = () => {
    if (renameValue.trim() && currentProjectId) {
      renameProject(currentProjectId, renameValue.trim());
    }
    setIsRenamingProject(false);
  };

  const handleRenameCancel = () => setIsRenamingProject(false);

  // Handle project delete
  const handleDelete = () => setIsDeletingProject(true);

  const handleDeleteConfirm = () => {
    if (currentProjectId) {
      deleteProject(currentProjectId);
      setActiveProject(null);
      dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
    }
    setIsDeletingProject(false);
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
          <button type="button"
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
      <button type="button"
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
      <button type="button"
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
      <button type="button"
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

  const handleSaveInstructions = () => {
    if (currentProjectId) {
      updateProjectInstructions(currentProjectId, instructionsValue);
    }
    setIsEditingInstructions(false);
  };

  const handleEditInstructions = () => {
    setInstructionsValue(project?.instructions ?? '');
    setIsEditingInstructions(true);
  };

  // Sidebar sections
  const sidebarSectionsData = {
    memory: null,
    onAddInstruction: handleEditInstructions,
    instructions: isEditingInstructions ? (
      <div>
        <textarea aria-label="Text Area" autoFocus
          value={instructionsValue}
          onChange={(e) => setInstructionsValue(e.target.value)}
          placeholder="Enter project instructions…"
          style={{
            width: '100%',
            minHeight: 80,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(200,169,110,0.25)',
            borderRadius: 8,
            color: 'var(--ui-text-primary)',
            fontSize: 12,
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
          <button type="button"
            onClick={() => setIsEditingInstructions(false)}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              color: 'var(--ui-text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button type="button"
            onClick={handleSaveInstructions}
            style={{
              padding: '5px 10px',
              background: 'rgba(200,169,110,0.14)',
              border: '1px solid rgba(200,169,110,0.30)',
              borderRadius: 6,
              color: 'rgba(236,236,236,0.9)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    ) : project?.instructions ? (
      <div
        role="button"
        tabIndex={0}
        onClick={handleEditInstructions}
        style={{
          fontSize: 12,
          color: 'var(--ui-text-secondary)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          cursor: 'pointer',
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(200,169,110,0.18)'; e.currentTarget.style.background = 'rgba(200,169,110,0.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
      >
        {project.instructions}
      </div>
    ) : (
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)', opacity: 0.5 }}>
        No instructions set.
      </p>
    ),
    files: (
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)', opacity: 0.5 }}>
        No sources added.
      </p>
    ),
  };

  return (
    <>
      {/* Rename project dialog */}
      {isRenamingProject && (
        <>
          <div
            role="button" tabIndex={0}
            onClick={handleRenameCancel}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRenameCancel(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10001,
            background: 'var(--surface-floating, #1a1714)',
            border: '1px solid rgba(200,169,110,0.22)',
            borderRadius: 14,
            padding: '20px 24px',
            minWidth: 320,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ui-text-primary)', marginBottom: 12 }}>
              Rename project
            </div>
            <input aria-label="Input" autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') handleRenameCancel();
              }}
              style={{
                width: '100%', padding: '9px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(200,169,110,0.25)',
                borderRadius: 8,
                color: 'var(--ui-text-primary)', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button"
                onClick={handleRenameCancel}
                style={{
                  padding: '7px 14px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7,
                  color: 'var(--ui-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button type="button"
                onClick={handleRenameConfirm}
                disabled={!renameValue.trim()}
                style={{
                  padding: '7px 14px',
                  background: 'rgba(200,169,110,0.14)',
                  border: '1px solid rgba(200,169,110,0.30)',
                  borderRadius: 7, color: 'rgba(236,236,236,0.9)',
                  fontSize: 12, fontWeight: 600, cursor: renameValue.trim() ? 'pointer' : 'not-allowed',
                  opacity: renameValue.trim() ? 1 : 0.4,
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete project confirmation dialog */}
      {isDeletingProject && (
        <>
          <div
            role="button" tabIndex={0}
            onClick={() => setIsDeletingProject(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDeletingProject(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10001,
            background: 'var(--surface-floating, #1a1714)',
            border: '1px solid rgba(248,113,113,0.22)',
            borderRadius: 14,
            padding: '20px 24px',
            minWidth: 300,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ui-text-primary)', marginBottom: 6 }}>
              Delete project?
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--ui-text-secondary)', lineHeight: 1.5 }}>
              All tasks in <strong style={{ color: 'var(--ui-text-primary)' }}>{project?.title}</strong> will be unassigned. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button"
                onClick={() => setIsDeletingProject(false)}
                style={{
                  padding: '7px 14px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7,
                  color: 'var(--ui-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button type="button"
                onClick={handleDeleteConfirm}
                style={{
                  padding: '7px 14px',
                  background: 'color-mix(in srgb, var(--status-error) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--status-error) 30%, transparent)',
                  borderRadius: 7, color: 'var(--status-error)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Delete project
              </button>
            </div>
          </div>
        </>
      )}

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
            : 'No sources added.',
          subMessage: activeTab === 'tasks'
            ? 'Create a task to get started with this project.'
            : activeTab === 'agent-tasks'
            ? 'Create an agent task to get autonomous assistance.'
            : 'Add sources to provide context for your project.',
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
          <div style={{ padding: '24px 0' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-secondary)', opacity: 0.5 }}>
              No sources added yet.
            </p>
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
      <div className="p-[16px_20px] bg-transparent rounded-xl border border-solid border-[var(--ui-border-default)] mb-2">
        <input aria-label="Input" type="text"
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
          className="w-full text-[14px] bg-transparent border-none outline-none text-[var(--ui-text-primary)]"
        />
      </div>
    );
  }

  return (
    <div role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={cn(
        "p-[16px_20px] rounded-xl border border-solid cursor-pointer flex items-center gap-3 transition-colors mb-2 group",
        isActive 
          ? "bg-[var(--surface-active)] border-[var(--ui-border-default)]" 
          : "bg-transparent border-[var(--ui-border-muted)] hover:bg-[var(--surface-hover)] hover:border-[var(--ui-border-default)]"
      )}
    >
      {/* Status dot */}
      <div className={cn(
        "size-2 rounded-full shrink-0",
        task.status === 'completed' ? "bg-[var(--status-success)]" :
        task.status === 'in_progress' ? "bg-[var(--accent-primary)]" : "bg-[var(--ui-text-muted)]"
      )} />

      {/* Icon */}
      <div className="size-9 rounded-[10px] bg-[var(--surface-hover)] flex items-center justify-center text-[var(--ui-text-secondary)] shrink-0">
        {isAgent ? <Robot size={18} /> : <CheckSquare size={18} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-[14px] truncate",
          isActive ? "font-semibold text-[var(--accent-primary)]" : "font-medium text-[var(--ui-text-primary)]"
        )}>
          {task.title}
        </div>
        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
          {isAgent ? 'Agent task' : 'Task'} • {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Menu */}
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button type="button"
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            "size-7 rounded-md border-none cursor-pointer flex items-center justify-center transition-colors",
            showMenu ? "bg-[var(--surface-active)] text-[var(--ui-text-primary)]" : "bg-transparent text-[var(--ui-text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-secondary)]"
          )}
        >
          <DotsThreeOutline size={16} />
        </button>

        {showMenu && (
          <>
            <div
              role="button" tabIndex={0}
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowMenu(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMenu(false); }}
            />
            <div className="absolute top-full right-0 mt-1 min-w-[140px] bg-[var(--surface-floating)] rounded-lg border border-solid border-[var(--ui-border-muted)] shadow-[var(--shadow-lg)] z-[9999] overflow-hidden py-1">
              <button type="button"
                onClick={() => {
                  setEditTitle(task.title);
                  setIsEditing(true);
                  setShowMenu(false);
                }}
                className="w-full p-[8px_12px] border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2 text-[12px] text-left hover:bg-[var(--surface-hover)] transition-colors"
              >
                <PencilSimple size={14} />
                Rename
              </button>
              <button type="button"
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full p-[8px_12px] border-none bg-transparent text-[var(--status-error)] cursor-pointer flex items-center gap-2 text-[12px] text-left hover:bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] transition-colors"
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

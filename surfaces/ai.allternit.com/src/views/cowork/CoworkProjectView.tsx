"use client";

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  BaseProjectView,
  ProjectMenuButton,
  InstructionItem,
  ProjectEditDetailsModal,
} from '../BaseProjectView';
import { ChatComposer } from '../chat/ChatComposer';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { useCoworkStore } from './CoworkStore';
import { useCoworkSessionStore, createCoworkSession } from './CoworkSessionStore';
import { useNav } from '@/nav/useNav';
import { useMode } from '@/providers/mode-provider';
import {
  CheckSquare,
  Robot,
  PencilSimple,
  Archive,
  Trash,
  DotsThreeOutline,
} from '@phosphor-icons/react';

interface CoworkProjectViewProps {
  projectId?: string;
  onBack?: () => void;
}

export function CoworkProjectView({ projectId, onBack: externalOnBack }: CoworkProjectViewProps) {
  const {
    projects,
    tasks,
    activeProjectId: storeActiveProjectId,
    setActiveProject,
    createTask,
    deleteTask,
    renameTask,
    deleteProject,
    updateProjectDetails,
    updateProjectInstructions,
    bindSessionToTask,
    activeTaskId,
    setActiveTask,
    toggleProjectFavorite,
    toggleProjectArchive,
  } = useCoworkStore();

  const { dispatch } = useNav();
  const { setMode } = useMode();
  const defaultSelection = useDefaultModelSelection();

  const currentProjectId = projectId || storeActiveProjectId;
  const project = useMemo(
    () => projects.find((p) => p.id === currentProjectId),
    [projects, currentProjectId]
  );

  const [activeTab, setActiveTab] = useState('tasks');
  const [composerInput, setComposerInput] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState('');

  const projectTasks = useMemo(
    () => (tasks || []).filter((t) => t.projectId === currentProjectId && t.mode !== 'agent'),
    [tasks, currentProjectId]
  );

  const projectAgentTasks = useMemo(
    () => (tasks || []).filter((t) => t.projectId === currentProjectId && t.mode === 'agent'),
    [tasks, currentProjectId]
  );

  const displayTasks = activeTab === 'agent-tasks' ? projectAgentTasks : projectTasks;
  const hasContent = displayTasks.length > 0;

  const handleBack = () => {
    setActiveProject(null);
    if (externalOnBack) {
      externalOnBack();
    } else {
      dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
    }
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !currentProjectId) return;
    const mode = activeTab === 'agent-tasks' ? 'agent' : 'task';
    const task = createTask(trimmed.slice(0, 64), mode, currentProjectId);
    setActiveTask(task.id);
    setComposerInput('');
    try {
      const sessionId = await createCoworkSession({
        name: trimmed.slice(0, 64) || 'New Cowork Session',
        sessionMode: mode === 'agent' ? 'agent' : 'regular',
      });
      bindSessionToTask(task.id, sessionId);
      useCoworkSessionStore.getState().setActiveSession(sessionId);
      void useCoworkSessionStore.getState().sendMessageStream(sessionId, { text: trimmed });
    } catch {
      // Task exists even if the session could not start; still hand off.
    }
    setMode('cowork');
    dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
  };

  const handleOpenTask = (task: { id: string; sessionId?: string | null }) => {
    setActiveTask(task.id);
    useCoworkSessionStore.getState().setActiveSession(task.sessionId ?? null);
    setMode('cowork');
    dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
  };

  const handleNewTask = () => {
    if (!currentProjectId) return;
    const mode = activeTab === 'agent-tasks' ? 'agent' : 'task';
    createTask(`New ${mode === 'agent' ? 'Agent ' : ''}Task`, mode, currentProjectId);
  };

  const handleArchive = () => {
    if (!currentProjectId) return;
    toggleProjectArchive(currentProjectId);
    handleBack();
  };

  const handleDelete = () => {
    if (!currentProjectId) return;
    deleteProject(currentProjectId);
    handleBack();
    setShowDeleteModal(false);
  };

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

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ui-text-secondary)]">
        <div className="text-center">
          <p>Project not found</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-cowork)] text-white cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const menuContent = (
    <ProjectMenuButton>
      <button
        type="button"
        onClick={() => setShowRenameModal(true)}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <PencilSimple size={16} />
        Edit details
      </button>
      <button
        type="button"
        onClick={handleArchive}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <Archive size={16} />
        {project.isArchived ? 'Unarchive' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={() => setShowDeleteModal(true)}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--status-error)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--status-error-bg)] transition-colors"
      >
        <Trash size={16} />
        Delete
      </button>
    </ProjectMenuButton>
  );

  const inputBar = (
    <ModelSelectionProvider defaultSelection={defaultSelection}>
      <ChatComposer
        onSend={handleSend}
        placeholder={`Message ${project.title}`}
        inputValue={composerInput}
        showTopActions={false}
        showModeToggle={false}
        variant="default"
      />
    </ModelSelectionProvider>
  );

  const sidebarSectionsData = {
    memory: (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Tasks</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{projectTasks.length}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Agent tasks</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{projectAgentTasks.length}</span>
        </div>
        {project?.instructions && (
          <div className="mt-1 text-[12px] text-[var(--ui-text-muted)] leading-relaxed line-clamp-4">
            {project.instructions}
          </div>
        )}
        <p className="m-0 mt-1 text-[12px] text-[var(--ui-text-muted)] leading-relaxed">
          Memory will be built from tasks and runs in this project.
        </p>
      </div>
    ),
    onAddInstruction: handleEditInstructions,
    instructions: isEditingInstructions ? (
      <div>
        <textarea
          aria-label="Project instructions"
          autoFocus
          value={instructionsValue}
          onChange={(e) => setInstructionsValue(e.target.value)}
          placeholder="Enter project instructions…"
          className="w-full min-h-[80px] p-2.5 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--ui-border-default)] text-[var(--ui-text-primary)] text-[12px] leading-relaxed resize-y outline-none"
        />
        <div className="flex gap-1.5 mt-2 justify-end">
          <button
            type="button"
            onClick={() => setIsEditingInstructions(false)}
            className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-transparent border border-solid border-[var(--ui-border-default)] text-[var(--ui-text-secondary)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveInstructions}
            className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-[var(--accent-primary)]/15 border border-solid border-[var(--accent-primary)]/30 text-[var(--ui-text-primary)] cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    ) : project?.instructions ? (
      <InstructionItem text={project.instructions} onEdit={handleEditInstructions} />
    ) : (
      <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">No instructions set.</p>
    ),
    files: (
      <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
        Sources are managed per task in Cowork mode.
      </p>
    ),
  };

  return (
    <>
      <BaseProjectView
        title={project.title}
        description={project.description || 'Cowork project workspace'}
        onBack={handleBack}
        onToggleStar={() => toggleProjectFavorite(project.id)}
        isStarred={project.isFavorite ?? false}
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
          message:
            activeTab === 'tasks'
              ? 'Tasks will appear here.'
              : activeTab === 'agent-tasks'
              ? 'Agent tasks will appear here.'
              : 'No sources added.',
          subMessage:
            activeTab === 'tasks'
              ? 'Create a task to get started with this project.'
              : activeTab === 'agent-tasks'
              ? 'Create an agent task to get autonomous assistance.'
              : 'Add sources to provide context for your project.',
        }}
      >
        {(activeTab === 'tasks' || activeTab === 'agent-tasks') && (
          <div className="flex flex-col gap-3">
            {displayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isActive={activeTaskId === task.id}
                onClick={() => {
                  setActiveTask(task.id);
                  window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: 'cowork' } }));
                  dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
                }}
                onRename={(newTitle) => renameTask(task.id, newTitle)}
                onDelete={() => deleteTask(task.id)}
                isAgent={task.mode === 'agent'}
              />
            ))}
          </div>
        )}
        {activeTab === 'sources' && (
          <div className="py-6">
            <p className="text-sm text-[var(--ui-text-muted)]">
              Sources are attached to individual tasks. Select a task to view its sources.
            </p>
          </div>
        )}
      </BaseProjectView>

      <ProjectEditDetailsModal
        isOpen={showRenameModal}
        initialName={project.title}
        initialDescription={project.description}
        onConfirm={(details) => {
          updateProjectDetails(project.id, details);
          setShowRenameModal(false);
        }}
        onCancel={() => setShowRenameModal(false)}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Project"
        message={`Delete "${project.title}"? All tasks will be unassigned. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}

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
  const [showMenu, setShowMenu] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(task.title);

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 px-5 bg-transparent rounded-xl border border-solid border-[var(--ui-border-default)] mb-2">
        <input
          aria-label="Rename task"
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
          className="w-full text-sm bg-transparent border-none outline-none text-[var(--ui-text-primary)]"
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={cn(
        'p-4 px-5 rounded-xl border border-solid cursor-pointer flex items-center gap-3 transition-colors mb-2 group',
        isActive
          ? 'bg-[var(--surface-active)] border-[var(--ui-border-default)]'
          : 'bg-transparent border-[var(--ui-border-muted)] hover:bg-[var(--surface-hover)] hover:border-[var(--ui-border-default)]'
      )}
    >
      <div
        className={cn(
          'size-2 rounded-full shrink-0',
          task.status === 'completed'
            ? 'bg-[var(--status-success)]'
            : task.status === 'in_progress'
            ? 'bg-[var(--accent-primary)]'
            : 'bg-[var(--ui-text-muted)]'
        )}
      />

      <div className="size-9 rounded-[10px] bg-[var(--surface-hover)] flex items-center justify-center text-[var(--ui-text-secondary)] shrink-0">
        {isAgent ? <Robot size={18} /> : <CheckSquare size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm truncate',
            isActive
              ? 'font-semibold text-[var(--accent-primary)]'
              : 'font-medium text-[var(--ui-text-primary)]'
          )}
        >
          {task.title}
        </div>
        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
          {isAgent ? 'Agent task' : 'Task'} • {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'size-7 rounded-md border-none cursor-pointer flex items-center justify-center transition-colors',
            showMenu
              ? 'bg-[var(--surface-active)] text-[var(--ui-text-primary)]'
              : 'bg-transparent text-[var(--ui-text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-secondary)]'
          )}
        >
          <DotsThreeOutline size={16} />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute top-full right-0 mt-1 min-w-[140px] bg-[var(--surface-floating)] rounded-lg border border-solid border-[var(--ui-border-muted)] shadow-lg z-[9999] overflow-hidden py-1">
              <button
                type="button"
                onClick={() => {
                  setEditTitle(task.title);
                  setIsEditing(true);
                  setShowMenu(false);
                }}
                className="w-full p-2 px-3 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2 text-xs text-left hover:bg-[var(--surface-hover)] transition-colors"
              >
                <PencilSimple size={14} />
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full p-2 px-3 border-none bg-transparent text-[var(--status-error)] cursor-pointer flex items-center gap-2 text-xs text-left hover:bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] transition-colors"
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

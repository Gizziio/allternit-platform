"use client";

import React, { useMemo, useState } from 'react';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  BaseProjectView,
  ProjectItemCard,
  ProjectMenuButton,
  FileItem,
  InstructionItem,
} from '../BaseProjectView';
import { useCodeModeStore } from './CodeModeStore';
import { useCodeSessionStore, createCodeSession } from './CodeSessionStore';
import { ChatComposer } from '../chat/ChatComposer';
import { ResourceUsageDashboard } from '@/components/usage/ResourceUsageDashboard';
import {
  Terminal,
  PencilSimple,
  Archive,
  Trash,
  FileCode,
  Robot,
} from '@phosphor-icons/react';
import { useNav } from '@/nav/useNav';

interface CodeProjectViewProps {
  workspaceId?: string;
  onBack?: () => void;
}

export function CodeProjectView({ workspaceId, onBack: externalOnBack }: CodeProjectViewProps) {
  const {
    workspaces,
    activeWorkspaceId: storeActiveWorkspaceId,
    sessions,
    setActiveSession,
    setActiveWorkspace,
    renameWorkspace,
    deleteWorkspace,
    toggleWorkspaceFavorite,
    toggleWorkspaceArchive,
  } = useCodeModeStore();

  const { dispatch } = useNav();

  const [activeTab, setActiveTab] = useState('threads');
  const [composerInput, setComposerInput] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddInstruction, setShowAddInstruction] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instructionText, setInstructionText] = useState('');
  const [workspaceInstructions, setWorkspaceInstructions] = useState<string[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{ id: string; name: string; size: number }>>([]);

  const currentWorkspaceId = workspaceId || storeActiveWorkspaceId;
  const workspace = useMemo(
    () => workspaces.find((w) => w.workspace_id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );

  const workspaceThreads = useMemo(
    () => sessions.filter((s) => s.workspace_id === currentWorkspaceId && s.mode !== 'AUTO'),
    [sessions, currentWorkspaceId]
  );

  const workspaceAgentThreads = useMemo(
    () => sessions.filter((s) => s.workspace_id === currentWorkspaceId && s.mode === 'AUTO'),
    [sessions, currentWorkspaceId]
  );

  const displayThreads = activeTab === 'threads' ? workspaceThreads : workspaceAgentThreads;
  const hasContent = displayThreads.length > 0 || workspaceFiles.length > 0 || activeTab === 'telemetry';

  const handleBack = () => {
    setActiveWorkspace('');
    if (externalOnBack) {
      externalOnBack();
    } else {
      dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
    }
  };

  const createAndStreamCodeSession = async (text: string) => {
    if (!text.trim() || !currentWorkspaceId) return;
    const sessionId = await createCodeSession({
      name: text.slice(0, 64) || 'New Code Thread',
      workspaceId: currentWorkspaceId,
    });
    useCodeSessionStore.getState().setActiveSession(sessionId);
    setActiveSession(sessionId);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || !currentWorkspaceId) return;
    setComposerInput('');
    await createAndStreamCodeSession(text);
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleNewThread = async () => {
    if (!currentWorkspaceId) return;
    const sessionId = await createCodeSession({
      name: 'New Thread',
      workspaceId: currentWorkspaceId,
    });
    useCodeSessionStore.getState().setActiveSession(sessionId);
    setActiveSession(sessionId);
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSession(sessionId);
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleArchive = () => {
    if (!currentWorkspaceId) return;
    toggleWorkspaceArchive(currentWorkspaceId);
    handleBack();
  };

  const handleDelete = () => {
    if (!currentWorkspaceId) return;
    deleteWorkspace(currentWorkspaceId);
    handleBack();
    setShowDeleteModal(false);
  };

  const handleAddInstruction = () => {
    if (instructionText.trim()) {
      setWorkspaceInstructions([...workspaceInstructions, instructionText.trim()]);
      setInstructionText('');
    }
    setShowAddInstruction(false);
  };

  const handleAddFile = (name: string) => {
    setWorkspaceFiles([...workspaceFiles, { id: Date.now().toString(), name, size: 0 }]);
    setShowAddFile(false);
  };

  if (!workspace) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ui-text-secondary)]">
        <div className="text-center">
          <p>Select a workspace to view</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-code)] text-white cursor-pointer"
          >
            Back
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
        {workspace.isArchived ? 'Unarchive' : 'Archive'}
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
    <ChatComposer
      onSend={handleSend}
      placeholder={`Message ${workspace.display_name}`}
      inputValue={composerInput}
      showTopActions={false}
      variant="default"
    />
  );

  const sidebarSectionsData = {
    memory: null,
    instructions:
      workspaceInstructions.length > 0 ? (
        <div>
          {workspaceInstructions.map((instruction, idx) => (
            <InstructionItem
              key={`code-project-${idx}`}
              text={instruction}
              onDelete={() =>
                setWorkspaceInstructions(workspaceInstructions.filter((_, i) => i !== idx))
              }
            />
          ))}
        </div>
      ) : null,
    files:
      workspaceFiles.length > 0 ? (
        <div>
          {workspaceFiles.map((file) => (
            <FileItem
              key={file.id}
              name={file.name}
              size={formatFileSize(file.size)}
              onDelete={() => setWorkspaceFiles(workspaceFiles.filter((f) => f.id !== file.id))}
            />
          ))}
        </div>
      ) : null,
    onAddInstruction: () => setShowAddInstruction(true),
    onAddFile: () => setShowAddFile(true),
  };

  return (
    <>
      <BaseProjectView
        title={workspace.display_name}
        description="Code workspace"
        onBack={handleBack}
        onToggleStar={() => toggleWorkspaceFavorite(workspace.workspace_id)}
        isStarred={workspace.isFavorite ?? false}
        tabs={[
          { id: 'threads', label: 'Threads', count: workspaceThreads.length },
          { id: 'agent-threads', label: 'Agent Threads', count: workspaceAgentThreads.length },
          { id: 'telemetry', label: 'Telemetry' },
          { id: 'sources', label: 'Sources', count: workspaceFiles.length },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewItem={handleNewThread}
        newButtonLabel="New Thread"
        menuContent={menuContent}
        inputBar={inputBar}
        sidebarSections={sidebarSectionsData}
        showEmptyState={!hasContent}
        emptyState={{
          message:
            activeTab === 'threads'
              ? 'Threads will appear here.'
              : activeTab === 'agent-threads'
              ? 'Agent threads will appear here.'
              : activeTab === 'telemetry'
              ? 'Workspace telemetry will appear here.'
              : 'Sources will appear here.',
          subMessage:
            activeTab === 'threads'
              ? 'Start a thread to get started with this workspace.'
              : activeTab === 'agent-threads'
              ? 'Start an agent thread to get autonomous assistance.'
              : activeTab === 'telemetry'
              ? 'Resource usage and runtime metrics are shown here.'
              : 'Add files to reference them in this workspace.',
        }}
      >
        {activeTab === 'telemetry' && (
          <div className="py-5">
            <ResourceUsageDashboard />
          </div>
        )}
        {(activeTab === 'threads' || activeTab === 'agent-threads') && (
          <div className="flex flex-col gap-3">
            {displayThreads.map((session) => (
              <ProjectItemCard
                key={session.session_id}
                title={session.title}
                subtitle={formatDate(session.updated_at)}
                onClick={() => handleSessionSelect(session.session_id)}
                icon={activeTab === 'agent-threads' ? <Robot size={18} /> : <Terminal size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'sources' && (
          <div className="flex flex-col gap-3">
            {workspaceFiles.map((file) => (
              <ProjectItemCard
                key={file.id}
                title={file.name}
                subtitle={formatFileSize(file.size)}
                icon={<FileCode size={18} />}
              />
            ))}
          </div>
        )}
      </BaseProjectView>

      <InputModal
        isOpen={showRenameModal}
        title="Rename Workspace"
        placeholder="Workspace name"
        defaultValue={workspace.display_name}
        confirmLabel="Rename"
        onConfirm={(name) => {
          renameWorkspace(workspace.workspace_id, name);
          setShowRenameModal(false);
        }}
        onCancel={() => setShowRenameModal(false)}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Workspace"
        message={`Delete "${workspace.display_name}"? All threads will be unassigned.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      <InputModal
        isOpen={showAddFile}
        title="Add File"
        placeholder="File name"
        confirmLabel="Add"
        onConfirm={handleAddFile}
        onCancel={() => setShowAddFile(false)}
      />

      <InputModal
        isOpen={showAddInstruction}
        title="Set Workspace Instructions"
        placeholder="Specific rules for this workspace…"
        confirmLabel="Save"
        defaultValue={instructionText}
        onConfirm={(text) => {
          setInstructionText(text);
          handleAddInstruction();
        }}
        onCancel={() => setShowAddInstruction(false)}
      />
    </>
  );
}

function formatDate(isoString: string): string {
  if (!isoString) return 'unknown';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return date.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

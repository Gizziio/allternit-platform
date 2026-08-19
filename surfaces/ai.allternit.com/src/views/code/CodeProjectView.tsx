"use client";

import React, { useMemo, useRef, useState } from 'react';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from '@/components/ui/Modal';
import {
  BaseProjectView,
  ProjectItemCard,
  ProjectMenuButton,
  FileItem,
  InstructionItem,
  ProjectEditDetailsModal,
} from '../BaseProjectView';
import { useMode } from '@/providers/mode-provider';
import { useCodeModeStore, type CodeWorkspaceFile } from './CodeModeStore';
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
    updateWorkspaceDetails,
    updateWorkspaceInstructions,
    deleteWorkspace,
    addWorkspaceFile,
    removeWorkspaceFile,
    toggleWorkspaceFavorite,
    toggleWorkspaceArchive,
  } = useCodeModeStore();

  const { dispatch } = useNav();
  const { setMode } = useMode();

  const [activeTab, setActiveTab] = useState('threads');
  const [composerInput, setComposerInput] = useState('');
  const [showAddInstruction, setShowAddInstruction] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instructionText, setInstructionText] = useState('');
  const [previewFile, setPreviewFile] = useState<CodeWorkspaceFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentWorkspaceId = workspaceId || storeActiveWorkspaceId;
  const workspace = useMemo(
    () => workspaces.find((w) => w.workspace_id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );

  const workspaceInstructions = workspace?.instructions || [];

  const workspaceThreads = useMemo(
    () => sessions.filter((s) => s.workspace_id === currentWorkspaceId && s.mode !== 'AUTO'),
    [sessions, currentWorkspaceId]
  );

  const workspaceAgentThreads = useMemo(
    () => sessions.filter((s) => s.workspace_id === currentWorkspaceId && s.mode === 'AUTO'),
    [sessions, currentWorkspaceId]
  );

  const displayThreads = activeTab === 'threads' ? workspaceThreads : workspaceAgentThreads;
  const workspaceFiles = workspace?.files ?? [];
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

  const openCodingView = () => {
    setMode('code');
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !currentWorkspaceId) return;
    setComposerInput('');
    await createAndStreamCodeSession(trimmed);
    const sessionId = useCodeSessionStore.getState().activeSessionId;
    if (sessionId) {
      void useCodeSessionStore.getState().sendMessageStream(sessionId, { text: trimmed });
    }
    openCodingView();
  };

  const handleNewThread = async () => {
    if (!currentWorkspaceId) return;
    const sessionId = await createCodeSession({
      name: 'New Thread',
      workspaceId: currentWorkspaceId,
    });
    useCodeSessionStore.getState().setActiveSession(sessionId);
    setActiveSession(sessionId);
    openCodingView();
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSession(sessionId);
    openCodingView();
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

  const handleAddInstruction = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && currentWorkspaceId) {
      updateWorkspaceInstructions(currentWorkspaceId, [...(workspace?.instructions ?? []), trimmed]);
      setInstructionText('');
    }
    setShowAddInstruction(false);
  };

  const handleRemoveInstruction = (index: number) => {
    if (!currentWorkspaceId) return;
    updateWorkspaceInstructions(
      currentWorkspaceId,
      (workspace?.instructions ?? []).filter((_, i) => i !== index)
    );
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentWorkspaceId) return;
    try {
      const content = await file.text();
      addWorkspaceFile(currentWorkspaceId, {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        content,
      });
    } catch {
      addWorkspaceFile(currentWorkspaceId, {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
    }
    event.target.value = '';
  };

  const handleAddFileClick = () => {
    fileInputRef.current?.click();
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
    memory: (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Threads</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{workspaceThreads.length}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Agent threads</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{workspaceAgentThreads.length}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Sources</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{workspaceFiles.length}</span>
        </div>
        {workspace?.root_path && (
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--ui-text-muted)]">Path</span>
            <span className="text-[var(--ui-text-secondary)] font-medium truncate max-w-[140px]" title={workspace.root_path}>
              {workspace.root_path}
            </span>
          </div>
        )}
        <p className="m-0 mt-1 text-[12px] text-[var(--ui-text-muted)] leading-relaxed">
          Memory will be built from code sessions in this workspace.
        </p>
      </div>
    ),
    instructions:
      (workspace?.instructions ?? []).length > 0 ? (
        <div>
          {(workspace?.instructions ?? []).map((instruction, idx) => (
            <InstructionItem
              key={`code-project-${idx}`}
              text={instruction}
              onDelete={() => handleRemoveInstruction(idx)}
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
              onDelete={() => removeWorkspaceFile(currentWorkspaceId, file.id)}
            />
          ))}
        </div>
      ) : null,
    onAddInstruction: () => setShowAddInstruction(true),
    onAddFile: handleAddFileClick,
  };

  return (
    <>
      <BaseProjectView
        title={workspace.display_name}
        description={workspace.description || workspace.root_path || 'Code workspace'}
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
                onClick={() => setPreviewFile(file)}
              />
            ))}
          </div>
        )}
      </BaseProjectView>

      <ProjectEditDetailsModal
        isOpen={showRenameModal}
        initialName={workspace.display_name}
        initialDescription={workspace.description}
        onConfirm={(details) => {
          updateWorkspaceDetails(workspace.workspace_id, {
            displayName: details.title,
            description: details.description,
          });
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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Add file to workspace"
      />

      <InputModal
        isOpen={showAddInstruction}
        title="Set Workspace Instructions"
        placeholder="Specific rules for this workspace…"
        confirmLabel="Save"
        defaultValue={instructionText}
        onConfirm={(text) => {
          setInstructionText(text);
          handleAddInstruction(text);
        }}
        onCancel={() => setShowAddInstruction(false)}
      />

      <Modal isOpen={previewFile !== null} onClose={() => setPreviewFile(null)} size="medium">
        <ModalHeader
          title={previewFile?.name ?? 'File preview'}
          onClose={() => setPreviewFile(null)}
        />
        <ModalBody>
          {previewFile?.content ? (
            <pre className="m-0 p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--ui-border-default)] text-[var(--ui-text-secondary)] text-[12px] leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-auto">
              {previewFile.content}
            </pre>
          ) : (
            <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
              {previewFile?.type?.startsWith('text/') || previewFile?.type?.startsWith('application/json')
                ? 'No preview content available for this file.'
                : 'Binary files cannot be previewed.'}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={() => setPreviewFile(null)} variant="secondary">
            Close
          </ModalButton>
        </ModalFooter>
      </Modal>
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

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
} from '@/views/BaseProjectView';
import { ChatComposer } from '@/views/chat/ChatComposer';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { useChatStore, type ProjectFile } from '@/views/chat/ChatStore';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useMiniAppDiscovery } from '@/views/aci/use-mini-app-discovery';
import { useNav } from '@/nav/useNav';
import {
  Chat,
  PencilSimple,
  Archive,
  Trash,
  FileText,
  Robot,
  Cpu,
  Globe,
  Lightning,
  PlugsConnected,
  Plus,
  X,
} from '@phosphor-icons/react';

interface ChatProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export function ChatProjectDetail({ projectId, onBack }: ChatProjectDetailProps) {
  const {
    projects,
    threads,
    setActiveThread,
    addFileToProject,
    removeFileFromProject,
    addConnectorToProject,
    removeConnectorFromProject,
    deleteProject,
    createThread,
    updateProjectDetails,
    updateProjectInstructions,
    toggleProjectFavorite,
    toggleProjectArchive,
  } = useChatStore();

  const { dispatch } = useNav();
  const { all: allMiniApps } = useMiniAppDiscovery();
  const defaultSelection = useDefaultModelSelection();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const [activeTab, setActiveTab] = useState('chats');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showAddInstruction, setShowAddInstruction] = useState(false);
  const [instructionText, setInstructionText] = useState('');
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectThreads = useMemo(
    () => threads.filter((t) => t.projectId === projectId && t.mode !== 'agent'),
    [threads, projectId]
  );

  const projectAgentSessions = useMemo(
    () => threads.filter((t) => t.projectId === projectId && t.mode === 'agent'),
    [threads, projectId]
  );

  const projectInstructions = project?.instructions || [];
  const projectFiles = project?.files || [];
  const projectConnectorIds = project?.connectors || [];
  const attachedConnectors = allMiniApps.filter((app) => projectConnectorIds.includes(app.id));
  const availableConnectors = allMiniApps.filter((app) => !projectConnectorIds.includes(app.id));

  const hasContent = useMemo(() => {
    switch (activeTab) {
      case 'chats':
        return projectThreads.length > 0;
      case 'agent-sessions':
        return projectAgentSessions.length > 0;
      case 'sources':
        return projectFiles.length > 0;
      case 'connectors':
        return attachedConnectors.length > 0;
      default:
        return false;
    }
  }, [activeTab, projectThreads.length, projectAgentSessions.length, projectFiles.length, attachedConnectors.length]);

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ui-text-secondary)]">
        <div className="text-center">
          <p>Project not found</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white cursor-pointer"
          >
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    const sessionId = await createThread(trimmed.slice(0, 50) || 'New Chat', project.id);
    useChatSessionStore.getState().setActiveSession(sessionId);
    if (trimmed) {
      void useChatSessionStore.getState().sendMessageStream(sessionId, { text: trimmed });
    }
    dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
  };

  const handleNewChat = async () => {
    const sessionId = await createThread('New Chat', project.id);
    useChatSessionStore.getState().setActiveSession(sessionId);
    dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      addFileToProject(project.id, {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        content,
      });
    } catch {
      addFileToProject(project.id, {
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

  const handleAddConnector = (connectorId: string) => {
    addConnectorToProject(project.id, connectorId);
    setShowAddConnector(false);
  };

  const handleRemoveFile = (fileId: string) => {
    setConfirmDialog({
      message: 'Remove this file from the project?',
      onConfirm: () => {
        setConfirmDialog(null);
        removeFileFromProject(project.id, fileId);
      },
    });
  };

  const handleRemoveConnector = (connectorId: string) => {
    setConfirmDialog({
      message: 'Remove this connector from the project?',
      onConfirm: () => {
        setConfirmDialog(null);
        removeConnectorFromProject(project.id, connectorId);
      },
    });
  };

  const handleAddInstruction = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      updateProjectInstructions(project.id, [...(project.instructions ?? []), trimmed]);
      setInstructionText('');
    }
    setShowAddInstruction(false);
  };

  const handleRemoveInstruction = (index: number) => {
    updateProjectInstructions(
      project.id,
      (project.instructions ?? []).filter((_, i) => i !== index)
    );
  };

  const handleArchive = () => {
    toggleProjectArchive(project.id);
    onBack();
  };

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
        onClick={() =>
          setConfirmDialog({
            message: 'Delete this project? All chats in this project will be unlinked but not deleted.',
            onConfirm: () => {
              setConfirmDialog(null);
              deleteProject(project.id);
              onBack();
            },
          })
        }
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
          <span className="text-[var(--ui-text-muted)]">Threads</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{projectThreads.length}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Agent sessions</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{projectAgentSessions.length}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-[var(--ui-text-muted)]">Sources</span>
          <span className="text-[var(--ui-text-secondary)] font-medium">{projectFiles.length}</span>
        </div>
        <p className="m-0 mt-1 text-[12px] text-[var(--ui-text-muted)] leading-relaxed">
          Memory will be built from conversations in this project.
        </p>
      </div>
    ),
    instructions:
      (project.instructions ?? []).length > 0 ? (
        <div>
          {(project.instructions ?? []).map((instruction, idx) => (
            <InstructionItem
              key={`chat-project-${idx}`}
              text={instruction}
              onDelete={() => handleRemoveInstruction(idx)}
            />
          ))}
        </div>
      ) : null,
    files:
      projectFiles.length > 0 ? (
        <div>
          {projectFiles.map((file) => (
            <FileItem
              key={file.id}
              name={file.name}
              size={formatFileSize(file.size)}
              onDelete={() => handleRemoveFile(file.id)}
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
        title={project.title}
        description={project.description || 'Chat project workspace'}
        onBack={onBack}
        onToggleStar={() => toggleProjectFavorite(project.id)}
        isStarred={project.isFavorite ?? false}
        tabs={[
          { id: 'chats', label: 'Chats', count: projectThreads.length },
          { id: 'agent-sessions', label: 'Agent Sessions', count: projectAgentSessions.length },
          { id: 'sources', label: 'Sources', count: projectFiles.length },
          { id: 'connectors', label: 'Connectors', count: attachedConnectors.length },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewItem={handleNewChat}
        newButtonLabel="New Chat"
        menuContent={menuContent}
        inputBar={inputBar}
        sidebarSections={sidebarSectionsData}
        showEmptyState={!hasContent}
        emptyState={{
          message:
            activeTab === 'chats'
              ? 'Chats will appear here.'
              : activeTab === 'agent-sessions'
              ? 'Agent sessions will appear here.'
              : activeTab === 'connectors'
              ? 'Connectors will appear here.'
              : 'Sources will appear here.',
          subMessage:
            activeTab === 'chats'
              ? 'Start a chat to keep conversations organized and re-use project knowledge.'
              : activeTab === 'agent-sessions'
              ? 'Start an agent session to get autonomous assistance with this project.'
              : activeTab === 'connectors'
              ? 'Attach OpenClaw, Hermes, and other mini-apps to this project.'
              : 'Add files to reference them in this project.',
        }}
      >
        {activeTab === 'chats' && (
          <div className="flex flex-col gap-3">
            {projectThreads.map((thread) => (
              <ProjectItemCard
                key={thread.id}
                title={thread.title}
                subtitle={formatDate(thread.updatedAt)}
                onClick={() => {
                  setActiveThread(thread.id);
                  dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
                }}
                icon={<Chat size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'agent-sessions' && (
          <div className="flex flex-col gap-3">
            {projectAgentSessions.map((session) => (
              <ProjectItemCard
                key={session.id}
                title={session.title}
                subtitle={formatDate(session.updatedAt)}
                onClick={() => {
                  setActiveThread(session.id);
                  dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
                }}
                icon={<Robot size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'sources' && (
          <div className="flex flex-col gap-3">
            {projectFiles.map((file) => (
              <ProjectItemCard
                key={file.id}
                title={file.name}
                subtitle={formatFileSize(file.size)}
                icon={<FileText size={18} />}
                onClick={() => setPreviewFile(file)}
              />
            ))}
          </div>
        )}
        {activeTab === 'connectors' && (
          <div className="flex flex-col gap-3">
            {attachedConnectors.map((connector) => (
              <ProjectItemCard
                key={connector.id}
                title={connector.name}
                subtitle={connector.description}
                icon={getConnectorIcon(connector.category)}
                actions={
                  <button
                    type="button"
                    onClick={() => handleRemoveConnector(connector.id)}
                    className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--status-error)] transition-colors border-none bg-transparent cursor-pointer"
                    title="Remove connector"
                  >
                    <X size={14} />
                  </button>
                }
              />
            ))}
            {availableConnectors.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddConnector((value) => !value)}
                  className="flex items-center gap-2 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] cursor-pointer transition-colors"
                >
                  <Plus size={14} />
                  Add connector
                </button>
                {showAddConnector && (
                  <div className="rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] p-2 flex flex-col gap-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    {availableConnectors.map((connector) => (
                      <button
                        type="button"
                        key={connector.id}
                        onClick={() => handleAddConnector(connector.id)}
                        className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--ui-text-secondary)] hover:bg-[var(--surface-active)] hover:text-white border-none bg-transparent cursor-pointer transition-colors"
                      >
                        {getConnectorIcon(connector.category)}
                        <span className="flex-1">{connector.name}</span>
                        <Plus size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Add file to project"
      />

      <InputModal
        isOpen={showAddInstruction}
        title="Add Instruction"
        placeholder="Instruction text"
        confirmLabel="Add"
        defaultValue={instructionText}
        onConfirm={(text) => {
          setInstructionText(text);
          handleAddInstruction(text);
        }}
        onCancel={() => setShowAddInstruction(false)}
      />

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title="Confirm"
        message={confirmDialog?.message || ''}
        confirmLabel="Confirm"
        destructive
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
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

function getConnectorIcon(category: string) {
  switch (category) {
    case 'runtime':
      return <Cpu size={18} />;
    case 'connector':
      return <PlugsConnected size={18} />;
    case 'data':
      return <Lightning size={18} />;
    default:
      return <Globe size={18} />;
  }
}

function formatDate(date: string | number) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

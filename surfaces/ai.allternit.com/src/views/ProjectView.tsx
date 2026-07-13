"use client";

import React, { useCallback, useMemo } from 'react';
import { InputModal } from '@/components/InputModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { 
  BaseProjectView, 
  ProjectItemCard,
  ProjectMenuButton,
  FileItem,
  InstructionItem,
} from './BaseProjectView';
import { ChatComposer } from './chat/ChatComposer';
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

// Modularized ProjectView components
import { useProjectManager } from './project/main/useProjectManager';
import { ProjectViewHeader } from './project/main/ProjectViewHeader';
import { ProjectViewOverview } from './project/main/ProjectViewOverview';
import { useChatStore } from '@/views/chat/ChatStore';
import { useCoworkStore } from '@/views/cowork/CoworkStore';
import { useCodeModeStore } from '@/views/code/CodeModeStore';
import { useMode } from '@/providers/mode-provider';

export function ProjectView(): React.ReactNode {
  const {
    project,
    activeTab,
    setActiveTab,
    isStarred,
    setIsStarred,
    composerInput,
    setComposerInput,
    showAddFile,
    setShowAddFile,
    showRenameModal,
    setShowRenameModal,
    showAddInstruction,
    setShowAddInstruction,
    instructionText,
    setInstructionText,
    projectInstructions,
    setProjectInstructions,
    showAddConnector,
    setShowAddConnector,
    confirmDialog,
    setConfirmDialog,
    projectThreads,
    projectAgentSessions,
    projectFiles,
    attachedConnectors,
    availableConnectors,
    hasContent,
    setActiveThread,
    setActiveProject,
    removeFileFromProject,
    removeConnectorFromProject,
    renameProject,
    deleteProject,
    handleSend,
    handleAddFile,
    handleAddConnector,
    dispatch,
  } = useProjectManager();

  const chatStore = useChatStore();
  const coworkStore = useCoworkStore();
  const codeStore = useCodeModeStore();
  const { setMode } = useMode();

  if (!project) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-[var(--shell-item-fg)] font-serif mb-2">Projects</h1>
          <p className="text-[var(--shell-item-muted)] text-sm">Centralized view of all your projects across Chat, Cowork, and Code.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Chat Projects */}
          {chatStore.projects.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                chatStore.setActiveProject(p.id);
                setMode('chat');
                dispatch({ type: 'OPEN_VIEW', viewType: 'project' });
              }}
              className="group p-5 rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] hover:border-[var(--accent-chat)] cursor-pointer transition-all duration-200 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent-chat)_15%,transparent)] text-[var(--accent-chat)] border border-solid border-[var(--accent-chat)]/25">
                  Chat
                </span>
                <span className="text-[11px] text-[var(--shell-item-muted)]">
                  {p.threadIds?.length || 0} threads
                </span>
              </div>
              <h3 className="font-bold text-base text-[var(--shell-item-fg)] group-hover:text-[var(--accent-chat)] transition-colors">
                {p.title}
              </h3>
            </div>
          ))}

          {/* Cowork Projects */}
          {coworkStore.projects.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                coworkStore.setActiveProject(p.id);
                setMode('cowork');
                dispatch({ type: 'OPEN_VIEW', viewType: 'workspace' });
              }}
              className="group p-5 rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] hover:border-[var(--accent-cowork)] cursor-pointer transition-all duration-200 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent-cowork)_15%,transparent)] text-[var(--accent-cowork)] border border-solid border-[var(--accent-cowork)]/25">
                  Cowork
                </span>
                <span className="text-[11px] text-[var(--shell-item-muted)]">
                  Active
                </span>
              </div>
              <h3 className="font-bold text-base text-[var(--shell-item-fg)] group-hover:text-[var(--accent-cowork)] transition-colors">
                {p.title}
              </h3>
            </div>
          ))}

          {/* Code Workspaces */}
          {codeStore.workspaces.map((ws) => (
            <div
              key={ws.workspace_id}
              onClick={() => {
                codeStore.setActiveWorkspace(ws.workspace_id);
                setMode('code');
                dispatch({ type: 'OPEN_VIEW', viewType: 'code-project' });
              }}
              className="group p-5 rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] hover:bg-[var(--surface-active)] hover:border-[var(--accent-code)] cursor-pointer transition-all duration-200 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent-code)_15%,transparent)] text-[var(--accent-code)] border border-solid border-[var(--accent-code)]/25">
                  Code
                </span>
                <span className="text-[11px] text-[var(--shell-item-muted)]">
                  Workspace
                </span>
              </div>
              <h3 className="font-bold text-base text-[var(--shell-item-fg)] group-hover:text-[var(--accent-code)] transition-colors">
                {ws.display_name}
              </h3>
            </div>
          ))}

          {/* Create New Card */}
          <div
            onClick={() => {
              chatStore.createProject('New Project');
            }}
            className="p-5 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-transparent hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)] cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[140px] text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)]"
          >
            <Plus size={24} weight="bold" />
            <span className="font-bold text-sm">New Project</span>
          </div>
        </div>
      </div>
    );
  }

  const handleBack = () => setActiveProject(null);
  const handleNewChat = () => dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });

  const handleRemoveFile = (fileId: string) => {
    setConfirmDialog({
      message: 'Remove this file from the project?',
      onConfirm: () => { setConfirmDialog(null); removeFileFromProject(project.id, fileId); },
    });
  };

  const handleRemoveConnector = (connectorId: string) => {
    setConfirmDialog({
      message: 'Remove this connector from the project?',
      onConfirm: () => { setConfirmDialog(null); removeConnectorFromProject(project.id, connectorId); },
    });
  };

  const handleAddInstruction = () => {
    if (instructionText.trim()) {
      setProjectInstructions([...projectInstructions, instructionText.trim()]);
      setInstructionText('');
    }
    setShowAddInstruction(false);
  };

  const handleRemoveInstruction = (index: number) => {
    setProjectInstructions(projectInstructions.filter((_, i) => i !== index));
  };

  // Menu content for the 3-dot menu
  const menuContent = (
    <ProjectMenuButton>
      <button type="button"
        onClick={() => setShowRenameModal(true)}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <PencilSimple size={16} />
        Edit details
      </button>
      <button type="button"
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <Archive size={16} />
        Archive
      </button>
      <button type="button"
        onClick={() => setConfirmDialog({
          message: 'Delete this project? All chats in this project will be unlinked but not deleted.',
          onConfirm: () => { setConfirmDialog(null); deleteProject(project.id); setActiveProject(null); },
        })}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--status-error)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--status-error-bg)] transition-colors"
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

  // Sidebar sections with actual data
  const sidebarSectionsData = {
    memory: null, // Uses default
    instructions: projectInstructions.length > 0 ? (
      <div>
        {projectInstructions.map((instruction, idx) => (
          <InstructionItem
            key={`projectview-${idx}`}
            text={instruction}
            onDelete={() => handleRemoveInstruction(idx)}
          />
        ))}
      </div>
    ) : null,
    files: projectFiles.length > 0 ? (
      <div>
        {projectFiles.map(file => (
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
    onAddFile: () => setShowAddFile(true),
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
          message: activeTab === 'chats' 
            ? 'Chats will appear here.' 
            : activeTab === 'agent-sessions'
            ? 'Agent sessions will appear here.'
            : activeTab === 'connectors'
            ? 'Connectors will appear here.'
            : 'Sources will appear here.',
          subMessage: activeTab === 'chats'
            ? 'Start a chat to keep conversations organized and re-use project knowledge.'
            : activeTab === 'agent-sessions'
            ? 'Start an agent session to get autonomous assistance with this project.'
            : activeTab === 'connectors'
            ? 'Attach OpenClaw, Hermes, and other mini-apps to this project.'
            : 'Add files to reference them in this project.',
        }}
      >
        {/* Content based on active tab */}
        {activeTab === 'chats' && (
          <div className="flex flex-col gap-3">
            {projectThreads.map(thread => (
              <ProjectItemCard
                key={thread.id}
                title={thread.title}
                subtitle={formatDate(thread.updatedAt)}
                onClick={() => setActiveThread(thread.id)}
                icon={<Chat size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'agent-sessions' && (
          <div className="flex flex-col gap-3">
            {projectAgentSessions.map(session => (
              <ProjectItemCard
                key={session.id}
                title={session.title}
                subtitle={formatDate(session.updatedAt)}
                onClick={() => setActiveThread(session.id)}
                icon={<Robot size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'sources' && (
          <div className="flex flex-col gap-3">
            {projectFiles.map(file => (
              <ProjectItemCard
                key={file.id}
                title={file.name}
                subtitle={formatFileSize(file.size)}
                icon={<FileText size={18} />}
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
                  <button type="button"
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
                <button type="button"
                  onClick={() => setShowAddConnector((value) => !value)}
                  className="flex items-center gap-2 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] cursor-pointer transition-colors"
                >
                  <Plus size={14} />
                  Add connector
                </button>
                {showAddConnector && (
                  <div className="rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] p-2 flex flex-col gap-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    {availableConnectors.map((connector) => (
                      <button type="button"
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

      {/* Rename Modal */}
      <InputModal
        isOpen={showRenameModal}
        title="Rename Project"
        placeholder="Project name"
        defaultValue={project.title}
        confirmLabel="Rename"
        onConfirm={(name) => {
          renameProject(project.id, name);
          setShowRenameModal(false);
        }}
        onCancel={() => setShowRenameModal(false)}
      />

      {/* Add File Modal */}
      <InputModal
        isOpen={showAddFile}
        title="Add File"
        placeholder="File name"
        confirmLabel="Add"
        onConfirm={handleAddFile}
        onCancel={() => setShowAddFile(false)}
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

export default ProjectView;

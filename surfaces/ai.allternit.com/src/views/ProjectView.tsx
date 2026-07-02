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

  if (!project) return (
    <div className="flex h-full items-center justify-center text-[var(--ui-text-muted)] italic text-sm">
      Select a project to view
    </div>
  );

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

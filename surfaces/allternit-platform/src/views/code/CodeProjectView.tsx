/**
 * CodeProjectView - Workspace view for Code mode
 * Replicates the structure of ProjectView but for Code workspaces
 * Shows threads list with real ChatComposer, tabs, and wired functionality
 */

import React, { useState, useMemo } from 'react';
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
import { ChatComposer } from '../chat/ChatComposer';
import { ResourceUsageDashboard } from '@/components/usage/ResourceUsageDashboard';
import {
  Terminal,
  PencilSimple,
  Archive,
  Trash,
  FileCode,
  Robot,
  ActivityIcon,
} from '@phosphor-icons/react';
import { useNav } from '@/nav/useNav';

interface CodeProjectViewProps {
  workspaceId?: string;
}

export function CodeProjectView({ workspaceId }: CodeProjectViewProps) {
  const { 
    workspaces, 
    activeWorkspaceId, 
    sessions,
    setActiveSession,
    setActiveWorkspace,
    renameWorkspace,
    deleteWorkspace,
    createSession,
  } = useCodeModeStore();
  
  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState('threads');
  const [isStarred, setIsStarred] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  
  // Modal states
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddInstruction, setShowAddInstruction] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instructionText, setInstructionText] = useState('');
  const [workspaceInstructions, setWorkspaceInstructions] = useState<string[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{id: string; name: string; size: number}>>([]);
  
  // Get current workspace
  const currentWorkspaceId = workspaceId || activeWorkspaceId;
  const workspace = useMemo(() => 
    workspaces.find(w => w.workspace_id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );
  
  // Filter threads for this workspace
  const workspaceThreads = useMemo(() => 
    sessions.filter(s => s.workspace_id === currentWorkspaceId && s.mode !== 'AUTO'), // Example filter, assuming AUTO might be agent-like
    [sessions, currentWorkspaceId]
  );
  
  const workspaceAgentThreads = useMemo(() => 
    sessions.filter(s => s.workspace_id === currentWorkspaceId && s.mode === 'AUTO'),
    [sessions, currentWorkspaceId]
  );
  
  const displayThreads = activeTab === 'threads' ? workspaceThreads : workspaceAgentThreads;
  const hasContent = displayThreads.length > 0 || workspaceFiles.length > 0;

  const handleBack = (): void => {
    setActiveWorkspace(''); // Clear active workspace
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleSend = (text: string): void => {
    if (!text.trim() || !currentWorkspaceId) return;
    console.log('Creating new thread in workspace:', currentWorkspaceId, 'with text:', text);
    setComposerInput('');
    // Navigation to new thread would happen here via store action
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleNewThread = (): void => {
    if (!currentWorkspaceId) return;
    createSession('New Thread', currentWorkspaceId);
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleSessionSelect = (sessionId: string): void => {
    setActiveSession(sessionId);
    // Navigate back to code view to show the canvas with the selected session
    dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
  };

  const handleRename = (): void => {
    setShowRenameModal(true);
  };

  const handleDelete = (): void => {
    setShowDeleteModal(true);
  };

  const handleAddInstruction = (): void => {
    if (instructionText.trim()) {
      setWorkspaceInstructions([...workspaceInstructions, instructionText.trim()]);
      setInstructionText('');
    }
    setShowAddInstruction(false);
  };

  const handleAddFile = (name: string): void => {
    setWorkspaceFiles([...workspaceFiles, { id: Date.now().toString(), name, size: 1024 }]);
    setShowAddFile(false);
  };

  if (!workspace) return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      opacity: 0.5 
    }}>
      Select a workspace to view
    </div>
  );

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
        <Archive size={16} />
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
      placeholder={`Message ${workspace.display_name}`}
      inputValue={composerInput}
      showTopActions={false}
      variant="default"
    />
  );

  // Sidebar sections
  const sidebarSectionsData = {
    memory: null,
    instructions: workspaceInstructions.length > 0 ? (
      <div>
        {workspaceInstructions.map((instruction, idx) => (
          <InstructionItem
            key={idx}
            text={instruction}
            onDelete={() => setWorkspaceInstructions(workspaceInstructions.filter((_, i) => i !== idx))}
          />
        ))}
      </div>
    ) : null,
    files: workspaceFiles.length > 0 ? (
      <div>
        {workspaceFiles.map(file => (
          <FileItem
            key={file.id}
            name={file.name}
            size={formatFileSize(file.size)}
            onDelete={() => setWorkspaceFiles(workspaceFiles.filter(f => f.id !== file.id))}
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
        onToggleStar={() => setIsStarred(!isStarred)}
        isStarred={isStarred}
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
          message: activeTab === 'threads' 
            ? 'Threads will appear here.'
            : activeTab === 'agent-threads'
            ? 'Agent threads will appear here.'
            : 'Sources will appear here.',
          subMessage: activeTab === 'threads' 
            ? 'Start a thread to get started with this workspace.'
            : activeTab === 'agent-threads'
            ? 'Start an agent thread to get autonomous assistance.'
            : 'Add files to reference them in this workspace.',
        }}
      >
        {/* Content based on active tab */}
        {activeTab === 'telemetry' && (
          <div style={{ padding: '20px 0' }}>
            <ResourceUsageDashboard />
          </div>
        )}
        {(activeTab === 'threads' || activeTab === 'agent-threads') && (
          <div>
            {displayThreads.map(session => (
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
          <div>
            {workspaceFiles.map(file => (
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

      {/* Rename Modal */}
      <InputModal
        isOpen={showRenameModal}
        title="Rename Workspace"
        placeholder="Workspace name"
        defaultValue={workspace.display_name}
        confirmLabel="Rename"
        onConfirm={(name) => {
          if (currentWorkspaceId) renameWorkspace(currentWorkspaceId, name);
          setShowRenameModal(false);
        }}
        onCancel={() => setShowRenameModal(false)}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Workspace"
        message={`Delete "${workspace.display_name}"? All threads will be unassigned.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (currentWorkspaceId) {
            deleteWorkspace(currentWorkspaceId);
            setActiveWorkspace('');
            dispatch({ type: 'OPEN_VIEW', viewType: 'code' });
          }
          setShowDeleteModal(false);
        }}
        onCancel={() => setShowDeleteModal(false)}
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

      {/* Add Instruction Modal */}
      {showAddInstruction && (
        <AddInstructionModal
          value={instructionText}
          onChange={setInstructionText}
          onClose={() => setShowAddInstruction(false)}
          onSave={handleAddInstruction}
        />
      )}
    </>
  );
}

// Reuse modals from Cowork/Chat or define locally if needed
// For simplicity, defining locally or assuming they will be shared later
function AddFileModal({ onClose, onUpload }: { onClose: () => void; onUpload: () => void }) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--shell-overlay-backdrop)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface-floating)',
          borderRadius: 16,
          border: '1px solid var(--ui-border-default)',
          padding: '24px',
          minWidth: 360,
          zIndex: 10001,
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
          Add sources
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onUpload}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid var(--ui-border-default)',
              background: 'var(--surface-hover)',
              borderRadius: 8,
              color: 'var(--ui-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Upload from device
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px',
            border: '1px solid var(--ui-border-default)',
            background: 'transparent',
            borderRadius: 8,
            color: 'var(--ui-text-secondary)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function AddInstructionModal({ 
  value, 
  onChange, 
  onClose, 
  onSave 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onClose: () => void; 
  onSave: () => void;
}) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--shell-overlay-backdrop)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface-floating)',
          borderRadius: 16,
          border: '1px solid var(--ui-border-default)',
          padding: '24px',
          width: '90%',
          maxWidth: 480,
          zIndex: 10001,
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
          Set workspace instructions
        </h3>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Specific rules for this workspace..."
          style={{
            width: '100%',
            minHeight: 120,
            padding: 12,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--ui-border-default)',
            borderRadius: 8,
            color: 'var(--ui-text-primary)',
            fontSize: 14,
            outline: 'none',
            marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ color: 'var(--ui-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onSave} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent-primary)', color: 'var(--ui-text-inverse)', border: 'none', cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </>
  );
}

// Helper functions
function formatDate(isoString: string): string {
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

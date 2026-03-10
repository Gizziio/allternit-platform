/**
 * ProjectView - Chat mode project view
 * Uses BaseProjectView for consistent layout
 * Shows sessions list with real ChatComposer, tabs, and wired functionality
 */

import React, { useState } from 'react';
import { useChatStore } from './chat/ChatStore';
import { 
  BaseProjectView, 
  ProjectItemCard,
  ProjectMenuButton,
  FileItem,
  InstructionItem,
} from './BaseProjectView';
import { ChatComposer } from './chat/ChatComposer';
import { MessageSquare, Pencil, Archive, Trash2, FileText, Bot } from 'lucide-react';
import { useNav } from '@/nav/useNav';

export function ProjectView() {
  const { 
    projects, 
    activeProjectId, 
    activeProjectLocalKey,
    threads, 
    setActiveThread,
    setActiveProject,
    addFileToProject,
    removeFileFromProject,
    renameProject,
    deleteProject,
    createThread,
  } = useChatStore();
  
  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState('chats');
  const [isStarred, setIsStarred] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  
  // Modal states
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddInstruction, setShowAddInstruction] = useState(false);
  const [instructionText, setInstructionText] = useState('');
  const [projectInstructions, setProjectInstructions] = useState<string[]>([]);
  
  const project = activeProjectLocalKey
    ? projects.find((p) => p.localKey === activeProjectLocalKey) || projects.find((p) => p.id === activeProjectId)
    : projects.find((p) => p.id === activeProjectId);

  if (!project) return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      opacity: 0.5 
    }}>
      Select a project to view
    </div>
  );

  const projectThreads = threads.filter(t => t.projectId === project.id && t.mode !== 'agent');
  const projectAgentSessions = threads.filter(t => t.projectId === project.id && t.mode === 'agent');
  const projectFiles = project.files || [];
  
  const hasContent = (() => {
    switch (activeTab) {
      case 'chats': return projectThreads.length > 0;
      case 'agent-sessions': return projectAgentSessions.length > 0;
      case 'sources': return projectFiles.length > 0;
      default: return false;
    }
  })();

  const handleBack = () => {
    setActiveProject(null);
  };

  const handleSend = async (text: string) => {
    // Create a new thread in this project
    console.log('Creating new session in project:', project.id, 'with text:', text);
    setComposerInput('');
    
    // Create the thread and navigate to it
    const threadId = await createThread(text.slice(0, 50) || 'New Chat', project.id);
    dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
  };

  const handleNewChat = () => {
    // Open new chat in this project
    dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
  };

  const handleAddFile = () => {
    const name = prompt('File name:');
    if (name) {
      addFileToProject(project.id, { 
        name, 
        size: 1024, 
        type: 'text/markdown' 
      });
    }
    setShowAddFile(false);
  };

  const handleRemoveFile = (fileId: string) => {
    if (confirm('Remove this file from the project?')) {
      removeFileFromProject(project.id, fileId);
    }
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
      <button
        onClick={() => {
          const newName = prompt('Rename project:', project.title);
          if (newName && newName.trim() !== project.title) {
            renameProject(project.id, newName.trim());
          }
        }}
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          background: 'transparent',
          color: '#9b9b9b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <Pencil size={16} />
        Edit details
      </button>
      <button
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          background: 'transparent',
          color: '#9b9b9b',
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
        onClick={() => {
          if (confirm('Delete this project? All chats in this project will be unlinked but not deleted.')) {
            deleteProject(project.id);
            setActiveProject(null);
          }
        }}
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          background: 'transparent',
          color: '#ef4444',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <Trash2 size={16} />
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
            key={idx}
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
            : 'Sources will appear here.',
          subMessage: activeTab === 'chats'
            ? 'Start a chat to keep conversations organized and re-use project knowledge.'
            : activeTab === 'agent-sessions'
            ? 'Start an agent session to get autonomous assistance with this project.'
            : 'Add files to reference them in this project.',
        }}
      >
        {/* Content based on active tab */}
        {activeTab === 'chats' && (
          <div>
            {projectThreads.map(thread => (
              <ProjectItemCard
                key={thread.id}
                title={thread.title}
                subtitle={formatDate(thread.updatedAt)}
                onClick={() => setActiveThread(thread.id)}
                icon={<MessageSquare size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'agent-sessions' && (
          <div>
            {projectAgentSessions.map(session => (
              <ProjectItemCard
                key={session.id}
                title={session.title}
                subtitle={formatDate(session.updatedAt)}
                onClick={() => setActiveThread(session.id)}
                icon={<Bot size={18} />}
              />
            ))}
          </div>
        )}
        {activeTab === 'sources' && (
          <div>
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
      </BaseProjectView>

      {/* Add File Modal */}
      {showAddFile && (
        <AddFileModal
          onClose={() => setShowAddFile(false)}
          onUpload={handleAddFile}
        />
      )}

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

// Add File Modal
function AddFileModal({ onClose, onUpload }: { onClose: () => void; onUpload: () => void }) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
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
          background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '24px',
          minWidth: 360,
          zIndex: 10001,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 16, 
          fontWeight: 700, 
          color: '#f0f0f0' 
        }}>
          Add sources
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onUpload}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              color: '#9b9b9b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              textAlign: 'left',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Upload from device
          </button>
          
          <button
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              color: '#9b9b9b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
              <line x1="10" x2="8" y1="9" y2="9" />
            </svg>
            Add text content
          </button>
          
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
          
          <button
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              color: '#9b9b9b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </span>
            <span style={{ color: '#4b4b4b' }}>Connect</span>
          </button>
          
          <button
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              color: '#9b9b9b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              Google Drive
            </span>
            <span style={{ color: '#4b4b4b' }}>Connect</span>
          </button>
        </div>
        
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px',
            border: 'none',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            color: '#9b9b9b',
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

// Add Instruction Modal
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
          background: 'rgba(0,0,0,0.6)',
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
          background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '24px',
          width: '90%',
          maxWidth: 480,
          zIndex: 10001,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ 
          margin: '0 0 8px 0', 
          fontSize: 16, 
          fontWeight: 700, 
          color: '#f0f0f0' 
        }}>
          Set project instructions
        </h3>
        <p style={{
          margin: '0 0 16px 0',
          fontSize: 13,
          color: '#6b6b6b',
        }}>
          Provide relevant instructions and information for chats within this project.
        </p>
        
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Break down large tasks and ask clarifying questions when needed."
          style={{
            width: '100%',
            minHeight: 120,
            padding: 12,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#f0f0f0',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            marginBottom: 16,
          }}
        />
        
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#9b9b9b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!value.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: value.trim() ? '#f0f0f0' : 'rgba(255,255,255,0.1)',
              color: value.trim() ? '#1a1a1a' : '#4b4b4b',
              fontSize: 13,
              fontWeight: 600,
              cursor: value.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Save instructions
          </button>
        </div>
      </div>
    </>
  );
}

// Helper functions
function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'recently';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

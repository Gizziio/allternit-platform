import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  chatStorage,
  type ChatSession,
  type ChatFolder,
} from '../runtime/ChatStorage';
import { ChatInterface } from './ChatInterface';
import { VoiceOrb } from './VoiceOrb';
import { conversationStore } from '../runtime/ConversationStore';
import { activityCenter } from '../runtime/ActivityCenter';
import '../styles/glass-chat.css';

// SVGs
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const FolderIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

// Brain icon for linked sessions
const BrainIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8b5cf6' }}>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

// Live indicator for active sessions
const LiveIndicator = () => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '6px',
  }}>
    <span style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: '#10b981',
      animation: 'pulse 2s infinite',
      marginRight: '4px',
    }} />
    <span style={{ fontSize: '10px', color: '#10b981' }}>LIVE</span>
  </span>
);

interface ChatSessionsProps {
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  activeSessionId?: string;
  sessions?: ChatSession[];
}

export const ChatSessions: React.FC<ChatSessionsProps> = ({
  onSelectSession,
  onNewSession,
  onClose,
  activeSessionId,
  sessions: propSessions,
}) => {
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Renaming state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        await chatStorage.init();
        const [loadedFolders, loadedSessions] = await Promise.all([
          chatStorage.getFolders(),
          chatStorage.getSessions(),
        ]);
        setFolders(loadedFolders);
        setSessions(propSessions || loadedSessions);

        const populatedFolders = new Set(loadedFolders.filter(f =>
          loadedSessions.some(s => s.folderId === f.id)
        ).map(f => f.id));
        setExpandedFolders(populatedFolders);
      } catch (err) {
        console.error('Failed to load chat data:', err);
      }
    };
    loadData();
  }, [propSessions]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const newFolder: ChatFolder = {
        id: `folder_${Date.now()}`,
        name: newFolderName.trim(),
        icon: 'folder',
        order: folders.length,
        createdAt: new Date(),
      };
      await chatStorage.createFolder(newFolder);
      setFolders(prev => [...prev, newFolder]);
      setExpandedFolders(prev => new Set([...prev, newFolder.id]));
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleRename = async (id: string, type: 'session' | 'folder') => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }

    try {
      if (type === 'session') {
        await chatStorage.renameSession(id, editValue);
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editValue } : s));
      } else {
        await chatStorage.renameFolder(id, editValue);
        setFolders(prev => prev.map(f => f.id === id ? { ...f, name: editValue } : f));
      }
    } catch (err) {
      console.error('Failed to rename:', err);
    } finally {
      setEditingId(null);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat?')) return;
    try {
      await chatStorage.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) onSelectSession('');
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const deleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this folder? Chats inside will be moved out of the folder.')) return;
    try {
      await chatStorage.deleteFolder(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      // Reload sessions as they may have moved
      const loadedSessions = await chatStorage.getSessions();
      setSessions(loadedSessions);
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  const handleNewChat = async () => {
    try {
      const newSession = await chatStorage.createSession('New Chat', '');
      setSessions(prev => [newSession, ...prev]);
      onSelectSession(newSession.id);
      setIsCollapsed(false);
      setEditingId(newSession.id);
      setEditValue('New Chat');
    } catch (err) {
      console.error('Failed to create session:', err);
      onNewSession();
    }
  };

  const onDragStart = (e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData('sessionId', sessionId);
  };

  const onDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const onDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const sessionId = e.dataTransfer.getData('sessionId');
    if (!sessionId) return;

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (session && (session.folderId || '') !== folderId) {
        const updatedSession = { ...session, folderId };
        await chatStorage.updateSession(updatedSession);
        setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));
        if (folderId) setExpandedFolders(prev => new Set([...prev, folderId]));
      }
    } catch (err) {
      console.error('Failed to move session:', err);
    }
  };

  const getSessionsByFolder = (folderId: string) => {
    return sessions.filter(s => (s.folderId || '') === folderId);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'Now';
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="glass-layout">
      <div className={`glass-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <button
          className="glass-sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <ChevronRight />
        </button>

        <div className="glass-sidebar-header">
          <h2>Agent Chats</h2>
          <button className="glass-new-chat-btn" onClick={handleNewChat} title="New Chat">
            <PlusIcon />
          </button>
        </div>

        <div className="glass-session-list">
          <div
            className={`glass-root-sessions ${dragOverFolderId === '' ? 'drag-over' : ''}`}
            onDragOver={(e) => onDragOver(e, '')}
            onDrop={(e) => onDrop(e, '')}
            style={{ minHeight: '40px', padding: '4px' }}
          >
            {getSessionsByFolder('').map(session => {
              // Check if this session is linked to a brain session
              const conversation = conversationStore.getByChatSessionId(session.id);
              const hasBrainLink = !!conversation?.linkedBrainSessionId;

              // Check if this is the currently active activity target
              const currentActivity = activityCenter.getCurrentActivity();
              const isLiveTarget = currentActivity?.chatSessionId === session.id;

              return (
                <div
                  key={session.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, session.id)}
                  className={`glass-session-item ${activeSessionId === session.id ? 'active' : ''}`}
                  onClick={() => onSelectSession(session.id)}
                >
                  {editingId === session.id ? (
                    <input
                      autoFocus
                      className="glass-rename-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(session.id, 'session')}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(session.id, 'session')}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <div className="glass-session-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {session.title}
                        {/* Brain icon if linked */}
                        {hasBrainLink && <BrainIcon size={12} />}
                        {/* Live indicator if active */}
                        {isLiveTarget && <LiveIndicator />}
                      </div>
                      <div className="glass-session-preview">{session.lastMessage || 'New conversation...'}</div>
                      <div className="glass-session-time">{formatTime(session.updatedAt)}</div>
                      {!isCollapsed && activeSessionId === session.id && editingId !== session.id && (
                        <div className="glass-session-actions" style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(session.id); setEditValue(session.title); }} title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', opacity: 0.5 }}><EditIcon /></button>
                          <button onClick={(e) => deleteSession(session.id, e)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', opacity: 0.5, color: '#ef4444' }}><TrashIcon /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)', margin: '12px 16px' }} />

          {folders.map(folder => {
            const folderSessions = getSessionsByFolder(folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            const isDragOver = dragOverFolderId === folder.id;

            return (
              <div
                key={folder.id}
                className={`glass-folder-section ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => onDragOver(e, folder.id)}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => onDrop(e, folder.id)}
              >
                <div className="glass-folder-header-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-folder-header" onClick={() => toggleFolder(folder.id)} style={{ flex: 1 }}>
                    <span className="folder-chevron">{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
                    <span className="folder-icon"><FolderIcon /></span>
                    {editingId === folder.id ? (
                      <input
                        autoFocus
                        className="glass-folder-rename-input"
                        value={editValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleRename(folder.id, 'folder')}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(folder.id, 'folder')}
                      />
                    ) : (
                      <span className="folder-name">{folder.name}</span>
                    )}
                  </button>
                  {!isCollapsed && (
                    <div style={{ display: 'flex', gap: '2px', opacity: 0.3 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(folder.id); setEditValue(folder.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} title="Rename"><EditIcon /></button>
                      <button onClick={(e) => deleteFolder(folder.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#ef4444' }} title="Delete Folder"><TrashIcon /></button>
                    </div>
                  )}
                </div>

                {isExpanded && !isCollapsed && (
                  <div className="glass-folder-content" style={{ paddingLeft: '24px' }}>
                    {folderSessions.map(session => (
                      <div
                        key={session.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, session.id)}
                        className={`glass-session-item sub-item ${activeSessionId === session.id ? 'active' : ''}`}
                        onClick={() => onSelectSession(session.id)}
                        style={{ position: 'relative' }}
                      >
                        {editingId === session.id ? (
                          <input
                            autoFocus
                            className="glass-rename-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleRename(session.id, 'session')}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename(session.id, 'session')}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <div className="glass-session-title" style={{ fontSize: '0.85rem' }}>{session.title}</div>
                            <div className="glass-session-time">{formatTime(session.updatedAt)}</div>
                          </>
                        )}
                        {activeSessionId === session.id && editingId !== session.id && (
                          <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(session.id); setEditValue(session.title); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5 }}><EditIcon /></button>
                            <button onClick={(e) => deleteSession(session.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5, color: '#ef4444' }}><TrashIcon /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="glass-folder-actions" style={{ padding: '16px', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
          {isCreatingFolder && !isCollapsed ? (
            <input
              type="text" autoFocus placeholder="Folder name..." value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setIsCreatingFolder(false); }}
              onBlur={() => setIsCreatingFolder(false)}
              className="glass-new-folder-input"
            />
          ) : (
            <button className="glass-add-folder-btn" onClick={() => setIsCreatingFolder(true)} title="Create New Folder">
              <PlusIcon />
              <span>New Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Glass Main Chat Area */}
      {activeSessionId ? (
        <ChatInterface
          sessionId={activeSessionId}
          sessionTitle={activeSession?.title}
        />
      ) : (
        <div className="glass-chat-area">
          <div className="glass-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <VoiceOrb
              isListening={isListening}
              onToggleListening={() => setIsListening(!isListening)}
              transcript={transcript}
              onTranscript={setTranscript}
            />
          </div>
        </div>
      )}
    </div>
  );
};

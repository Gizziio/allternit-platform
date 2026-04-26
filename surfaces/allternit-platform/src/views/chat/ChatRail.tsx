import React, { useCallback, useRef, useState, useMemo } from 'react';
import { useChatStore } from './ChatStore';
import { getAgentSessionDescriptor } from '@/lib/agents';
import { 
  useChatSessionStore, 
  type ChatSession,
  getChatSessionsForProject,
  getRootChatSessions,
} from './ChatSessionStore';
import { RailRowMenu } from '../../shell/rail/RailRowMenu';
import { InlineRename, type InlineRenameHandle } from '@/components/InlineRename';
import { groupSessionsByTime } from '@/lib/groupSessionsByTime';
import { DeleteConfirmModal } from '../../shell/DeleteConfirmModal';
import {
  ChatText,
  Robot,
  FolderOpen,
  FolderPlus,
  CaretDown,
  FileText,
  Image as ImageIcon,
  MagnifyingGlass,
  Plus,
  X,
} from '@phosphor-icons/react';
import { tokens } from '../../design/tokens';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';

interface DroppedFile {
  id: string;
  name: string;
  type: 'image' | 'document' | 'other';
  dataUrl: string;
  size: number;
}

export function ChatRail() {
  const {
    projects,
    activeProjectId,
    activeProjectLocalKey,
    setActiveProject,
    deleteProject,
    renameProject,
    createProject,
    createThread,
  } = useChatStore();

  const sessions = useChatSessionStore((s) => s.sessions);
  const activeSessionId = useChatSessionStore((s) => s.activeSessionId);
  const setActiveSession = useChatSessionStore((s) => s.setActiveSession);
  const updateSession = useChatSessionStore((s) => s.updateSession);
  const deleteSession = useChatSessionStore((s) => s.deleteSession);

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() =>
    new Set(projects.map((p) => p.id)),
  );
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Delete confirmation state
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Per-item rename refs — keyed by id
  const renameRefs = useRef<Map<string, InlineRenameHandle>>(new Map());
  const getOrCreateRef = (id: string): React.RefCallback<InlineRenameHandle> => (handle) => {
    if (handle) {
      renameRefs.current.set(id, handle);
    } else {
      renameRefs.current.delete(id);
    }
  };

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    const newFiles: DroppedFile[] = files.map(({ file, dataUrl }) => ({
      id: `rail-drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type.startsWith('image/')
        ? 'image'
        : file.type.includes('pdf') || file.name.endsWith('.docx')
          ? 'document'
          : 'other',
      dataUrl,
      size: file.size,
    }));
    setDroppedFiles((prev) => [...prev.slice(-4), ...newFiles]);
  }, []);

  useDropTarget('rail', handleDroppedFiles);

  const handleNewChat = useCallback(async () => {
    await createThread('New Chat');
  }, [createThread]);

  // Sessions that belong to a specific project
  const sessionsByProject = useCallback(
    (projectId: string): ChatSession[] => {
      return getChatSessionsForProject(sessions, projectId).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },
    [sessions],
  );

  // Root sessions (not in any project), filtered by search
  const filteredRootSessions = useMemo(() => {
    const root = getRootChatSessions(sessions)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (!searchQuery.trim()) return root;
    const q = searchQuery.toLowerCase();
    return root.filter((s) => (s.name ?? '').toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const timeGroups = useMemo(
    () => groupSessionsByTime(filteredRootSessions, (s) => s.updatedAt),
    [filteredRootSessions],
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSearchActive = searchQuery.trim().length > 0 || isSearchFocused;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.sm,
        padding: `${tokens.space.sm}px`,
      }}
    >
      {/* New Chat Button */}
      <button
        onClick={handleNewChat}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space.sm,
          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
          borderRadius: tokens.radius.sm,
          border: '1px solid var(--border-subtle)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          width: '100%',
          transition: `all ${tokens.motion.fast}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--rail-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }}
      >
        <Plus size={16} weight="bold" />
        New Chat
      </button>

      {/* Search Bar */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MagnifyingGlass
          size={14}
          style={{
            position: 'absolute',
            left: 8,
            color: isSearchActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            pointerEvents: 'none',
            transition: `color ${tokens.motion.fast}`,
          }}
        />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder="Search chats…"
          style={{
            width: '100%',
            background: isSearchActive ? 'var(--bg-tertiary)' : 'transparent',
            border: `1px solid ${isSearchActive ? 'var(--border-default)' : 'var(--border-subtle)'}`,
            borderRadius: tokens.radius.sm,
            color: 'var(--text-primary)',
            fontSize: 12,
            padding: '5px 28px 5px 28px',
            outline: 'none',
            transition: `all ${tokens.motion.fast}`,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 6,
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Dropped Files Section */}
      {droppedFiles.length > 0 && (
        <div
          style={{
            padding: '8px',
            background: 'rgba(212,149,106,0.1)',
            borderRadius: 8,
            border: '1px solid rgba(212,149,106,0.2)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#d4956a',
              marginBottom: 6,
              letterSpacing: '0.05em',
            }}
          >
            Quick Uploads
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {droppedFiles.map((file) => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                {file.type === 'image' ? (
                  <ImageIcon size={12} color="#d4956a" />
                ) : (
                  <FileText size={12} color="#d4956a" />
                )}
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects Section — hidden while searching */}
      {!searchQuery && (
        <div>
          <SectionHeader
            title="Projects"
            count={projects.length}
            onAdd={() => createProject('New Project')}
            addTooltip="Create new project"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              const projectSessions = sessionsByProject(project.id);
              const isActive = activeProjectLocalKey
                ? activeProjectLocalKey === project.localKey
                : activeProjectId === project.id;

              return (
                <div key={project.id}>
                  <ChatRailItem
                    icon={FolderOpen}
                    label={project.title}
                    isActive={isActive}
                    onClick={() => setActiveProject(project.id, project.localKey)}
                    badge={projectSessions.length > 0 ? projectSessions.length : undefined}
                    isFolder
                    isExpanded={isExpanded}
                    onToggle={() => toggleProject(project.id)}
                    renameRef={getOrCreateRef(`proj-${project.id}`)}
                    onSaveRename={(title) => renameProject(project.id, title)}
                    actions={
                      <RailRowMenu
                        onDelete={() => deleteProject(project.id)}
                        onRename={() => renameRefs.current.get(`proj-${project.id}`)?.startEdit()}
                      />
                    }
                  />

                  {isExpanded && projectSessions.length > 0 && (
                    <div
                      style={{
                        marginLeft: 20,
                        paddingLeft: tokens.space.sm,
                        borderLeft: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {projectSessions.map((session) => (
                        <ChatRailItem
                          key={session.id}
                          icon={ChatText}
                          label={session.name ?? 'New Chat'}
                          isActive={activeSessionId === session.id}
                          isNested
                          onClick={() => setActiveSession(session.id)}
                          renameRef={getOrCreateRef(session.id)}
                          onSaveRename={(name) => void updateSession(session.id, { name })}
                          actions={
                            <RailRowMenu
                              onDelete={() => setSessionToDelete(session.id)}
                              onRename={() => renameRefs.current.get(session.id)?.startEdit()}
                            />
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <NewItemButton
              icon={FolderPlus}
              label="New Project"
              onClick={() => createProject('New Project')}
            />
          </div>
        </div>
      )}

      {/* Sessions — time-grouped */}
      {timeGroups.length > 0 && (
        <div>
          {!searchQuery && <SectionHeader title="Chats" count={filteredRootSessions.length} />}
          {timeGroups.map((group) => (
            <div key={group.key} style={{ marginBottom: tokens.space.sm }}>
              <TimeGroupLabel label={group.label} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((session) => {
                  const isAgent =
                    getAgentSessionDescriptor(session.metadata).sessionMode === 'agent';
                  return (
                    <ChatRailItem
                      key={session.id}
                      icon={isAgent ? Robot : ChatText}
                      label={session.name ?? 'New Chat'}
                      isActive={activeSessionId === session.id}
                      onClick={() => setActiveSession(session.id)}
                      renameRef={getOrCreateRef(session.id)}
                      onSaveRename={(name) => void updateSession(session.id, { name })}
                      actions={
                        <RailRowMenu
                          onDelete={() => setSessionToDelete(session.id)}
                          onRename={() => renameRefs.current.get(session.id)?.startEdit()}
                        />
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty search state */}
      {searchQuery && timeGroups.length === 0 && (
        <div
          style={{
            padding: `${tokens.space.lg}px ${tokens.space.md}px`,
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          No chats matching &ldquo;{searchQuery}&rdquo;
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <DeleteConfirmModal
          title="Delete Session"
          itemName={sessions.find(s => s.id === sessionToDelete)?.name || 'Untitled Session'}
          itemType="session"
          onConfirm={async () => {
            const sessionId = sessionToDelete;
            console.log('[ChatRail] Deleting session:', sessionId);
            try {
              await deleteSession(sessionId);
              console.log('[ChatRail] Session deleted successfully:', sessionId);
            } catch (err) {
              console.error('[ChatRail] Failed to delete session:', sessionId, err);
            }
            setSessionToDelete(null);
          }}
          onCancel={() => setSessionToDelete(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time group label
// ---------------------------------------------------------------------------

function TimeGroupLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-tertiary)',
        padding: `${tokens.space.xs}px ${tokens.space.md}px`,
        marginTop: tokens.space.xs,
        opacity: 0.6,
      }}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  count?: number;
  onAdd?: () => void;
  addTooltip?: string;
}

function SectionHeader({ title, count, onAdd }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        marginBottom: tokens.space.xs,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-tertiary)',
        }}
      >
        {title}
        {count !== undefined && (
          <span
            style={{
              marginLeft: tokens.space.xs,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              opacity: 0.7,
            }}
          >
            ({count})
          </span>
        )}
      </span>
      {onAdd && (
        <button
          onClick={onAdd}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Item Button
// ---------------------------------------------------------------------------

interface NewItemButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

function NewItemButton({ icon: Icon, label, onClick }: NewItemButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.sm,
        padding: `${tokens.space.sm}px ${tokens.space.md}px`,
        borderRadius: tokens.radius.sm,
        border: 'none',
        background: isHovered ? 'var(--rail-hover)' : 'transparent',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'left',
        transition: `all ${tokens.motion.fast}`,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'var(--border-subtle)',
        marginTop: tokens.space.xs,
        width: '100%',
      }}
    >
      <Icon size={18} weight="regular" />
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chat Rail Item
// ---------------------------------------------------------------------------

interface ChatRailItemProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  isNested?: boolean;
  isFolder?: boolean;
  isExpanded?: boolean;
  badge?: number;
  onClick: () => void;
  onToggle?: () => void;
  actions?: React.ReactNode;
  renameRef?: React.RefCallback<InlineRenameHandle>;
  onSaveRename?: (newName: string) => void;
}

function ChatRailItem({
  icon: Icon,
  label,
  isActive,
  isNested,
  isFolder,
  isExpanded,
  badge,
  onClick,
  onToggle,
  actions,
  renameRef,
  onSaveRename,
}: ChatRailItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <button
        onClick={onClick}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space.sm,
          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
          paddingLeft: isNested ? tokens.space.sm : tokens.space.md,
          paddingRight: actions ? 40 : tokens.space.md,
          borderRadius: tokens.radius.sm,
          border: 'none',
          background: isActive
            ? 'var(--rail-active-bg)'
            : isHovered
              ? 'var(--rail-hover)'
              : 'transparent',
          color: isActive ? 'var(--rail-active-fg)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: isActive ? 700 : 500,
          textAlign: 'left',
          transition: `all ${tokens.motion.fast}`,
          boxShadow: isActive ? 'inset 0 0 0 1px var(--border-subtle)' : 'none',
          minWidth: 0,
          width: '100%',
        }}
      >
        {isFolder && onToggle && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              cursor: 'pointer',
              opacity: 0.5,
              transition: `transform ${tokens.motion.fast}`,
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              flexShrink: 0,
            }}
          >
            <CaretDown size={10} weight="bold" />
          </span>
        )}

        <Icon
          size={isNested ? 16 : 18}
          weight={isActive ? 'duotone' : 'regular'}
          color={isActive ? 'var(--rail-active-fg)' : 'var(--text-tertiary)'}
          style={{ minWidth: isNested ? 16 : 18, flexShrink: 0 }}
        />

        {renameRef && onSaveRename ? (
          <InlineRename
            ref={renameRef}
            value={label}
            onSave={onSaveRename}
            style={{
              color: isActive ? 'var(--rail-active-fg)' : 'var(--text-secondary)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )}

        {badge !== undefined && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 700,
              background: isActive ? 'var(--accent-chat)' : 'var(--bg-tertiary)',
              color: isActive ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {actions && (
        <div
          style={{
            position: 'absolute',
            right: tokens.space.sm,
            opacity: isHovered ? 1 : 0,
            pointerEvents: 'auto', // Always allow pointer events - menu handles its own visibility
            transition: `opacity ${tokens.motion.fast}`,
            zIndex: 10,
          }}
          onMouseEnter={() => setIsHovered(true)} // Keep hover state when over actions
          onMouseLeave={() => setIsHovered(false)}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

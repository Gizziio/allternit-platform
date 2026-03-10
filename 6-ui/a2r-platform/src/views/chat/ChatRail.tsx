import React, { useCallback, useState } from 'react';
import { useChatStore, ChatThread } from './ChatStore';
import { RailRowMenu } from '../../shell/rail/RailRowMenu';
import {
  ChatText,
  Robot,
  FolderOpen,
  FolderPlus,
  CaretDown,
  CaretRight,
  Upload,
  FileText,
  Image as ImageIcon,
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
    threads,
    projects,
    activeThreadId,
    activeProjectId,
    activeProjectLocalKey,
    setActiveThread,
    setActiveProject,
    deleteThread,
    renameThread,
    deleteProject,
    renameProject,
    createProject,
  } = useChatStore();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    // Expand all projects by default
    return new Set(projects.map((p) => p.id));
  });
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);

  const toggleProject = (projectId: string) => {
    const next = new Set(expandedProjects);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    setExpandedProjects(next);
  };

  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    const newFiles: DroppedFile[] = files.map(({ file, dataUrl }) => ({
      id: `rail-drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 
            file.type.includes('pdf') || file.name.endsWith('.docx') ? 'document' : 'other',
      dataUrl,
      size: file.size,
    }));
    setDroppedFiles(prev => [...prev.slice(-4), ...newFiles]); // Keep last 5
  }, []);

  // Register as drop target for rail
  useDropTarget('rail', handleDroppedFiles);

  // Filter threads by type
  const agentThreads = threads.filter((t) => !t.projectId && t.mode === 'agent');
  const llmThreads = threads.filter((t) => !t.projectId && t.mode !== 'agent');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.md,
        padding: `${tokens.space.sm}px`,
      }}
    >
      {/* Dropped Files Section */}
      {droppedFiles.length > 0 && (
        <div style={{ 
          padding: '8px', 
          background: 'rgba(212,149,106,0.1)', 
          borderRadius: 8,
          border: '1px solid rgba(212,149,106,0.2)',
        }}>
          <div style={{ 
            fontSize: 10, 
            fontWeight: 700, 
            textTransform: 'uppercase',
            color: '#d4956a', 
            marginBottom: 6,
            letterSpacing: '0.05em',
          }}>
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
                <span style={{ 
                  fontSize: 11, 
                  color: 'var(--text-secondary)', 
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
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

      {/* Projects Section */}
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
            const projectThreads = threads.filter((t) => t.projectId === project.id);
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
                  badge={projectThreads.length > 0 ? projectThreads.length : undefined}
                  isFolder
                  isExpanded={isExpanded}
                  onToggle={() => toggleProject(project.id)}
                  actions={
                    <RailRowMenu
                      onDelete={() => deleteProject(project.id)}
                      onRename={() => {
                        const newTitle = prompt('Rename project:', project.title);
                        if (newTitle) renameProject(project.id, newTitle);
                      }}
                    />
                  }
                />

                {/* Project Threads */}
                {isExpanded && projectThreads.length > 0 && (
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
                    {projectThreads.map((thread) => (
                      <ChatRailItem
                        key={thread.id}
                        icon={ChatText}
                        label={thread.title}
                        isActive={activeThreadId === thread.id}
                        isNested
                        onClick={() => setActiveThread(thread.id)}
                        actions={
                          <RailRowMenu
                            threadId={thread.id}
                            onDelete={() => deleteThread(thread.id)}
                            onRename={() => {
                              const newTitle = prompt('Rename thread:', thread.title);
                              if (newTitle) renameThread(thread.id, newTitle);
                            }}
                          />
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* New Project Button */}
          <NewItemButton
            icon={FolderPlus}
            label="New Project"
            onClick={() => createProject('New Project')}
          />
        </div>
      </div>

      {/* Agent Sessions */}
      {agentThreads.length > 0 && (
        <div>
          <SectionHeader title="Agent Sessions" count={agentThreads.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {agentThreads.map((thread) => (
              <ChatRailItem
                key={thread.id}
                icon={Robot}
                label={thread.title}
                isActive={activeThreadId === thread.id}
                onClick={() => setActiveThread(thread.id)}
                actions={
                  <RailRowMenu
                    threadId={thread.id}
                    onDelete={() => deleteThread(thread.id)}
                    onRename={() => {
                      const newTitle = prompt('Rename thread:', thread.title);
                      if (newTitle) renameThread(thread.id, newTitle);
                    }}
                  />
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* LLM Sessions */}
      {llmThreads.length > 0 && (
        <div>
          <SectionHeader title="LLM Sessions" count={llmThreads.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {llmThreads.map((thread) => (
              <ChatRailItem
                key={thread.id}
                icon={ChatText}
                label={thread.title}
                isActive={activeThreadId === thread.id}
                onClick={() => setActiveThread(thread.id)}
                actions={
                  <RailRowMenu
                    threadId={thread.id}
                    onDelete={() => deleteThread(thread.id)}
                    onRename={() => {
                      const newTitle = prompt('Rename thread:', thread.title);
                      if (newTitle) renameThread(thread.id, newTitle);
                    }}
                  />
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Section Header Component
interface SectionHeaderProps {
  title: string;
  count?: number;
  onAdd?: () => void;
  addTooltip?: string;
}

function SectionHeader({ title, count, onAdd, addTooltip }: SectionHeaderProps) {
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
    </div>
  );
}

// New Item Button Component
interface NewItemButtonProps {
  icon: React.ComponentType<any>;
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
      }}
    >
      <Icon size={18} weight="regular" />
      <span>{label}</span>
    </button>
  );
}

// Chat Rail Item Component
interface ChatRailItemProps {
  icon: React.ComponentType<any>;
  label: string;
  isActive: boolean;
  isNested?: boolean;
  isFolder?: boolean;
  isExpanded?: boolean;
  badge?: number;
  onClick: () => void;
  onToggle?: () => void;
  actions?: React.ReactNode;
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
        }}
      >
        {/* Folder Toggle */}
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
            }}
          >
            <CaretDown size={10} weight="bold" />
          </span>
        )}

        {/* Icon */}
        <Icon
          size={isNested ? 16 : 18}
          weight={isActive ? 'duotone' : 'regular'}
          color={isActive ? 'var(--rail-active-fg)' : 'var(--text-tertiary)'}
          style={{ minWidth: isNested ? 16 : 18 }}
        />

        {/* Label */}
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

        {/* Badge */}
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
              background: isActive
                ? 'var(--accent-chat)'
                : 'var(--bg-tertiary)',
              color: isActive ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {/* Actions */}
      {actions && (
        <div
          style={{
            position: 'absolute',
            right: tokens.space.sm,
            opacity: isHovered ? 1 : 0,
            pointerEvents: isHovered ? 'auto' : 'none',
            transition: `opacity ${tokens.motion.fast}`,
            zIndex: 10,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

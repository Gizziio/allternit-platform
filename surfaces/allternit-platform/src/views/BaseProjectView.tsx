/**
 * BaseProjectView - Standardized project view layout
 * Following the Claude/ChatGPT project view pattern:
 * - Responsive: Sidebar stacks vertically on smaller screens
 * - Header with back button, title, New Chat/Task button, menu, star
 * - Tabs for Chats/Sources or Tasks/Agent Tasks
 * - Input bar at top using real ChatComposer
 * - Main content area for sessions/tasks
 * - Right sidebar (or bottom on small screens) with Memory, Instructions, Files
 */

import React, { ReactNode, useState, useEffect } from 'react';
import {
  ArrowLeft,
  DotsThreeOutline,
  Star,
  Plus,
  FileText,
  X,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';

export interface ProjectViewTab {
  id: string;
  label: string;
  count?: number;
}

export interface BaseProjectViewProps {
  /** Project title */
  title: string;
  /** Project description/subtitle */
  description?: string;
  /** Back button handler */
  onBack?: () => void;
  /** Star/favorite handler */
  onToggleStar?: () => void;
  /** Is project starred */
  isStarred?: boolean;
  /** Available tabs */
  tabs: ProjectViewTab[];
  /** Currently active tab ID */
  activeTab: string;
  /** Tab change handler */
  onTabChange: (tabId: string) => void;
  /** New Chat/Task button handler */
  onNewItem?: () => void;
  /** New button label */
  newButtonLabel?: string;
  /** 3-dot menu content */
  menuContent?: ReactNode;
  /** Main content (sessions/tasks list) */
  children: ReactNode;
  /** Input bar component (real ChatComposer) */
  inputBar: ReactNode;
  /** Sidebar sections content */
  sidebarSections: {
    memory?: ReactNode;
    instructions?: ReactNode;
    files?: ReactNode;
    onAddInstruction?: () => void;
    onAddFile?: () => void;
  };
  /** Empty state message */
  emptyState?: {
    message: string;
    subMessage?: string;
  };
  /** Whether to show empty state */
  showEmptyState?: boolean;
}

export function BaseProjectView({
  title,
  description,
  onBack,
  onToggleStar,
  isStarred = false,
  tabs,
  activeTab,
  onTabChange,
  onNewItem,
  newButtonLabel = 'New',
  menuContent,
  children,
  inputBar,
  sidebarSections,
  emptyState,
  showEmptyState = false,
}: BaseProjectViewProps) {
  const [isWide, setIsWide] = useState(true);

  useEffect(() => {
    const checkWidth = () => setIsWide(window.innerWidth >= 1200);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--ui-border-muted)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ width: 120 }} />

          <div style={{ textAlign: 'center', flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: 'var(--ui-text-primary)', marginBottom: 4 }}>
              {title}
            </h1>
            {description && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ui-text-muted)' }}>
                {description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 120, justifyContent: 'flex-end' }}>
            {onNewItem && (
              <button
                onClick={onNewItem}
                style={{
                  padding: '6px 12px',
                  height: 32,
                  background: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--ui-text-inverse)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'opacity var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                <Plus size={16} />
                {newButtonLabel}
              </button>
            )}

            {menuContent && <div style={{ position: 'relative' }}>{menuContent}</div>}

            {onToggleStar && (
              <button
                onClick={onToggleStar}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: isStarred ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => { if (!isStarred) e.currentTarget.style.color = 'var(--ui-text-secondary)'; }}
                onMouseLeave={(e) => { if (!isStarred) e.currentTarget.style.color = 'var(--ui-text-muted)'; }}
              >
                <Star size={18} fill={isStarred ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ui-text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'color var(--transition-fast)',
                  marginBottom: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ui-text-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ui-text-muted)'; }}
              >
                <ArrowLeft size={16} />
                <span>All projects</span>
              </button>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: activeTab === tab.id ? 'var(--surface-active)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all var(--transition-fast)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span style={{
                      fontSize: 11,
                      color: activeTab === tab.id ? 'var(--ui-text-secondary)' : 'var(--ui-text-muted)',
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isWide ? 'row' : 'column', overflow: 'hidden' }}>
        {/* Left content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px', minWidth: 0 }}>
          <div style={{ marginBottom: 24 }}>{inputBar}</div>

          {showEmptyState && emptyState ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              border: '1px solid var(--ui-border-muted)',
              borderRadius: 12,
            }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ui-text-muted)', textAlign: 'center' }}>
                {emptyState.message}
              </p>
              {emptyState.subMessage && (
                <p style={{ margin: '8px 0 0 0', fontSize: 13, color: 'var(--ui-text-muted)', textAlign: 'center', opacity: 0.7 }}>
                  {emptyState.subMessage}
                </p>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{
          width: isWide ? 320 : '100%',
          padding: isWide ? '24px 24px 24px 0' : '0 24px 24px',
          display: 'flex',
          flexDirection: isWide ? 'column' : 'row',
          gap: 16,
          overflow: isWide ? 'auto' : 'visible',
          flexShrink: 0,
          borderTop: isWide ? 'none' : '1px solid var(--ui-border-muted)',
        }}>
          <SidebarSection
            title="Memory"
            isWide={isWide}
            rightElement={<span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>Only you</span>}
          >
            {sidebarSections.memory || (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-muted)' }}>
                Project memory will show here after a few chats.
              </p>
            )}
          </SidebarSection>

          <SidebarSection
            title="Instructions"
            isWide={isWide}
            rightElement={
              <button
                onClick={sidebarSections.onAddInstruction}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none',
                  background: 'transparent', color: 'var(--ui-text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={16} />
              </button>
            }
          >
            {sidebarSections.instructions || (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-muted)' }}>
                Add instructions to tailor responses
              </p>
            )}
          </SidebarSection>

          <SidebarSection
            title="Files"
            isWide={isWide}
            rightElement={
              <button
                onClick={sidebarSections.onAddFile}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none',
                  background: 'transparent', color: 'var(--ui-text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={16} />
              </button>
            }
          >
            {sidebarSections.files || (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 40, background: 'var(--surface-hover)', borderRadius: 4, border: '1px solid var(--ui-border-muted)' }} />
                  <div style={{ width: 32, height: 40, background: 'var(--surface-hover)', borderRadius: 4, border: '1px solid var(--ui-border-muted)' }} />
                  <div style={{ width: 32, height: 40, background: 'var(--surface-active)', borderRadius: 4, border: '1px solid var(--ui-border-default)', transform: 'translateY(-4px)' }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-muted)', textAlign: 'center' }}>
                  Add PDFs, documents, or other text to reference in this project.
                </p>
              </div>
            )}
          </SidebarSection>
        </div>
      </div>
    </div>
  );
}

interface SidebarSectionProps {
  title: string;
  rightElement?: ReactNode;
  children: ReactNode;
  isWide: boolean;
}

function SidebarSection({ title, rightElement, children, isWide }: SidebarSectionProps) {
  return (
    <div style={{
      padding: 16,
      background: 'var(--surface-hover)',
      borderRadius: 12,
      border: '1px solid var(--ui-border-muted)',
      flex: isWide ? 'none' : 1,
      minWidth: isWide ? 'auto' : 200,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
          {title}
        </span>
        {rightElement}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ProjectMenuButton({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: isOpen ? 'var(--surface-active)' : 'transparent',
          color: 'var(--ui-text-muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--transition-fast)',
        }}
      >
        <DotsThreeOutline size={18} />
      </button>
      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIsOpen(false)} />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              minWidth: 160,
              background: 'var(--surface-floating)',
              borderRadius: 12,
              border: '1px solid var(--ui-border-default)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 9999,
              overflow: 'hidden',
              padding: '8px 0',
            }}
            onClick={() => setIsOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}

export interface ProjectItemCardProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  isActive?: boolean;
  icon?: ReactNode;
}

export function ProjectItemCard({ title, subtitle, onClick, isActive = false, icon }: ProjectItemCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 20px',
        background: isActive ? 'var(--surface-active)' : 'transparent',
        borderRadius: 12,
        border: `1px solid ${isActive ? 'var(--ui-border-default)' : 'var(--ui-border-muted)'}`,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all var(--transition-fast)',
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--surface-hover)';
          e.currentTarget.style.borderColor = 'var(--ui-border-default)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
        }
      }}
    >
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--surface-active)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ui-text-secondary)',
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: 'var(--ui-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export interface FileItemProps {
  name: string;
  size?: string;
  onDelete?: () => void;
}

export function FileItem({ name, size, onDelete }: FileItemProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'var(--surface-hover)',
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-primary)',
      }}>
        <FileText size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: 'var(--ui-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        {size && <div style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>{size}</div>}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--ui-text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export interface InstructionItemProps {
  text: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function InstructionItem({ text, onEdit, onDelete }: InstructionItemProps) {
  return (
    <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: 8, marginBottom: 8 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-secondary)', lineHeight: 1.5 }}>
        {text}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              padding: '4px 8px', background: 'transparent', border: 'none',
              color: 'var(--ui-text-muted)', fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <PencilSimple size={12} />
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px', background: 'transparent', border: 'none',
              color: 'var(--status-error)', fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Trash size={12} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

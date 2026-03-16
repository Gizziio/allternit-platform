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
import { ArrowLeft, MoreHorizontal, Star, Plus, FileText, X, Pencil, Trash2 } from 'lucide-react';

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
  // Responsive breakpoint
  const [isWide, setIsWide] = useState(true);

  useEffect(() => {
    const checkWidth = () => {
      setIsWide(window.innerWidth >= 1200);
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {/* Title row with actions on right */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          {/* Left spacer for balance */}
          <div style={{ width: 120 }} />

          {/* Centered Title */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 600,
              color: '#f0f0f0',
              marginBottom: 4,
            }}>
              {title}
            </h1>
            {description && (
              <p style={{
                margin: 0,
                fontSize: 14,
                color: '#6b6b6b',
              }}>
                {description}
              </p>
            )}
          </div>

          {/* Right side: New Button, Menu, Star */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 120,
            justifyContent: 'flex-end',
          }}>
            {/* New Chat/Task Button */}
            {onNewItem && (
              <button
                onClick={onNewItem}
                style={{
                  padding: '6px 12px',
                  height: 32,
                  background: 'linear-gradient(135deg, rgba(217,119,87,0.9) 0%, rgba(212,176,140,0.8) 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(217,119,87,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Plus size={16} />
                {newButtonLabel}
              </button>
            )}

            {menuContent && (
              <div style={{ position: 'relative' }}>
                {menuContent}
              </div>
            )}
            {onToggleStar && (
              <button
                onClick={onToggleStar}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: isStarred ? '#d4b08c' : '#6b6b6b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isStarred) e.currentTarget.style.color = '#9b9b9b';
                }}
                onMouseLeave={(e) => {
                  if (!isStarred) e.currentTarget.style.color = '#6b6b6b';
                }}
              >
                <Star size={18} fill={isStarred ? '#d4b08c' : 'none'} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs row with back button on left */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 20,
        }}>
          {/* Left side: Back button above tabs */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {/* Back button directly above tabs */}
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
                  color: '#6b6b6b',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  marginBottom: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#9b9b9b'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6b6b6b'}
              >
                <ArrowLeft size={16} />
                <span>All projects</span>
              </button>
            )}
            
            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: activeTab === tab.id 
                      ? 'rgba(255,255,255,0.08)' 
                      : 'transparent',
                    color: activeTab === tab.id ? '#f0f0f0' : '#6b6b6b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span style={{
                      fontSize: 11,
                      color: activeTab === tab.id ? '#9b9b9b' : '#4b4b4b',
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
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        overflow: 'hidden',
      }}>
        {/* Left content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '24px',
          minWidth: 0,
        }}>
          {/* Input bar at top */}
          <div style={{ marginBottom: 24 }}>
            {inputBar}
          </div>

          {/* Content or empty state */}
          {showEmptyState && emptyState ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
            }}>
              <p style={{
                margin: 0,
                fontSize: 14,
                color: '#6b6b6b',
                textAlign: 'center',
              }}>
                {emptyState.message}
              </p>
              {emptyState.subMessage && (
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: 13,
                  color: '#4b4b4b',
                  textAlign: 'center',
                }}>
                  {emptyState.subMessage}
                </p>
              )}
            </div>
          ) : (
            <div style={{
              flex: 1,
              overflow: 'auto',
            }}>
              {children}
            </div>
          )}
        </div>

        {/* Right sidebar (or bottom on small screens) */}
        <div style={{
          width: isWide ? 320 : '100%',
          padding: isWide ? '24px 24px 24px 0' : '0 24px 24px',
          display: 'flex',
          flexDirection: isWide ? 'column' : 'row',
          gap: 16,
          overflow: isWide ? 'auto' : 'visible',
          flexShrink: 0,
          borderTop: isWide ? 'none' : '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Memory Section */}
          <SidebarSection
            title="Memory"
            isWide={isWide}
            rightElement={<span style={{ fontSize: 12, color: '#4b4b4b' }}>Only you</span>}
          >
            {sidebarSections.memory || (
              <p style={{
                margin: 0,
                fontSize: 13,
                color: '#4b4b4b',
              }}>
                Project memory will show here after a few chats.
              </p>
            )}
          </SidebarSection>

          {/* Instructions Section */}
          <SidebarSection
            title="Instructions"
            isWide={isWide}
            rightElement={
              <button
                onClick={sidebarSections.onAddInstruction}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#6b6b6b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={16} />
              </button>
            }
          >
            {sidebarSections.instructions || (
              <p style={{
                margin: 0,
                fontSize: 13,
                color: '#4b4b4b',
              }}>
                Add instructions to tailor responses
              </p>
            )}
          </SidebarSection>

          {/* Files Section */}
          <SidebarSection
            title="Files"
            isWide={isWide}
            rightElement={
              <button
                onClick={sidebarSections.onAddFile}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#6b6b6b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={16} />
              </button>
            }
          >
            {sidebarSections.files || (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 0',
              }}>
                <div style={{
                  display: 'flex',
                  gap: 4,
                  marginBottom: 12,
                }}>
                  <div style={{
                    width: 32,
                    height: 40,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }} />
                  <div style={{
                    width: 32,
                    height: 40,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }} />
                  <div style={{
                    width: 32,
                    height: 40,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.08)',
                    transform: 'translateY(-4px)',
                  }} />
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 12,
                  color: '#4b4b4b',
                  textAlign: 'center',
                }}>
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

// Sidebar Section Component
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
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      flex: isWide ? 'none' : 1,
      minWidth: isWide ? 'auto' : 200,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#9b9b9b',
        }}>
          {title}
        </span>
        {rightElement}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}

// Project Menu Button Component
export function ProjectMenuButton({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: 'none',
          background: isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: '#6b6b6b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              minWidth: 160,
              background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
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

// Session/Task Card Component
export interface ProjectItemCardProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  isActive?: boolean;
  icon?: ReactNode;
}

export function ProjectItemCard({
  title,
  subtitle,
  onClick,
  isActive = false,
  icon,
}: ProjectItemCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 20px',
        background: isActive 
          ? 'rgba(255,255,255,0.05)' 
          : 'transparent',
        borderRadius: 12,
        border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all 0.2s',
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        }
      }}
    >
      {icon && (
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9b9b9b',
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 500,
          color: '#ececec',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 12,
            color: '#6b6b6b',
            marginTop: 2,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// File Item Component
export interface FileItemProps {
  name: string;
  size?: string;
  onDelete?: () => void;
}

export function FileItem({ name, size, onDelete }: FileItemProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: 'rgba(212,176,140,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#d4b08c',
      }}>
        <FileText size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: '#ececec',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        {size && (
          <div style={{ fontSize: 11, color: '#6b6b6b' }}>
            {size}
          </div>
        )}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#6b6b6b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// Instruction Item Component
export interface InstructionItemProps {
  text: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function InstructionItem({ text, onEdit, onDelete }: InstructionItemProps) {
  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <p style={{
        margin: 0,
        fontSize: 13,
        color: '#9b9b9b',
        lineHeight: 1.5,
      }}>
        {text}
      </p>
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 8,
      }}>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: '#6b6b6b',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

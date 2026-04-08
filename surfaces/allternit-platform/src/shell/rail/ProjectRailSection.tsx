import React, { useState, memo, useCallback } from 'react';
import {
  FolderOpen,
  FolderPlus,
  DotsThree,
  Pencil,
  Trash,
  Plus,
} from '@phosphor-icons/react';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

export interface UnifiedProject {
  id: string;
  title: string;
  itemIds: string[];
}

export interface UnifiedItem {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  projectId?: string;
  isActive: boolean;
  metaLabel?: string;
  unreadCount?: number;
  status?: string;
}

interface ProjectRailSectionProps {
  projects: UnifiedProject[];
  items: UnifiedItem[];
  activeProjectId: string | null;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onRenameProject: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenItem: (id: string) => void;
  onRenameItem: (id: string, title: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveItemToProject?: (itemId: string, projectId: string | null) => void;
  emptyNotice: {
    icon: React.ComponentType<any>;
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
  };
}

export const ProjectRailSection = memo(function ProjectRailSection({
  projects,
  items,
  activeProjectId,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onOpenItem,
  onRenameItem,
  onDeleteItem,
  onMoveItemToProject,
  emptyNotice,
}: ProjectRailSectionProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const projectItems = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return [];
    return items.filter((item) => project.itemIds.includes(item.id) || item.projectId === projectId);
  };

  const rootItems = items.filter((item) => {
    return !item.projectId && !projects.some((p) => p.itemIds.includes(item.id));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
      {/* Section Header */}
      <WorkstreamSectionLabel
        title="Projects"
        count={projects.length}
        caption="Shared organizer"
      />

      {/* New Project Button */}
      <div style={{ padding: '4px' }}>
        <button
          type="button"
          onClick={onCreateProject}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.background = 'var(--shell-item-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--shell-item-fg)';
            e.currentTarget.style.background = 'transparent';
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 14,
            border: 'none',
            background: 'transparent',
            color: 'var(--shell-item-fg)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
            fontWeight: 500,
          }}
        >
          <FolderPlus size={18} weight="bold" color="var(--accent-primary)" />
          <div style={{ minWidth: 0, fontSize: 13, fontWeight: 700 }}>New Project</div>
        </button>
      </div>

      {/* Projects List */}
      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.id);
        const pItems = projectItems(project.id);
        const isActive = activeProjectId === project.id;

        return (
          <div key={project.id}>
            <ProjectRailItem
              id={project.id}
              icon={FolderOpen}
              label={project.title}
              isActive={isActive}
              isExpanded={isExpanded}
              onToggle={() => toggleProject(project.id)}
              onClick={() => onOpenProject(project.id)}
              onRename={(title: string) => onRenameProject(project.id, title)}
              onDelete={() => onDeleteProject(project.id)}
              badge={pItems.length > 0 ? pItems.length : undefined}
            />

            {isExpanded && pItems.length > 0 && (
              <div
                style={{
                  marginLeft: 20,
                  paddingLeft: 8,
                  borderLeft: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  marginTop: 2,
                  marginBottom: 4,
                }}
              >
                {pItems.map((item) => (
                  <ItemRailRow
                    key={item.id}
                    item={item}
                    projects={projects}
                    onClick={() => onOpenItem(item.id)}
                    onRename={(title: string) => onRenameItem(item.id, title)}
                    onDelete={() => onDeleteItem(item.id)}
                    onMoveToProject={(pid: string) => onMoveItemToProject?.(item.id, pid)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Root Items List */}
      <div style={{ padding: '0 8px', marginTop: 8 }}>
        {rootItems.length > 0 ? (
          <>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '8px 4px 4px',
            }}>
              Recent Sessions
            </div>
            {rootItems.map((item) => (
              <ItemRailRow
                key={item.id}
                item={item}
                projects={projects}
                onClick={() => onOpenItem(item.id)}
                onRename={(title: string) => onRenameItem(item.id, title)}
                onDelete={() => onDeleteItem(item.id)}
                onMoveToProject={(pid: string) => onMoveItemToProject?.(item.id, pid)}
              />
            ))}
          </>
        ) : projects.length === 0 && (
          <GhostRailNotice
            icon={emptyNotice.icon}
            title={emptyNotice.title}
            description={emptyNotice.description}
            actionLabel={emptyNotice.actionLabel}
            onClick={emptyNotice.onAction}
          />
        )}
      </div>
    </div>
  );
});

function WorkstreamSectionLabel({
  title,
  count,
  caption,
}: {
  title: string;
  count?: number;
  caption?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '0 8px',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 1,
              borderRadius: 999,
              background: 'linear-gradient(90deg, var(--accent-chat), transparent)',
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent-secondary)',
            }}
          >
            {title}
          </span>
          {count !== undefined ? (
            <span
              style={{
                borderRadius: 999,
                border: '1px solid var(--shell-divider)',
                background: 'var(--shell-item-hover)',
                padding: '2px 6px',
                fontSize: 9,
                color: 'var(--shell-item-muted)',
              }}
            >
              {count}
            </span>
          ) : null}
        </div>
        {caption ? (
          <div style={{ fontSize: 11, color: 'var(--shell-item-muted)' }}>{caption}</div>
        ) : null}
      </div>
    </div>
  );
}

function ProjectRailItem({
  id,
  icon: Icon,
  label,
  isActive,
  isExpanded,
  onToggle,
  onClick,
  onRename,
  onDelete,
  badge,
}: any) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(label);

  const handleRename = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== label) {
      onRename?.(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(label);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 10,
          background: isActive ? 'var(--shell-item-active-bg)' : 'transparent',
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? 'var(--accent-chat)' : 'var(--text-tertiary)'} />}
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveRename}
          autoFocus
          style={{
            flex: 1,
            fontSize: 13,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: isActive ? 'var(--accent-chat)' : 'var(--text-tertiary)',
            fontWeight: isActive ? 700 : 500,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--shell-item-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px',
        borderRadius: 14,
        background: isActive
          ? 'var(--shell-item-active-bg)'
          : 'transparent',
        position: 'relative',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-muted)',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}
      >
        <Plus size={12} weight="bold" />
      </button>

      <button
        onClick={onClick}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 4px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{label}</span>
        {badge !== undefined && (
          <span style={{
            fontSize: 10,
            color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-muted)',
            background: isActive ? 'var(--surface-hover)' : 'var(--surface-panel-muted)',
            padding: '2px 6px',
            borderRadius: 8,
            fontWeight: 700
          }}>
            {badge}
          </span>
        )}
      </button>

      {/* Ellipsis Menu Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: showMenu ? 'var(--shell-item-hover)' : 'transparent',
            color: 'var(--shell-item-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
        >
          <DotsThree size={18} weight="bold" />
        </button>

        {showMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMenu(false)} />
            <div 
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                minWidth: 160,
                background: 'var(--glass-bg-thick)',
                borderRadius: 14, border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)', zIndex: 9999, overflow: 'hidden',
              }}
              onMouseEnter={(e) => { e.stopPropagation(); }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleRename(); }}
                style={{
                  width: '100%', padding: '10px 14px', border: 'none', background: 'transparent',
                  color: 'var(--shell-item-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 10, fontSize: 13, textAlign: 'left', transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Pencil size={16} /> Rename
              </button>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowMenu(false); }}
                style={{
                  width: '100%', padding: '10px 14px', border: 'none', background: 'transparent',
                  color: 'var(--status-error)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 10, fontSize: 13, textAlign: 'left', transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-danger-soft-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash size={16} /> Delete
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete Project?"
          itemName={label}
          itemType="project"
          onConfirm={() => { onDelete?.(); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function ItemRailRow({
  item,
  projects,
  onClick,
  onRename,
  onDelete,
  onMoveToProject,
}: {
  item: UnifiedItem;
  projects: UnifiedProject[];
  onClick: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMoveToProject?: (projectId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== item.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ padding: '4px 8px' }}>
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            else if (e.key === 'Escape') { setEditTitle(item.title); setIsEditing(false); }
          }}
          onBlur={handleSaveRename}
          autoFocus
          style={{
            width: '100%',
            fontSize: 12,
            background: 'var(--surface-floating-muted)',
            border: '1px solid var(--shell-dialog-border)',
            borderRadius: 6,
            padding: '4px 8px',
            color: 'var(--shell-item-fg)',
            outline: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={(e) => {
        if (!item.isActive) e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!item.isActive) e.currentTarget.style.background = 'transparent';
        // Don't close menu on mouse leave - let the overlay handle it
        // This fixes the bug where hovering over the dropdown makes options go blank
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 10,
        background: item.isActive ? 'var(--shell-item-active-bg)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <button
        onClick={onClick}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 0',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: item.isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
          cursor: 'pointer',
          textAlign: 'left',
          fontWeight: item.isActive ? 700 : 500,
        }}
      >
        <item.icon size={16} weight={item.isActive ? 'fill' : 'bold'} />
        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</span>
        {item.metaLabel && (
          <span style={{ fontSize: 10, color: 'var(--shell-item-muted)', opacity: 0.7 }}>{item.metaLabel}</span>
        )}
      </button>

      <div style={{ position: 'relative', padding: '4px', margin: '-4px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent',
            color: 'var(--shell-item-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', opacity: 0.6,
          }}
        >
          <DotsThree size={16} weight="bold" />
        </button>

        {showMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMenu(false)} />
            <div 
              style={{
                position: 'absolute', top: '100%', right: 4, marginTop: 0,
                minWidth: 160, background: 'var(--shell-menu-bg)', borderRadius: 12,
                border: '1px solid var(--shell-menu-border)', zIndex: 9999, overflow: 'hidden',
              }}
            >
              <button
                onClick={() => { setIsEditing(true); setShowMenu(false); }}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'var(--shell-item-fg)', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Rename
              </button>
              {onMoveToProject && (
                <div onMouseEnter={() => setShowProjects(true)} onMouseLeave={() => setShowProjects(false)} style={{ position: 'relative' }}>
                  <button
                    style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'var(--shell-item-fg)', textAlign: 'left', cursor: 'pointer', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
                  >
                    Move to Project <span>&gt;</span>
                  </button>
                  {showProjects && (
                    <div style={{ position: 'absolute', left: '-100%', top: 0, minWidth: 140, background: 'var(--shell-menu-bg)', border: '1px solid var(--shell-menu-border)', borderRadius: 12, overflow: 'hidden' }}>
                      <button
                        onClick={() => { onMoveToProject?.(''); setShowMenu(false); }}
                        style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', color: 'var(--shell-item-fg)', textAlign: 'left', cursor: 'pointer', fontSize: 11 }}
                      >
                        (No Project)
                      </button>
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { onMoveToProject?.(p.id); setShowMenu(false); }}
                          style={{ width: '100%', padding: '8px', background: 'transparent', border: 'none', color: 'var(--shell-item-fg)', textAlign: 'left', cursor: 'pointer', fontSize: 11 }}
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ height: 1, background: 'var(--shell-divider)' }} />
              <button
                onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'var(--status-error)', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-danger-soft-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete Item?"
          itemName={item.title}
          onConfirm={() => { onDelete(); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function GhostRailNotice({ icon: Icon, title, description, actionLabel, onClick }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', border: '1px dashed var(--border-default)', background: 'var(--bg-secondary)',
        borderRadius: 14, padding: '12px', textAlign: 'left', cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={20} color="var(--accent-chat)" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{actionLabel}</div>
    </button>
  );
}

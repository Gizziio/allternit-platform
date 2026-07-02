import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import type { Icon } from '@phosphor-icons/react';
import {
  FolderOpen,
  FolderPlus,
  DotsThree,
  Pencil,
  Trash,
  Plus,
} from '@phosphor-icons/react';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { cn } from '@/lib/utils';

export interface UnifiedProject {
  id: string;
  title: string;
  itemIds: string[];
}

export interface UnifiedItem {
  id: string;
  title: string;
  icon: Icon;
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
    icon: React.ComponentType<{ size?: number; weight?: string; color?: string }>;
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
  };
  sectionTitle?: string;
  sectionCaption?: string;
  newButtonLabel?: string;
  recentItemsLabel?: string;
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
  sectionTitle = 'Projects',
  sectionCaption = 'Shared organizer',
  newButtonLabel = 'New Project',
  recentItemsLabel = 'Recent Sessions',
}: ProjectRailSectionProps): React.ReactNode {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string): void => {
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
    <div className="flex flex-col gap-1 pb-1.5">
      {/* Section Header */}
      <WorkstreamSectionLabel
        title={sectionTitle}
        count={projects.length}
        caption={sectionCaption}
      />

      {/* New Project Button */}
      <div className="p-1">
        <button
          type="button"
          onClick={onCreateProject}
          className="w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl border-none bg-transparent text-[var(--shell-item-fg)] cursor-pointer text-left transition-all duration-200 font-medium hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
        >
          <FolderPlus size={18} weight="bold" className="text-[var(--accent-primary)]" />
          <div className="min-w-0 text-[13px] font-bold">{newButtonLabel}</div>
        </button>
      </div>

      {/* Projects List */}
      {projects.filter((p): p is typeof p & { id: string } => typeof p.id === 'string' && p.id.length > 0).map((project) => {
        const isExpanded = expandedProjects.has(project.id);
        const pItems = projectItems(project.id);
        const isActive = activeProjectId === project.id;

        return (
          <div key={project.id}>
            <ProjectRailItem
              id={project.id}
              icon={FolderOpen as any}
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
              <div className="ml-5 pl-2 border-l border-solid border-[var(--border-default)] flex flex-col gap-0.5 mt-0.5 mb-1">
                {pItems.filter((i): i is typeof i & { id: string } => typeof i.id === 'string' && i.id.length > 0).map((item) => (
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
      <div className="px-2 mt-2">
        {rootItems.length > 0 ? (
          <>
            <div className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.06em] p-[8px_4px_4px]">
              {recentItemsLabel}
            </div>
            {rootItems.filter((i): i is typeof i & { id: string } => typeof i.id === 'string' && i.id.length > 0).map((item) => (
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
}): React.ReactNode {
  return (
    <div className="flex items-center justify-between gap-2.5 px-2">
      <div className="min-w-0 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-px rounded-full bg-[linear-gradient(90deg,var(--accent-primary),transparent)]" />
          <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--accent-secondary)]">
            {title}
          </span>
          {count !== undefined ? (
            <span className="rounded-full border border-solid border-[var(--shell-divider)] bg-[var(--shell-item-hover)] px-1.5 py-0.5 text-[12px] text-[var(--shell-item-muted)]">
              {count}
            </span>
          ) : null}
        </div>
        {caption ? (
          <div className="text-[12px] text-[var(--shell-item-muted)]">{caption}</div>
        ) : null}
      </div>
    </div>
  );
}

interface ProjectRailItemProps {
  id: string;
  icon: React.ComponentType<{ size?: number; weight?: string; color?: string }>;
  label: string;
  isActive: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  onRename?: (title: string) => void;
  onDelete?: () => void;
  badge?: number;
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
}: ProjectRailItemProps): React.ReactNode {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(label);
  const dotsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [showMenu]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dotsButtonRef.current) {
      const rect = dotsButtonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowMenu(v => !v);
  };

  const handleRename = (): void => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveRename = (): void => {
    if (editTitle.trim() && editTitle !== label) {
      onRename?.(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(label);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className={cn("w-full flex items-center gap-2.5 p-[8px_12px] rounded-[10px]", isActive ? "bg-[var(--shell-item-active-bg)]" : "bg-transparent")}>
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)'} />}
        <input aria-label="Rename project" type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveRename}
          autoFocus
          className={cn("flex-1 text-[13px] bg-transparent border-none outline-none", isActive ? "text-[var(--accent-primary)] font-bold" : "text-[var(--text-tertiary)] font-medium")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("w-full flex items-center gap-1 p-1 rounded-2xl relative transition-all duration-200 group", isActive ? "bg-[var(--shell-item-active-bg)] shadow-[var(--shadow-sm)]" : "bg-transparent hover:bg-[var(--shell-item-hover)]")}
    >
      <button type="button"
        onClick={onToggle}
        className={cn("bg-transparent border-none p-0 w-6 h-6 flex items-center justify-center cursor-pointer transition-transform duration-200", isExpanded ? "rotate-90" : "rotate-0", isActive ? "text-[var(--shell-item-active-fg)]" : "text-[var(--shell-item-muted)]")}
      >
        <Plus size={12} weight="bold" />
      </button>

      <button type="button"
        onClick={onClick}
        className={cn("flex-1 min-w-0 flex items-center gap-2.5 p-[6px_4px] rounded-md border-none bg-transparent cursor-pointer text-left transition-all duration-200", isActive ? "text-[var(--shell-item-active-fg)] font-bold" : "text-[var(--shell-item-fg)] font-medium")}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
        <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{label}</span>
        {badge !== undefined && (
          <span className={cn("text-[12px] px-1.5 py-0.5 rounded-lg font-bold", isActive ? "text-[var(--shell-item-active-fg)] bg-[var(--surface-hover)]" : "text-[var(--shell-item-muted)] bg-[var(--surface-panel-muted)]")}>
            {badge}
          </span>
        )}
      </button>

      {/* Ellipsis Menu Button */}
      <div className="relative">
        <button type="button"
          ref={dotsButtonRef}
          onClick={openMenu}
          className={cn("w-6 h-6 rounded-md border-none cursor-pointer flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100", showMenu ? "bg-[var(--shell-item-hover)] text-[var(--shell-item-muted)] opacity-100" : "bg-transparent text-[var(--shell-item-muted)] hover:opacity-100")}
        >
          <DotsThree size={18} weight="bold" />
        </button>

        {showMenu && typeof document !== 'undefined' && createPortal(
          <>
            <div role="button" tabIndex={0} style={{ position: 'fixed', inset: 0, zIndex: 1200 }} onClick={() => setShowMenu(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMenu(false); }} />
            <div
              className="fixed min-w-[160px] bg-[var(--shell-menu-bg)] rounded-xl border border-solid border-[var(--shell-menu-border)] z-[1201] overflow-hidden shadow-[var(--shadow-lg)]"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button type="button"
                onClick={(e) => { e.stopPropagation(); handleRename(); setShowMenu(false); }}
                className="w-full p-[10px_14px] border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer flex items-center gap-2.5 text-[13px] text-left transition-colors hover:bg-[var(--shell-item-hover)]"
              >
                <Pencil size={16} /> Rename
              </button>
              <div className="h-px bg-[var(--border-subtle)] my-1" />
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowMenu(false); }}
                className="w-full p-[10px_14px] border-none bg-transparent text-[var(--status-error)] cursor-pointer flex items-center gap-2.5 text-[13px] text-left transition-colors hover:bg-[var(--shell-danger-soft-bg)]"
              >
                <Trash size={16} /> Delete
              </button>
            </div>
          </>,
          document.body
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
}): React.ReactNode {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [showProjects, setShowProjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dotsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [showMenu]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dotsButtonRef.current) {
      const rect = dotsButtonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowMenu(v => !v);
  };

  const handleSaveRename = (): void => {
    if (editTitle.trim() && editTitle !== item.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-[4px_8px]">
        <input aria-label="Edit project title" value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            else if (e.key === 'Escape') { setEditTitle(item.title); setIsEditing(false); }
          }}
          onBlur={handleSaveRename}
          autoFocus
          className="w-full text-[12px] bg-[var(--surface-floating-muted)] border border-solid border-[var(--shell-dialog-border)] rounded-md p-[4px_8px] text-[var(--shell-item-fg)] outline-none"
        />
      </div>
    );
  }

  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={cn(
        "w-full flex items-center gap-1 p-[4px_8px] rounded-[10px] cursor-pointer transition-colors duration-200",
        item.isActive ? "bg-[var(--shell-item-active-bg)]" : "bg-transparent hover:bg-[var(--surface-hover)]"
      )}
    >
      <div
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2.5 p-[4px_0]",
          item.isActive ? "text-[var(--shell-item-active-fg)] font-bold" : "text-[var(--shell-item-fg)] font-medium"
        )}
      >
        <item.icon size={16} weight={item.isActive ? 'fill' : 'bold'} />
        <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap flex-1">{item.title}</span>
        {item.metaLabel && (
          <span className="text-[12px] text-[var(--shell-item-muted)] opacity-70">{item.metaLabel}</span>
        )}
      </div>

      <div
        role="button" tabIndex={0}
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button type="button"
          ref={dotsButtonRef}
          onClick={openMenu}
          className="w-[22px] h-[22px] rounded-md border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
        >
          <DotsThree size={16} weight="bold" />
        </button>

        {showMenu && typeof document !== 'undefined' && createPortal(
          <>
            <div role="button" tabIndex={0} className="fixed inset-0 z-[1200]" onClick={() => setShowMenu(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMenu(false); }} />
            <div
              className="fixed min-w-[160px] bg-[var(--shell-menu-bg)] rounded-xl border border-solid border-[var(--shell-menu-border)] z-[1201] overflow-hidden shadow-[var(--shadow-lg)]"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); }}
                className="w-full p-2.5 bg-transparent border-none text-[var(--shell-item-fg)] text-left cursor-pointer text-[12px] hover:bg-[var(--shell-item-hover)]"
              >
                Rename
              </button>
              {onMoveToProject && (
                <div onMouseEnter={() => setShowProjects(true)} onMouseLeave={() => setShowProjects(false)} className="relative">
                  <button type="button"
                    className="w-full p-2.5 bg-transparent border-none text-[var(--shell-item-fg)] text-left cursor-pointer text-[12px] flex justify-between items-center hover:bg-[var(--shell-item-hover)]"
                  >
                    Move to Project <DotsThree size={14} />
                  </button>
                  {showProjects && (
                    <div className="absolute left-[-100%] top-0 min-w-[140px] bg-[var(--shell-menu-bg)] border border-solid border-[var(--shell-menu-border)] rounded-xl overflow-hidden z-[1202] shadow-[var(--shadow-lg)]">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveToProject?.(''); setShowMenu(false); }}
                        className="w-full p-2 bg-transparent border-none text-[var(--shell-item-fg)] text-left cursor-pointer text-[12px] hover:bg-[var(--shell-item-hover)]"
                      >
                        (No Project)
                      </button>
                      {projects.filter((p): p is typeof p & { id: string } => typeof p.id === 'string' && p.id.length > 0).map(p => (
                        <button type="button"
                          key={p.id}
                          onClick={(e) => { e.stopPropagation(); onMoveToProject?.(p.id); setShowMenu(false); }}
                          className="w-full p-2 bg-transparent border-none text-[var(--shell-item-fg)] text-left cursor-pointer text-[12px] hover:bg-[var(--shell-item-hover)]"
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="h-px bg-[var(--shell-divider)] my-1" />
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowMenu(false); }}
                className="w-full p-2.5 bg-transparent border-none text-[var(--status-error)] text-left cursor-pointer text-[12px] hover:bg-[var(--shell-danger-soft-bg)]"
              >
                Delete
              </button>
            </div>
          </>,
          document.body
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete Item?"
          itemName={item.title}
          itemType="task"
          onConfirm={() => { onDelete(); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function GhostRailNotice({ icon: Icon, title, description, actionLabel, onClick }: {
  icon: React.ComponentType<{ size?: number; weight?: string; color?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
}): React.ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      className="w-full border border-dashed border-[var(--border-default)] bg-transparent rounded-2xl p-3 text-left cursor-pointer hover:bg-[var(--shell-item-hover)] transition-all"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[var(--accent-primary)]">
          <Icon size={20} />
        </span>
        <div>
          <div className="text-[12px] font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{description}</div>
        </div>
      </div>
      <div className="mt-2 text-[12px] font-bold text-[var(--accent-primary)] uppercase tracking-wider">{actionLabel}</div>
    </button>
  );
}

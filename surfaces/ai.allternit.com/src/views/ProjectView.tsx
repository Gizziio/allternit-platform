"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useUnifiedProjects } from '@/views/project/unified/useUnifiedProjects';
import { ProjectDetailRouter } from '@/views/project/unified/ProjectDetailRouter';
import type { UnifiedProject, ProjectCategory, ProjectMode } from '@/views/project/unified/types';
import {
  ChatTeardropText,
  CheckSquare,
  Code,
  Palette,
  Plus,
  MagnifyingGlass,
  Star,
  Archive,
  Trash,
  DotsThreeOutline,
  CaretDown,
  FolderOpen,
  PencilSimple,
  PushPin,
  TerminalWindow,
} from '@phosphor-icons/react';

const CATEGORY_CONFIG: Record<
  ProjectCategory,
  { label: string; icon: React.ElementType }
> = {
  all: { label: 'All Projects', icon: FolderOpen },
  chat: { label: 'Chat', icon: ChatTeardropText },
  cowork: { label: 'Cowork', icon: CheckSquare },
  code: { label: 'Code', icon: Code },
  design: { label: 'Design', icon: Palette },
  bb: { label: 'bb', icon: TerminalWindow },
};

type SortMode = 'recent' | 'name' | 'created';

function formatCardDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return 'today';
  if (ts >= startOfToday - 24 * 60 * 60 * 1000) return 'yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'name', label: 'Name' },
  { id: 'created', label: 'Date created' },
];

export function ProjectView(): React.ReactNode {
  const {
    allProjects,
    stats,
    createProject,
    toggleFavorite,
    toggleArchive,
    deleteProject,
    updateProjectDetails,
  } = useUnifiedProjects();

  const [selectedProject, setSelectedProject] = useState<UnifiedProject | null>(null);

  // Re-clicking "Projects" in the rail re-focuses this same singleton view rather than
  // remounting it, so without this listener the detail view would never clear.
  useEffect(() => {
    const reset = () => setSelectedProject(null);
    window.addEventListener('allternit:projects-reset', reset);
    return () => window.removeEventListener('allternit:projects-reset', reset);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMode, setCreateMode] = useState<ProjectMode>('chat');
  const [editProjectData, setEditProjectData] = useState<UnifiedProject | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteProjectData, setDeleteProjectData] = useState<UnifiedProject | null>(null);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allProjects
      .filter((p) => {
        if (!showArchived && p.isArchived) return false;
        if (activeCategory !== 'all' && p.mode !== activeCategory) return false;
        if (query && !p.title.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        }
        if (sortBy === 'name') return a.title.localeCompare(b.title);
        return b.createdAt - a.createdAt;
      });
  }, [allProjects, activeCategory, searchQuery, showArchived, sortBy]);

  const activeCategoryLabel = CATEGORY_CONFIG[activeCategory];
  const activeSortLabel = SORT_OPTIONS.find((s) => s.id === sortBy)?.label ?? SORT_OPTIONS[0].label;

  const openCreateModal = () => {
    setCreateName('');
    setCreateMode(activeCategory === 'all' ? 'chat' : activeCategory);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateName('');
  };

  const handleCreateConfirm = () => {
    const name = createName.trim();
    if (!name) return;
    const mode = activeCategory === 'all' ? createMode : activeCategory;
    createProject(mode, name);
    closeCreateModal();
  };

  const openEditModal = (project: UnifiedProject) => {
    setEditProjectData(project);
    setEditName(project.title);
    setEditDescription(project.description ?? '');
  };

  const closeEditModal = () => {
    setEditProjectData(null);
    setEditName('');
    setEditDescription('');
  };

  const handleEditConfirm = () => {
    const name = editName.trim();
    if (!name || !editProjectData) return;
    updateProjectDetails(editProjectData, { title: name, description: editDescription.trim() });
    closeEditModal();
  };

  const handleProjectClick = (project: UnifiedProject) => {
    setSelectedProject(project);
  };

  const handleBack = () => {
    setSelectedProject(null);
  };

  if (selectedProject) {
    return <ProjectDetailRouter project={selectedProject} onBack={handleBack} />;
  }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1
            className="text-3xl font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Projects
          </h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                >
                  <activeCategoryLabel.icon size={14} />
                  <span className="font-medium text-[var(--text-primary)]">{activeCategoryLabel.label}</span>
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(CATEGORY_CONFIG) as ProjectCategory[]).map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <DropdownMenuItem
                      key={cat}
                      onSelect={() => setActiveCategory(cat)}
                      className={cn(cat === activeCategory && 'font-medium')}
                    >
                      <cfg.icon size={16} className="mr-2" />
                      {cfg.label}
                      <span className="ml-auto text-xs text-[var(--text-tertiary)]">
                        {stats[cat === 'all' ? 'total' : cat]}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                >
                  Sort by <span className="font-medium text-[var(--text-primary)]">{activeSortLabel}</span>
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.id}
                    onSelect={() => setSortBy(opt.id)}
                    className={cn(opt.id === sortBy && 'font-medium')}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-sm transition-colors',
                showArchived
                  ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
              )}
            >
              <Archive size={14} />
              Archived
              <span className="text-xs text-[var(--text-tertiary)]">{stats.archived}</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--bg-elevated)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              New
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <MagnifyingGlass
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects…"
            className="pl-10 h-11 rounded-xl border-[var(--border-default)] text-[15px]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Content */}
        <div className="mt-8">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <FolderOpen size={48} className="text-[var(--text-tertiary)] opacity-40" />
              <div className="text-sm text-[var(--text-secondary)]">
                {searchQuery ? 'No projects match your search.' : 'No projects yet.'}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] max-w-sm text-center">
                Create a project to organize your chats, tasks, code workspaces, and design canvases.
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--bg-elevated)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={16} />
                Create project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => handleProjectClick(project)}
                  onToggleFavorite={(e) => {
                    e.stopPropagation();
                    toggleFavorite(project);
                  }}
                  onToggleArchive={(e) => {
                    e.stopPropagation();
                    toggleArchive(project);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    setDeleteProjectData(project);
                  }}
                  onEditDetails={() => openEditModal(project)}
                />
              ))}

              {/* Create New Card */}
              <div
                onClick={openCreateModal}
                className="group rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)] cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[180px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"
              >
                <Plus size={28} weight="bold" className="group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">New project</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        name={createName}
        onNameChange={setCreateName}
        mode={createMode}
        onModeChange={setCreateMode}
        onConfirm={handleCreateConfirm}
        allowModeSelect={activeCategory === 'all'}
      />

      <EditProjectDetailsModal
        isOpen={editProjectData !== null}
        name={editName}
        onNameChange={setEditName}
        description={editDescription}
        onDescriptionChange={setEditDescription}
        onConfirm={handleEditConfirm}
        onCancel={closeEditModal}
      />

      <ConfirmModal
        isOpen={deleteProjectData !== null}
        title="Delete Project"
        message={
          deleteProjectData
            ? `Delete "${deleteProjectData.title}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteProjectData) {
            deleteProject(deleteProjectData);
          }
          setDeleteProjectData(null);
        }}
        onCancel={() => setDeleteProjectData(null)}
      />
    </div>
  );
}

interface EditProjectDetailsModalProps {
  isOpen: boolean;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function EditProjectDetailsModal({
  isOpen,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onConfirm,
  onCancel,
}: EditProjectDetailsModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="small">
      <ModalHeader title="Edit details" onClose={onCancel} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="edit-project-name"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Name
              </label>
              <input
                id="edit-project-name"
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="w-full h-10 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="edit-project-description"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Description
              </label>
              <textarea
                id="edit-project-description"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors resize-y"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={onCancel} variant="secondary">
            Cancel
          </ModalButton>
          <ModalButton type="submit" variant="primary" disabled={!name.trim()}>
            Save
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
  onConfirm: () => void;
  allowModeSelect: boolean;
}

function CreateProjectModal({
  isOpen,
  onClose,
  name,
  onNameChange,
  mode,
  onModeChange,
  onConfirm,
  allowModeSelect,
}: CreateProjectModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="small">
      <ModalHeader title="Create new project" onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="project-name"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Project name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Q3 Marketing Campaign"
                autoFocus
                className="w-full h-10 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>

            {allowModeSelect && (
              <div>
                <span className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Project type
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as ProjectCategory[])
                    .filter((cat) => cat !== 'all')
                    .map((cat) => {
                      const cfg = CATEGORY_CONFIG[cat];
                      const isSelected = mode === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => onModeChange(cat)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                            isSelected
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                              : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                          )}
                        >
                          <cfg.icon size={16} />
                          {cfg.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={onClose} variant="secondary">
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            disabled={!name.trim()}
          >
            Create project
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface ProjectCardProps {
  project: UnifiedProject;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onToggleArchive: (e: Event) => void;
  onDelete: (e: Event) => void;
  onEditDetails: () => void;
}

const MODE_ACCENT: Record<ProjectCategory, string> = {
  all: 'var(--accent-primary)',
  chat: 'var(--accent-chat)',
  cowork: 'var(--accent-cowork)',
  code: 'var(--accent-code)',
  design: 'var(--accent-primary)',
  bb: 'var(--accent-primary)',
};

const MODE_ICONS: Record<ProjectCategory, React.ElementType> = {
  all: FolderOpen,
  chat: ChatTeardropText,
  cowork: CheckSquare,
  code: Code,
  design: Palette,
  bb: TerminalWindow,
};

function ProjectCard({
  project,
  onClick,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  onEditDetails,
}: ProjectCardProps) {
  const Icon = MODE_ICONS[project.mode];
  const accent = MODE_ACCENT[project.mode];

  const desc = useMemo(() => {
    const parts: string[] = [];
    if (project.mode === 'chat') {
      parts.push(`${project.threadCount} threads`);
      if (project.taskCount > 0) parts.push(`${project.taskCount} agents`);
    } else if (project.mode === 'cowork') {
      parts.push(`${project.taskCount} tasks`);
    } else if (project.mode === 'code') {
      parts.push(`${project.threadCount} sessions`);
    } else if (project.mode === 'design') {
      parts.push(`${project.fileCount} canvases`);
    } else if (project.mode === 'bb') {
      parts.push('bb project');
    }
    return parts.join(' • ') || 'Active workspace';
  }, [project]);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-solid bg-[var(--bg-elevated)] hover:bg-[var(--surface-hover)] cursor-pointer transition-all duration-200 flex flex-col gap-4 relative',
        project.isArchived
          ? 'opacity-60 border-[var(--border-subtle)]'
          : 'border-[var(--border-default)] hover:border-[var(--border-hover)]'
      )}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 group-hover:w-1.5"
        style={{ backgroundColor: accent }}
      />

      <div className="p-5 flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between">
          <div
            className="size-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            <Icon size={20} weight="duotone" />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleFavorite}
              className={cn(
                'p-1.5 rounded-lg border-none bg-transparent cursor-pointer transition-colors',
                project.isFavorite
                  ? 'text-yellow-500'
                  : 'text-[var(--text-tertiary)] hover:text-yellow-500'
              )}
              title={project.isFavorite ? 'Unfavorite' : 'Favorite'}
            >
              <Star size={16} weight={project.isFavorite ? 'fill' : 'regular'} />
            </button>
            <ProjectCardMenu
              project={project}
              onToggleArchive={onToggleArchive}
              onDelete={onDelete}
              onEditDetails={onEditDetails}
              onTogglePin={onToggleFavorite}
            />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-medium text-[15px] text-[var(--text-primary)] transition-colors leading-snug">
            {project.title}
          </h3>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-1 capitalize">{desc}</p>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-[var(--text-tertiary)]">
            {project.updatedAt > 0 && <span>Updated {formatCardDate(project.updatedAt)}</span>}
            {project.updatedAt > 0 && project.createdAt > 0 && <span aria-hidden>&middot;</span>}
            {project.createdAt > 0 && <span>Created {formatCardDate(project.createdAt)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCardMenu({
  project,
  onToggleArchive,
  onDelete,
  onEditDetails,
  onTogglePin,
}: {
  project: UnifiedProject;
  onToggleArchive: (e: Event) => void;
  onDelete: (e: Event) => void;
  onEditDetails: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg border-none bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
        >
          <DotsThreeOutline size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="min-w-[160px] z-[9999] bg-[var(--surface-floating)] border-[var(--border-default)] shadow-xl"
      >
        <DropdownMenuItem
          onSelect={(e) => onTogglePin(e as unknown as React.MouseEvent)}
          className="cursor-pointer"
        >
          <PushPin size={16} className="mr-2" />
          {project.isFavorite ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEditDetails} className="cursor-pointer">
          <PencilSimple size={16} className="mr-2" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleArchive} className="cursor-pointer">
          <Archive size={16} className="mr-2" />
          {project.isArchived ? 'Unarchive' : 'Archive'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDelete}
          className="cursor-pointer text-[var(--status-error)] focus:text-[var(--status-error)]"
        >
          <Trash size={16} className="mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProjectView;

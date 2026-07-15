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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from '@/components/ui/Modal';
import {
  CaretRight,
  ChatTeardropText,
  DotsThreeOutline,
  HandWaving,
  Plus,
  PushPin,
  FileText,
  X,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';

interface ProjectViewTab {
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 px-8 pb-4 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-[var(--ui-text-muted)] mb-5">
          <button type="button"
            onClick={onBack}
            className="p-0 bg-transparent border-none text-[var(--ui-text-muted)] text-[13px] cursor-pointer transition-colors duration-150 hover:text-[var(--ui-text-primary)]"
          >
            Projects
          </button>
          <CaretRight size={11} aria-hidden />
          <span className="text-[var(--ui-text-secondary)] truncate max-w-[360px]">{title}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1
              className="m-0 text-[32px] font-medium tracking-tight text-[var(--ui-text-primary)] mb-1.5"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {title}
            </h1>
            {description && (
              <p className="m-0 text-[15px] leading-relaxed text-[var(--ui-text-secondary)] max-w-2xl">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onNewItem && (
              <button type="button"
                data-testid="project-view-new-item-btn"
                onClick={onNewItem}
                className="px-3 h-8 bg-[var(--accent-primary)] border-none rounded-lg text-[var(--ui-text-inverse)] text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 transition-opacity duration-150 hover:opacity-90 active:scale-95 whitespace-nowrap mr-1"
              >
                <Plus size={16} />
                {newButtonLabel}
              </button>
            )}

            {onToggleStar && (
              <button type="button"
                onClick={onToggleStar}
                title={isStarred ? 'Unpin project' : 'Pin project'}
                className={`size-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center transition-colors duration-150 ${
                  isStarred ? 'text-[var(--accent-primary)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
                }`}
              >
                <PushPin size={18} weight={isStarred ? 'fill' : 'regular'} />
              </button>
            )}

            {menuContent && <div className="relative">{menuContent}</div>}
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex items-center justify-between mt-5">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2" data-testid="project-view-tabs">
              {tabs.map((tab) => (
                <button type="button"
                  key={tab.id}
                  data-testid={`project-view-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-4 py-2 rounded-lg border-none flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap text-[13px] font-semibold cursor-pointer ${
                    activeTab === tab.id 
                      ? 'bg-[var(--surface-active)] text-[var(--ui-text-primary)]' 
                      : 'bg-transparent text-[var(--ui-text-muted)] hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-[12px] ${
                      activeTab === tab.id ? 'text-[var(--ui-text-secondary)]' : 'text-[var(--ui-text-muted)]'
                    }`}>
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
      <div className={`flex-1 flex overflow-hidden ${isWide ? 'flex-row' : 'flex-col'}`}>
        {/* Left content */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 min-w-0">
          <div className="mb-6 shrink-0">{inputBar}</div>

          {showEmptyState && emptyState ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 px-5">
              <ChatTeardropText size={32} className="text-[var(--ui-text-muted)]" aria-hidden />
              <p className="m-0 text-[15px] text-[var(--ui-text-secondary)] text-center">
                {emptyState.message}
              </p>
              {emptyState.subMessage && (
                <p className="m-0 text-[13px] text-[var(--ui-text-muted)] text-center max-w-sm">
                  {emptyState.subMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">{children}</div>
          )}
        </div>

        {/* Right sidebar */}
        <div className={`shrink-0 flex gap-4 ${
          isWide 
            ? 'w-[320px] p-6 pl-0 flex-col overflow-auto' 
            : 'w-full p-6 pt-0 flex-row overflow-visible border-t border-[var(--ui-border-muted)]'
        }`}>
          {isWide && (
            <div className="p-5 bg-[var(--surface-active)] rounded-2xl shrink-0">
              <HandWaving size={22} className="text-[var(--ui-text-secondary)] mb-3" aria-hidden />
              <div className="text-[14px] font-semibold text-[var(--ui-text-primary)] mb-2">
                Add relevant context for your project
              </div>
              <p className="m-0 text-[13px] leading-relaxed text-[var(--ui-text-secondary)]">
                Upload documents, code, and other files to the project to reference them in your sessions.
              </p>
            </div>
          )}

          <SidebarSection
            title="Memory"
            isWide={isWide}
            rightElement={
              <span className="text-[12px] text-[var(--ui-text-muted)] px-2 py-0.5 rounded-full border border-solid border-[var(--ui-border-muted)]">
                Only you
              </span>
            }
          >
            {sidebarSections.memory || (
              <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
                Project memory will show here after a few chats.
              </p>
            )}
          </SidebarSection>

          <SidebarSection
            title="Instructions"
            isWide={isWide}
            rightElement={
              sidebarSections.onAddInstruction ? (
                <button type="button"
                  onClick={sidebarSections.onAddInstruction}
                  className="size-6 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5 transition-colors"
                >
                  <Plus size={16} />
                </button>
              ) : null
            }
          >
            {sidebarSections.instructions || (
              <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
                Add instructions to tailor responses
              </p>
            )}
          </SidebarSection>

          <SidebarSection
            title="Context"
            isWide={isWide}
            rightElement={
              sidebarSections.onAddFile ? (
                <button type="button"
                  onClick={sidebarSections.onAddFile}
                  className="size-6 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5 transition-colors"
                >
                  <Plus size={16} />
                </button>
              ) : null
            }
          >
            {sidebarSections.files || (
              <div className="flex flex-col items-center py-5">
                <div className="flex gap-1 mb-3">
                  <div className="w-8 h-10 bg-[var(--surface-hover)] rounded border border-[var(--ui-border-muted)]" />
                  <div className="w-8 h-10 bg-[var(--surface-hover)] rounded border border-[var(--ui-border-muted)]" />
                  <div className="w-8 h-10 bg-[var(--surface-active)] rounded border border-[var(--ui-border-default)] -translate-y-1" />
                </div>
                <p className="m-0 text-[12px] text-[var(--ui-text-muted)] text-center">
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

interface ProjectItemCardProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  isActive?: boolean;
  icon?: ReactNode;
  actions?: ReactNode;
}

interface FileItemProps {
  name: string;
  size?: string;
  onDelete?: () => void;
}

interface InstructionItemProps {
  text: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

function SidebarSection({ title, rightElement, children, isWide }: SidebarSectionProps) {
  return (
    <div className={`p-4 bg-[var(--surface-hover)] rounded-xl border border-[var(--ui-border-muted)] ${
      isWide ? 'shrink-0' : 'flex-1 min-w-[200px]'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-[var(--ui-text-secondary)]">
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
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`size-8 rounded-lg border-none cursor-pointer flex items-center justify-center transition-all duration-150 ${
          isOpen ? 'bg-[var(--surface-active)] text-[var(--ui-text-primary)]' : 'bg-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
        }`}
      >
        <DotsThreeOutline size={18} />
      </button>
      {isOpen && (
        <>
          <div role="button" tabIndex={0} className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(false); }} />
          <div role="button" tabIndex={0}
            className="absolute top-full right-0 mt-2 min-w-[160px] bg-[var(--surface-floating)] rounded-xl border border-[var(--ui-border-default)] shadow-lg z-[9999] overflow-hidden py-2"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(false); }}
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}

export function ProjectItemCard({ title, subtitle, onClick, isActive = false, icon, actions }: ProjectItemCardProps) {
  return (
    <div role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) onClick(); }}
      className={`p-4 px-5 rounded-xl border flex items-center gap-3 transition-all duration-150 mb-2 cursor-pointer ${
        isActive 
          ? 'bg-[var(--surface-active)] border-[var(--ui-border-default)]' 
          : 'bg-transparent border-[var(--ui-border-muted)] hover:bg-[var(--surface-hover)] hover:border-[var(--ui-border-default)]'
      }`}
    >
      {icon && (
        <div className="size-9 rounded-lg bg-[var(--surface-active)] flex items-center justify-center text-[var(--ui-text-secondary)]">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--ui-text-primary)] truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div role="button" tabIndex={0}
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export function FileItem({ name, size, onDelete }: FileItemProps) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 px-3 bg-[var(--surface-hover)] rounded-lg mb-2">
      <div className="size-8 rounded-lg bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-panel))] flex items-center justify-center text-[var(--accent-primary)]">
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--ui-text-primary)] truncate">
          {name}
        </div>
        {size && <div className="text-[12px] text-[var(--ui-text-muted)]">{size}</div>}
      </div>
      {onDelete && (
        <button type="button"
          onClick={onDelete}
          className="size-6 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function InstructionItem({ text, onEdit, onDelete }: InstructionItemProps) {
  return (
    <div className="p-3 bg-[var(--surface-hover)] rounded-lg mb-2">
      <p className="m-0 text-[13px] text-[var(--ui-text-secondary)] leading-relaxed">
        {text}
      </p>
      <div className="flex gap-2 mt-2">
        {onEdit && (
          <button type="button"
            onClick={onEdit}
            className="p-1 px-2 bg-transparent border-none text-[var(--ui-text-muted)] text-[12px] cursor-pointer flex items-center gap-1 hover:text-[var(--ui-text-primary)] transition-colors"
          >
            <PencilSimple size={12} />
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button"
            onClick={onDelete}
            className="p-1 px-2 bg-transparent border-none text-[var(--status-error)] text-[12px] cursor-pointer flex items-center gap-1 hover:brightness-110 transition-colors"
          >
            <Trash size={12} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

interface ProjectEditDetailsModalProps {
  isOpen: boolean;
  initialName: string;
  initialDescription?: string;
  onConfirm: (details: { title: string; description: string }) => void;
  onCancel: () => void;
}

export function ProjectEditDetailsModal({
  isOpen,
  initialName,
  initialDescription = '',
  onConfirm,
  onCancel,
}: ProjectEditDetailsModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm({ title: name.trim(), description: description.trim() });
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="small">
      <ModalHeader title="Edit details" onClose={onCancel} />
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="project-edit-name"
                className="block text-sm font-medium text-[var(--ui-text-secondary)] mb-1.5"
              >
                Name
              </label>
              <input
                id="project-edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="w-full h-10 px-3.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--bg-primary)] text-[var(--ui-text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="project-edit-description"
                className="block text-sm font-medium text-[var(--ui-text-secondary)] mb-1.5"
              >
                Description
              </label>
              <textarea
                id="project-edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--bg-primary)] text-[var(--ui-text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors resize-y"
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

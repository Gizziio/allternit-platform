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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 px-6 pb-4 border-b border-[var(--ui-border-muted)] shrink-0">
        <div className="flex items-start justify-between">
          <div className="w-[120px]" />

          <div className="text-center flex-1">
            <h1 className="m-0 text-[28px] font-semibold text-[var(--ui-text-primary)] mb-1">
              {title}
            </h1>
            {description && (
              <p className="m-0 text-sm text-[var(--ui-text-muted)]">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 w-[120px] justify-end">
            {onNewItem && (
              <button
                onClick={onNewItem}
                className="px-3 h-8 bg-[var(--accent-primary)] border-none rounded-lg text-[var(--ui-text-inverse)] text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 transition-opacity duration-150 hover:opacity-90 active:scale-95 whitespace-nowrap"
              >
                <Plus size={16} />
                {newButtonLabel}
              </button>
            )}

            {menuContent && <div className="relative">{menuContent}</div>}

            {onToggleStar && (
              <button
                onClick={onToggleStar}
                className={`size-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center transition-colors duration-150 ${
                  isStarred ? 'text-[var(--accent-primary)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
                }`}
              >
                <Star size={18} fill={isStarred ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex items-center justify-between mt-5">
          <div className="flex flex-col gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 p-0 bg-transparent border-none text-[var(--ui-text-muted)] text-[13px] cursor-pointer transition-colors duration-150 mb-1 hover:text-[var(--ui-text-secondary)]"
              >
                <ArrowLeft size={16} />
                <span>All projects</span>
              </button>
            )}

            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
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
            <div className="flex-1 flex flex-col items-center justify-center p-10 px-5 border border-[var(--ui-border-muted)] rounded-xl">
              <p className="m-0 text-sm text-[var(--ui-text-muted)] text-center">
                {emptyState.message}
              </p>
              {emptyState.subMessage && (
                <p className="m-0 mt-2 text-[13px] text-[var(--ui-text-muted)] text-center opacity-70">
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
          <SidebarSection
            title="Memory"
            isWide={isWide}
            rightElement={<span className="text-[12px] text-[var(--ui-text-muted)]">Only you</span>}
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
              <button
                onClick={sidebarSections.onAddInstruction}
                className="size-6 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <Plus size={16} />
              </button>
            }
          >
            {sidebarSections.instructions || (
              <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
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
                className="size-6 rounded-md border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <Plus size={16} />
              </button>
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`size-8 rounded-lg border-none cursor-pointer flex items-center justify-center transition-all duration-150 ${
          isOpen ? 'bg-[var(--surface-active)] text-[var(--ui-text-primary)]' : 'bg-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)]'
        }`}
      >
        <DotsThreeOutline size={18} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="absolute top-full right-0 mt-2 min-w-[160px] bg-[var(--surface-floating)] rounded-xl border border-[var(--ui-border-default)] shadow-lg z-[9999] overflow-hidden py-2"
            onClick={() => setIsOpen(false)}
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
    <div
      onClick={onClick}
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
        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
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
        <button
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
          <button
            onClick={onEdit}
            className="p-1 px-2 bg-transparent border-none text-[var(--ui-text-muted)] text-[12px] cursor-pointer flex items-center gap-1 hover:text-[var(--ui-text-primary)] transition-colors"
          >
            <PencilSimple size={12} />
            Edit
          </button>
        )}
        {onDelete && (
          <button
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

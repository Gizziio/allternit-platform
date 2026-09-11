"use client";

import React, { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Camera,
  Image as ImageIcon,
  Folder,
  GithubLogo as Github,
  Globe,
  Pen as PenTool,
  Lightning,
  Plus,
  X,
  Check,
  Link as LinkIcon,
  CircleNotch,
  Video,
  Square,
  Brain,
  PuzzlePiece,
  GraduationCap,
  ShieldCheck,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type PlusSheetSubMenu = "project" | null;

export interface ComposerPlusSheetProject {
  id: string;
  title: string;
}

export interface ComposerPlusSheetProps {
  open: boolean;
  onClose: () => void;

  // Media / capture
  isBrowserSurface: boolean;
  onFilesClick: () => void;
  onCameraClick?: () => void;
  onScreenshotClick?: () => void;
  onGifClick?: () => void;
  isGifRecording?: boolean;
  gifDuration?: number;

  // GitHub
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  githubLoading: boolean;
  onGitHubFetch: () => void;

  // Toggles
  webSearchEnabled: boolean;
  setWebSearchEnabled: (value: boolean) => void;
  researchEnabled: boolean;
  setResearchEnabled: (value: boolean) => void;

  // Project
  projects: ComposerPlusSheetProject[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  onCreateProject: () => void;

  // Deep links
  onOpenConnectors: () => void;
  onOpenBrainCapture: () => void;
  onOpenPermissions: () => void;
  onOpenPlugins: () => void;
  onOpenSkills: () => void;
}

export function ComposerPlusSheet({
  open,
  onClose,
  isBrowserSurface,
  onFilesClick,
  onCameraClick,
  onScreenshotClick,
  onGifClick,
  isGifRecording,
  gifDuration,
  githubUrl,
  setGithubUrl,
  githubLoading,
  onGitHubFetch,
  webSearchEnabled,
  setWebSearchEnabled,
  researchEnabled,
  setResearchEnabled,
  projects,
  activeProjectId,
  setActiveProjectId,
  onCreateProject,
  onOpenConnectors,
  onOpenBrainCapture,
  onOpenPermissions,
  onOpenPlugins,
  onOpenSkills,
}: ComposerPlusSheetProps) {
  const [activeSubMenu, setActiveSubMenu] = useState<PlusSheetSubMenu>(null);
  const [showGitHubInput, setShowGitHubInput] = useState(false);

  const handleClose = React.useCallback(() => {
    setActiveSubMenu(null);
    setShowGitHubInput(false);
    onClose();
  }, [onClose]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const toggleSubMenu = (subMenu: PlusSheetSubMenu) => {
    setActiveSubMenu((current) => (current === subMenu ? null : subMenu));
    setShowGitHubInput(false);
  };

  const toggleGitHub = () => {
    setShowGitHubInput((v) => !v);
    setActiveSubMenu(null);
  };

  const handleFileClick = () => {
    onFilesClick();
    handleClose();
  };

  const handleCameraClick = () => {
    onCameraClick?.();
    handleClose();
  };

  const handleScreenshotClick = () => {
    onScreenshotClick?.();
    handleClose();
  };

  const handleGifClick = () => {
    onGifClick?.();
    handleClose();
  };

  const handleGitHubSubmit = () => {
    onGitHubFetch();
    setShowGitHubInput(false);
  };

  const handleProjectSelect = (id: string | null) => {
    setActiveProjectId(id);
    setActiveSubMenu(null);
    handleClose();
  };

  const handleCreateProject = () => {
    onCreateProject();
    setActiveSubMenu(null);
    handleClose();
  };

  const handleOpenConnectors = () => {
    onOpenConnectors();
    handleClose();
  };

  const handleOpenBrainCapture = () => {
    onOpenBrainCapture();
    handleClose();
  };

  const handleOpenPermissions = () => {
    onOpenPermissions();
    handleClose();
  };

  const handleOpenPlugins = () => {
    onOpenPlugins();
    handleClose();
  };

  const handleOpenSkills = () => {
    onOpenSkills();
    handleClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[180] bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={handleClose}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-[190] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-[min(440px,calc(100vw-32px))] max-h-[min(780px,calc(100vh-48px))]",
            "rounded-2xl border border-[var(--border-subtle)]",
            "bg-[var(--glass-bg-thick)]/90 backdrop-blur-xl backdrop-saturate-150",
            "shadow-[0_24px_80px_var(--shell-overlay-backdrop)]",
            "flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onPointerDownOutside={handleClose}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 rounded-full bg-[var(--text-secondary)]/30" />
            </div>
            <DialogPrimitive.Close
              onClick={handleClose}
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Close"
            >
              <X size={14} weight="bold" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-4">
            {/* Icon grid */}
            <div className="grid grid-cols-4 gap-2">
              {isBrowserSurface && (
                <>
                  <GridButton
                    icon={<Camera size={20} weight="duotone" />}
                    label="Camera"
                    onClick={handleCameraClick}
                  />
                  <GridButton
                    icon={isGifRecording ? <Square size={20} weight="fill" /> : <Video size={20} weight="duotone" />}
                    label={isGifRecording ? `Stop (${gifDuration ?? 0}s)` : "GIF"}
                    onClick={handleGifClick}
                    danger={isGifRecording}
                    // Hidden entirely when the tools API is disabled — GIF
                    // recording drives `/api/v1/tools/execute`, which this
                    // deployment does not serve.
                    className={onGifClick ? undefined : 'hidden'}
                  />
                  <GridButton
                    icon={<ImageIcon size={20} weight="duotone" />}
                    label="Image"
                    onClick={handleFileClick}
                  />
                </>
              )}
              <GridButton
                icon={<ImageIcon size={20} weight="duotone" />}
                label="Files"
                onClick={handleFileClick}
              />
              <GridButton
                icon={<Github size={20} weight="duotone" />}
                label="GitHub"
                active={showGitHubInput}
                onClick={toggleGitHub}
              />
              <GridButton
                icon={<Globe size={20} weight="duotone" />}
                label="Web"
                active={webSearchEnabled}
                check={webSearchEnabled}
                onClick={() => {
                  setWebSearchEnabled(!webSearchEnabled);
                  setActiveSubMenu(null);
                }}
              />
              <GridButton
                icon={<Folder size={20} weight="duotone" />}
                label="Project"
                active={activeSubMenu === "project" || !!activeProject}
                onClick={() => toggleSubMenu("project")}
              />
              <GridButton
                icon={<Lightning size={20} weight="duotone" />}
                label="Connectors"
                onClick={handleOpenConnectors}
              />
              {isBrowserSurface && onScreenshotClick && (
                <GridButton
                  icon={<Camera size={20} weight="duotone" />}
                  label="Screenshot"
                  onClick={handleScreenshotClick}
                />
              )}
            </div>

            {/* GitHub input */}
            {showGitHubInput && (
              <GlassPanel>
                <div className="flex items-center gap-2">
                  <LinkIcon size={14} className="text-[var(--text-secondary)] shrink-0" />
                  <input
                    autoFocus
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleGitHubSubmit();
                      if (e.key === "Escape") setShowGitHubInput(false);
                    }}
                    placeholder="github.com/user/repo/blob/main/file"
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  />
                  {githubLoading ? (
                    <CircleNotch size={14} className="text-[var(--text-secondary)] animate-spin shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={handleGitHubSubmit}
                      disabled={!githubUrl.trim()}
                      className="text-xs font-semibold text-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      Add
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                  Paste a GitHub file URL to fetch its raw contents as an attachment.
                </p>
              </GlassPanel>
            )}

            {/* Project submenu */}
            {activeSubMenu === "project" && (
              <GlassPanel>
                <SubMenuTitle>Add to project</SubMenuTitle>
                <div className="flex flex-col gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => handleProjectSelect(null)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                      activeProjectId === null
                        ? "bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-floating))] text-[var(--accent-primary)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    )}
                  >
                    <span>None</span>
                    {activeProjectId === null && <Check size={13} weight="bold" />}
                  </button>
                  {projects.map((project) => {
                    const selected = activeProjectId === project.id;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleProjectSelect(project.id)}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                          selected
                            ? "bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-floating))] text-[var(--accent-primary)]"
                            : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        <span className="truncate">{project.title}</span>
                        {selected && <Check size={13} weight="bold" />}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleCreateProject}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <Plus size={14} weight="bold" />
                    <span>New project</span>
                  </button>
                </div>
              </GlassPanel>
            )}

            {/* Tool toggles */}
            <GlassPanel className="space-y-1">
              <ToggleRow
                icon={<Globe size={16} weight="duotone" />}
                title="Web search"
                subtitle="Let the agent search the web for current information"
                isOn={webSearchEnabled}
                onToggle={() => setWebSearchEnabled(!webSearchEnabled)}
              />
              <div className="h-px bg-[var(--border-subtle)]/50 ml-9" />
              <ToggleRow
                icon={<PenTool size={16} weight="duotone" />}
                title="Research"
                subtitle="Deeper, multi-source research before answering"
                isOn={researchEnabled}
                onToggle={() => setResearchEnabled(!researchEnabled)}
              />
            </GlassPanel>

            {/* List rows */}
            <div className="flex flex-col gap-2">
              <ListRow
                icon={<Brain size={16} weight="duotone" />}
                title="Capture to brain"
                subtitle="Save an idea or pain to your second brain"
                onClick={handleOpenBrainCapture}
              />
              <ListRow
                icon={<PuzzlePiece size={16} weight="duotone" />}
                title="Plugins"
                subtitle="Browse and manage plugins"
                onClick={handleOpenPlugins}
              />
              <ListRow
                icon={<GraduationCap size={16} weight="duotone" />}
                title="Skills"
                subtitle="Browse and manage skills"
                onClick={handleOpenSkills}
              />
              <ListRow
                icon={<ShieldCheck size={16} weight="duotone" />}
                title="Permissions"
                subtitle="Review permission defaults for this session"
                onClick={handleOpenPermissions}
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function GridButton({
  icon,
  label,
  onClick,
  active,
  check,
  danger,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  check?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all",
        active
          ? "border-[var(--accent-primary)]/40 bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-floating))] text-[var(--accent-primary)]"
          : danger
          ? "border-transparent bg-[color-mix(in_srgb,var(--status-error)_10%,var(--surface-floating))] text-[var(--status-error)] hover:bg-[color-mix(in_srgb,var(--status-error)_16%,var(--surface-floating))]"
          : "border-transparent bg-[var(--bg-tertiary)]/30 text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
        className
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
          active
            ? "bg-[color-mix(in_srgb,var(--accent-primary)_18%,var(--surface-floating))] text-[var(--accent-primary)]"
            : danger
            ? "bg-[color-mix(in_srgb,var(--status-error)_16%,var(--surface-floating))] text-[var(--status-error)]"
            : "bg-[var(--bg-tertiary)]/60 text-[var(--text-secondary)]"
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
      {check && (
        <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--text-inverse)]">
          <Check size={8} weight="bold" />
        </span>
      )}
    </button>
  );
}

function GlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl border border-[var(--border-subtle)]/60 bg-[var(--surface-floating)]/40",
        className
      )}
    >
      {children}
    </div>
  );
}

function SubMenuTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
      {children}
    </h3>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  isOn,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  isOn: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-3 w-full py-1.5 text-left group"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-tertiary)]/60 text-[var(--accent-primary)] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)]">{title}</div>
        <div className="text-[11px] text-[var(--text-secondary)]">{subtitle}</div>
      </div>
      <div
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          isOn ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
            isOn && "translate-x-4"
          )}
        />
      </div>
    </button>
  );
}

function ListRow({
  icon,
  title,
  subtitle,
  onClick,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  value?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full p-3 rounded-xl border border-[var(--border-subtle)]/60 bg-[var(--surface-floating)]/40 text-left hover:bg-[var(--surface-hover)] transition-colors"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-tertiary)]/60 text-[var(--accent-primary)] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)]">{title}</div>
        <div className="text-[11px] text-[var(--text-secondary)]">{subtitle}</div>
      </div>
      {value && <span className="text-xs text-[var(--text-secondary)] shrink-0">{value}</span>}
      <span className="text-[var(--text-secondary)] shrink-0">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-60"
        >
          <path
            d="M4.5 2.5L8 6L4.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}

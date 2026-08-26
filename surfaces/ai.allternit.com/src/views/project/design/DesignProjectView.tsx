"use client";

import React, { useMemo, useState } from 'react';
import { useDesignProjectStore, type DesignProject } from './design-project.store';
import { useDesignTabStore } from '@/stores/design-tab.store';
import { useNav } from '@/nav/useNav';
import { useMode } from '@/providers/mode-provider';
import {
  BaseProjectView,
  ProjectMenuButton,
  ProjectItemCard,
  ProjectEditDetailsModal,
} from '@/views/BaseProjectView';
import { ChatComposer } from '@/views/chat/ChatComposer';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Palette,
  PencilSimple,
  Archive,
  Trash,
  Folder,
  SketchLogo,
  DeviceMobile,
  FileText,
  Users,
  ArrowRight,
} from '@phosphor-icons/react';

interface DesignProjectViewProps {
  projectId: string;
  onBack: () => void;
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  files: <Folder size={18} />,
  questions: <SketchLogo size={18} />,
  sketch: <SketchLogo size={18} />,
  mobile: <DeviceMobile size={18} />,
  docs: <FileText size={18} />,
  handoff: <ArrowRight size={18} />,
  team: <Users size={18} />,
};

export function DesignProjectView({ projectId, onBack }: DesignProjectViewProps) {
  const { projects, updateProjectDetails, deleteProject, toggleFavorite, toggleArchive } =
    useDesignProjectStore();
  const designTabStore = useDesignTabStore();
  const { dispatch } = useNav();
  const { setMode } = useMode();
  const defaultSelection = useDefaultModelSelection();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const [activeTab, setActiveTab] = useState('files');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const tabs = useMemo(
    () =>
      (project?.tabs || []).map((tab) => ({
        id: tab.id,
        label: tab.label,
      })),
    [project?.tabs]
  );

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--ui-text-secondary)]">
        <div className="text-center">
          <p>Design project not found</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white cursor-pointer"
          >
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  const handleOpenInDesignMode = (prompt?: string) => {
    designTabStore.setStoredProject({
      id: project.id,
      name: project.name,
      type: project.type,
      specialist: project.specialist,
      fidelity: project.fidelity,
      activeTabId: project.activeTabId,
      tabs: project.tabs,
    });
    designTabStore.setProjectName(project.name);
    designTabStore.setHasProject(true);
    if (prompt?.trim()) {
      designTabStore.setPendingPrompt(prompt.trim());
    }
    setMode('design');
    dispatch({ type: 'OPEN_VIEW', viewType: 'design' });
  };

  const handleOpenInDesignModeClick = () => handleOpenInDesignMode();

  const handleArchive = () => {
    toggleArchive(project.id);
    onBack();
  };

  const menuContent = (
    <ProjectMenuButton>
      <button
        type="button"
        onClick={() => setShowRenameModal(true)}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <PencilSimple size={16} />
        Edit details
      </button>
      <button
        type="button"
        onClick={handleArchive}
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--ui-text-secondary)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <Archive size={16} />
        {project.isArchived ? 'Unarchive' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={() =>
          setConfirmDialog({
            message: 'Delete this design project? This cannot be undone.',
            onConfirm: () => {
              setConfirmDialog(null);
              deleteProject(project.id);
              onBack();
            },
          })
        }
        className="w-full p-2.5 px-4 border-none bg-transparent text-[var(--status-error)] cursor-pointer flex items-center gap-2.5 text-sm text-left hover:bg-[var(--status-error-bg)] transition-colors"
      >
        <Trash size={16} />
        Delete
      </button>
    </ProjectMenuButton>
  );

  const inputBar = (
    <ModelSelectionProvider defaultSelection={defaultSelection}>
      <ChatComposer
        onSend={handleOpenInDesignMode}
        placeholder={`Describe what you want to design for ${project.name}`}
        showTopActions={false}
        showModeToggle={false}
        variant="default"
      />
    </ModelSelectionProvider>
  );

  return (
    <>
      <BaseProjectView
        title={project.name}
        description={project.description || `Design project — ${project.type}`}
        onBack={onBack}
        onToggleStar={() => toggleFavorite(project.id)}
        isStarred={project.isFavorite}
        tabs={tabs.length > 0 ? tabs : [{ id: 'files', label: 'Files' }]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewItem={() => handleOpenInDesignMode()}
        newButtonLabel="Open in Design Mode"
        menuContent={menuContent}
        inputBar={inputBar}
        sidebarSections={{
          memory: (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--ui-text-muted)]">Type</span>
                <span className="text-[var(--ui-text-secondary)] font-medium capitalize">{project.type}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--ui-text-muted)]">Fidelity</span>
                <span className="text-[var(--ui-text-secondary)] font-medium capitalize">{project.fidelity}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--ui-text-muted)]">Specialist</span>
                <span className="text-[var(--ui-text-secondary)] font-medium capitalize">{project.specialist}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--ui-text-muted)]">Canvases</span>
                <span className="text-[var(--ui-text-secondary)] font-medium">{project.tabs.length}</span>
              </div>
              <p className="m-0 mt-1 text-[12px] text-[var(--ui-text-muted)] leading-relaxed">
                Memory will be built from design iterations in this project.
              </p>
            </div>
          ),
          instructions: (
            <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
              Design instructions and brand rules can be managed inside Design Mode.
            </p>
          ),
          files: (
            <p className="m-0 text-[13px] text-[var(--ui-text-muted)]">
              Project files are stored in the Allternit Design workspace.
            </p>
          ),
          onAddInstruction: undefined,
          onAddFile: undefined,
        }}
        showEmptyState={tabs.length === 0}
        emptyState={{
          message: 'No design canvases yet.',
          subMessage: 'Open this project in Design Mode to start creating.',
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="p-5 rounded-2xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                <Palette size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--ui-text-primary)]">{project.name}</h3>
                <p className="text-[12px] text-[var(--ui-text-muted)] capitalize">
                  {project.type} • {project.fidelity} fidelity • {project.specialist} specialist
                </p>
              </div>
            </div>
            <p className="text-[13px] text-[var(--ui-text-muted)] m-0 mb-4">
              This design project is managed in Allternit Design. Open it to access the canvas,
              design system, handoff, and team workspaces.
            </p>
            <button
              type="button"
              onClick={handleOpenInDesignModeClick}
              className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              Open in Design Mode
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {tabs.map((tab) => (
              <ProjectItemCard
                key={tab.id}
                title={tab.label}
                subtitle={tab.id}
                icon={TAB_ICONS[tab.id] || <Palette size={18} />}
                onClick={handleOpenInDesignModeClick}
              />
            ))}
          </div>
        </div>
      </BaseProjectView>

      <ProjectEditDetailsModal
        isOpen={showRenameModal}
        initialName={project.name}
        initialDescription={project.description}
        onConfirm={(details) => {
          updateProjectDetails(project.id, {
            name: details.title,
            description: details.description,
          });
          setShowRenameModal(false);
        }}
        onCancel={() => setShowRenameModal(false)}
      />

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title="Confirm"
        message={confirmDialog?.message || ''}
        confirmLabel="Confirm"
        destructive
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}

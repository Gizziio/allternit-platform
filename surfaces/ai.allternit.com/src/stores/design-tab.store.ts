import { create } from 'zustand';

export type DesignCanvasTab =
  | 'questions'
  | 'mobile'
  | 'video'
  | 'docs'
  | 'handoff'
  | 'graph'
  | 'pipeline'
  | 'team'
  | 'market';

export interface StoredProjectTab {
  id: string;
  label: string;
  type: string;
}

export interface StoredProject {
  id: string;
  name: string;
  type: string;
  specialist: string;
  fidelity: string;
  activeTabId: string;
  tabs: StoredProjectTab[];
}

interface DesignTabStore {
  activeTab: DesignCanvasTab;
  setActiveTab: (tab: DesignCanvasTab) => void;
  hasProject: boolean;
  setHasProject: (v: boolean) => void;
  specialist: string | null;
  setSpecialist: (v: string | null) => void;
  projectName: string | null;
  setProjectName: (v: string | null) => void;
  // persisted project across mode switches
  activeProject: StoredProject | null;
  setStoredProject: (project: StoredProject | null) => void;
  openProjectTab: (tabId: string, label: string) => void;
  closeProjectTab: (tabId: string) => void;
  // rail → canvas project creation bus
  pendingProject: Record<string, any> | null;
  setPendingProject: (config: Record<string, any>) => void;
  clearPendingProject: () => void;
}

export const useDesignTabStore = create<DesignTabStore>((set, get) => ({
  activeTab: 'questions',
  setActiveTab: (tab) => set({ activeTab: tab }),
  hasProject: false,
  setHasProject: (v) => set({ hasProject: v }),
  specialist: null,
  setSpecialist: (v) => set({ specialist: v }),
  projectName: null,
  setProjectName: (v) => set({ projectName: v }),
  activeProject: null,
  setStoredProject: (project) => set({ activeProject: project }),
  openProjectTab: (tabId, label) => {
    const { activeProject } = get();
    if (!activeProject) return;
    if (activeProject.tabs.some(t => t.id === tabId)) return;
    set({ activeProject: { ...activeProject, tabs: [...activeProject.tabs, { id: tabId, label, type: tabId }] } });
  },
  closeProjectTab: (tabId) => {
    const { activeProject, activeTab } = get();
    if (!activeProject) return;
    const remaining = activeProject.tabs.filter(t => t.id !== tabId);
    if (remaining.length === 0) return;
    const next: Partial<DesignTabStore> = { activeProject: { ...activeProject, tabs: remaining } };
    if (activeTab === tabId) next.activeTab = remaining[0].id as DesignCanvasTab;
    set(next as any);
  },
  pendingProject: null,
  setPendingProject: (config) => set({ pendingProject: config }),
  clearPendingProject: () => set({ pendingProject: null }),
}));

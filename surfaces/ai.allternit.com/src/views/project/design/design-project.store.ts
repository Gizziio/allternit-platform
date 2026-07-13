"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import { useDesignTabStore } from '@/stores/design-tab.store';

export type DesignProjectType =
  | 'prototype'
  | 'slides'
  | 'mobile'
  | 'brand'
  | 'dashboard'
  | 'content-engine'
  | 'template'
  | 'other';

export interface DesignProject {
  id: string;
  name: string;
  type: DesignProjectType;
  specialist: 'architect' | 'growth' | 'purist' | 'creative';
  fidelity: 'wireframe' | 'high';
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  isArchived: boolean;
  activeTabId: string;
  tabs: Array<{ id: string; label: string; type: string }>;
}

interface DesignProjectState {
  projects: DesignProject[];
  activeProjectId: string | null;

  createProject: (name: string, type?: DesignProjectType) => DesignProject;
  upsertProject: (project: Omit<DesignProject, 'createdAt' | 'updatedAt' | 'isFavorite' | 'isArchived'> & Partial<Pick<DesignProject, 'isFavorite' | 'isArchived'>>) => DesignProject;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
}

const DEFAULT_TABS: DesignProject['tabs'] = [
  { id: 'files', label: 'Files', type: 'files' },
  { id: 'questions', label: 'Discovery', type: 'questions' },
  { id: 'sketch', label: 'Sketch', type: 'sketch' },
  { id: 'mobile', label: 'Mobile', type: 'mobile' },
  { id: 'docs', label: 'Documents', type: 'docs' },
  { id: 'handoff', label: 'Handoff', type: 'handoff' },
  { id: 'team', label: 'Team', type: 'team' },
];

export const useDesignProjectStore = create<DesignProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      createProject: (name, type = 'prototype') => {
        const now = Date.now();
        const project: DesignProject = {
          id: `design-${now}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          type,
          specialist: 'architect',
          fidelity: 'high',
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
          isArchived: false,
          activeTabId: 'questions',
          tabs: DEFAULT_TABS,
        };
        set((state) => ({
          projects: [project, ...state.projects],
          activeProjectId: project.id,
        }));

        // Sync to the design-mode tab store so switching to design lands on this project.
        useDesignTabStore.getState().setStoredProject({
          id: project.id,
          name: project.name,
          type: project.type,
          specialist: project.specialist,
          fidelity: project.fidelity,
          activeTabId: project.activeTabId,
          tabs: project.tabs,
        });
        useDesignTabStore.getState().setProjectName(project.name);
        useDesignTabStore.getState().setHasProject(true);

        return project;
      },

      upsertProject: (project) => {
        const now = Date.now();
        const existing = get().projects.find((p) => p.id === project.id);
        const fullProject: DesignProject = {
          ...project,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          isFavorite: existing?.isFavorite ?? project.isFavorite ?? false,
          isArchived: existing?.isArchived ?? project.isArchived ?? false,
        } as DesignProject;

        set((state) => {
          const exists = state.projects.some((p) => p.id === fullProject.id);
          return {
            projects: exists
              ? state.projects.map((p) => (p.id === fullProject.id ? fullProject : p))
              : [fullProject, ...state.projects],
            activeProjectId: fullProject.id,
          };
        });

        useDesignTabStore.getState().setStoredProject({
          id: fullProject.id,
          name: fullProject.name,
          type: fullProject.type,
          specialist: fullProject.specialist,
          fidelity: fullProject.fidelity,
          activeTabId: fullProject.activeTabId,
          tabs: fullProject.tabs,
        });
        useDesignTabStore.getState().setProjectName(fullProject.name);
        useDesignTabStore.getState().setHasProject(true);

        return fullProject;
      },

      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        })),

      setActiveProject: (id) => {
        set({ activeProjectId: id });
        const project = id ? get().projects.find((p) => p.id === id) : null;
        if (project) {
          useDesignTabStore.getState().setStoredProject({
            id: project.id,
            name: project.name,
            type: project.type,
            specialist: project.specialist,
            fidelity: project.fidelity,
            activeTabId: project.activeTabId,
            tabs: project.tabs,
          });
          useDesignTabStore.getState().setProjectName(project.name);
          useDesignTabStore.getState().setHasProject(true);
        }
      },

      toggleFavorite: (id) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, isFavorite: !p.isFavorite, updatedAt: Date.now() } : p
          ),
        })),

      toggleArchive: (id) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, isArchived: !p.isArchived, updatedAt: Date.now() } : p
          ),
        })),
    }),
    {
      name: 'allternit-design-projects-v1',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({ projects: state.projects }),
    }
  )
);

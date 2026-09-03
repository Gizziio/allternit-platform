"use client";

import { useMemo, useCallback, useEffect } from 'react';
import { useChatStore } from '@/views/chat/ChatStore';
import { useTaskStore } from '@/views/cowork/useTaskStore';
import { useCodeModeStore } from '@/views/code/CodeModeStore';
import { useDesignProjectStore } from '@/views/project/design/design-project.store';
import { useBBProjectStore } from '@/views/bb/bb-project.store';
import type { UnifiedProject, ProjectMode, ProjectCategory, ProjectStats } from './types';

const MODE_PREFIX: Record<ProjectMode, string> = {
  chat: 'chat',
  cowork: 'cowork',
  code: 'code',
  design: 'design',
  bb: 'bb',
};

export function useUnifiedProjects() {
  const chatStore = useChatStore();
  const taskStore = useTaskStore();
  const codeStore = useCodeModeStore();
  const designStore = useDesignProjectStore();
  const bbStore = useBBProjectStore();

  // Fetch bb projects on first use of the unified hub.
  useEffect(() => {
    void bbStore.fetchProjects();
  }, [bbStore]);

  const allProjects = useMemo<UnifiedProject[]>(() => {
    const chatProjects: UnifiedProject[] = (chatStore.projects || []).map((p) => {
      const projectThreads = chatStore.threads.filter(
        (t) => t.projectId === p.id && t.mode !== 'agent'
      );
      const agentSessions = chatStore.threads.filter(
        (t) => t.projectId === p.id && t.mode === 'agent'
      );
      return {
        id: `${MODE_PREFIX.chat}-${p.id}`,
        nativeId: p.id,
        title: p.title,
        mode: 'chat',
        createdAt: p.createdAt || 0,
        updatedAt: Math.max(
          p.createdAt || 0,
          ...projectThreads.map((t) => t.updatedAt || 0)
        ),
        isFavorite: p.isFavorite ?? false,
        isArchived: p.isArchived ?? false,
        threadCount: projectThreads.length,
        taskCount: agentSessions.length,
        fileCount: p.files?.length ?? 0,
        description: p.description || 'Chat project',
      };
    });

    const coworkProjects: UnifiedProject[] = (taskStore.projects || []).map((p) => {
      const projectTasks = taskStore.tasks.filter((t) => t.projectId === p.id);
      const updatedAt = Math.max(
        new Date(p.updatedAt).getTime() || 0,
        ...projectTasks.map((t) => new Date(t.updatedAt).getTime() || 0)
      );
      return {
        id: `${MODE_PREFIX.cowork}-${p.id}`,
        nativeId: p.id,
        title: p.title,
        mode: 'cowork',
        createdAt: new Date(p.createdAt).getTime() || 0,
        updatedAt,
        isFavorite: p.isFavorite ?? false,
        isArchived: p.isArchived ?? false,
        threadCount: 0,
        taskCount: projectTasks.length,
        fileCount: 0,
        description: p.description || 'Cowork workspace',
      };
    });

    const codeProjects: UnifiedProject[] = (codeStore.workspaces || []).map((w) => {
      const workspaceSessions = codeStore.sessions.filter(
        (s) => s.workspace_id === w.workspace_id
      );
      const createdAt = new Date(w.repo_status?.snapshot_at || 0).getTime() || 0;
      return {
        id: `${MODE_PREFIX.code}-${w.workspace_id}`,
        nativeId: w.workspace_id,
        title: w.display_name,
        mode: 'code',
        createdAt,
        updatedAt: Math.max(
          createdAt,
          ...workspaceSessions.map((s) => new Date(s.updated_at).getTime() || 0)
        ),
        isFavorite: w.isFavorite ?? false,
        isArchived: w.isArchived ?? false,
        threadCount: workspaceSessions.length,
        taskCount: workspaceSessions.filter((s) => s.mode === 'AUTO').length,
        fileCount: w.canvasTiles?.length ?? 0,
        description: w.description || w.root_path || 'Code workspace',
      };
    });

    const designProjects: UnifiedProject[] = (designStore.projects || []).map((p) => ({
      id: `${MODE_PREFIX.design}-${p.id}`,
      nativeId: p.id,
      title: p.name,
      mode: 'design',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      isFavorite: p.isFavorite,
      isArchived: p.isArchived,
      threadCount: 0,
      taskCount: 0,
      fileCount: p.tabs?.length ?? 0,
      description: p.description || `Design — ${p.type}`,
    }));

    const bbProjects: UnifiedProject[] = (bbStore.projects || []).map((p) => ({
      id: p.id,
      nativeId: p.nativeId,
      title: p.name,
      mode: 'bb',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      isFavorite: false,
      isArchived: false,
      threadCount: 0,
      taskCount: 0,
      fileCount: 0,
      description: p.gitRemoteUrl ? `bb — ${p.gitRemoteUrl}` : 'bb project',
    }));

    const list = [
      ...chatProjects,
      ...coworkProjects,
      ...codeProjects,
      ...designProjects,
      ...bbProjects,
    ];

    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [
    chatStore.projects,
    chatStore.threads,
    taskStore.projects,
    taskStore.tasks,
    codeStore.workspaces,
    codeStore.sessions,
    designStore.projects,
    bbStore.projects,
  ]);

  const stats = useMemo<ProjectStats>(() => {
    const base = {
      total: allProjects.length,
      chat: allProjects.filter((p) => p.mode === 'chat').length,
      cowork: allProjects.filter((p) => p.mode === 'cowork').length,
      code: allProjects.filter((p) => p.mode === 'code').length,
      design: allProjects.filter((p) => p.mode === 'design').length,
      bb: allProjects.filter((p) => p.mode === 'bb').length,
      favorite: allProjects.filter((p) => p.isFavorite).length,
      archived: allProjects.filter((p) => p.isArchived).length,
    };
    return base;
  }, [allProjects]);

  const createProject = useCallback(
    (mode: ProjectMode, title: string) => {
      switch (mode) {
        case 'chat':
          return chatStore.createProject(title);
        case 'cowork': {
          const project = taskStore.createProject(title);
          return project.id;
        }
        case 'code':
          return codeStore.createWorkspace(title);
        case 'design':
          return designStore.createProject(title).id;
        case 'bb':
          return bbStore.createProject(title).then((p) => p.nativeId);
        default:
          return chatStore.createProject(title);
      }
    },
    [chatStore, taskStore, codeStore, designStore, bbStore]
  );

  const setActiveProject = useCallback(
    (project: UnifiedProject | null) => {
      if (!project) {
        chatStore.setActiveProject(null);
        taskStore.setActiveProject(null);
        codeStore.setActiveWorkspace('');
        designStore.setActiveProject(null);
        return;
      }

      switch (project.mode) {
        case 'chat':
          chatStore.setActiveProject(project.nativeId);
          break;
        case 'cowork':
          taskStore.setActiveProject(project.nativeId);
          break;
        case 'code':
          codeStore.setActiveWorkspace(project.nativeId);
          break;
        case 'design':
          designStore.setActiveProject(project.nativeId);
          break;
        case 'bb':
          // bb uses its own project detail view; no global active project state.
          break;
      }
    },
    [chatStore, taskStore, codeStore, designStore]
  );

  const toggleFavorite = useCallback(
    (project: UnifiedProject) => {
      switch (project.mode) {
        case 'chat':
          chatStore.toggleProjectFavorite?.(project.nativeId);
          break;
        case 'cowork':
          taskStore.toggleProjectFavorite?.(project.nativeId);
          break;
        case 'code':
          codeStore.toggleWorkspaceFavorite?.(project.nativeId);
          break;
        case 'design':
          designStore.toggleFavorite(project.nativeId);
          break;
        case 'bb':
          bbStore.toggleProjectFavorite(project.nativeId);
          break;
      }
    },
    [chatStore, taskStore, codeStore, designStore, bbStore]
  );

  const toggleArchive = useCallback(
    (project: UnifiedProject) => {
      switch (project.mode) {
        case 'chat':
          chatStore.toggleProjectArchive?.(project.nativeId);
          break;
        case 'cowork':
          taskStore.toggleProjectArchive?.(project.nativeId);
          break;
        case 'code':
          codeStore.toggleWorkspaceArchive?.(project.nativeId);
          break;
        case 'design':
          designStore.toggleArchive(project.nativeId);
          break;
        case 'bb':
          bbStore.toggleProjectArchive(project.nativeId);
          break;
      }
    },
    [chatStore, taskStore, codeStore, designStore, bbStore]
  );

  const deleteProject = useCallback(
    (project: UnifiedProject) => {
      switch (project.mode) {
        case 'chat':
          chatStore.deleteProject(project.nativeId);
          break;
        case 'cowork':
          taskStore.deleteProject(project.nativeId);
          break;
        case 'code':
          codeStore.deleteWorkspace(project.nativeId);
          break;
        case 'design':
          designStore.deleteProject(project.nativeId);
          break;
        case 'bb':
          bbStore.deleteProject(project.nativeId);
          break;
      }
    },
    [chatStore, taskStore, codeStore, designStore, bbStore]
  );

  const updateProjectDetails = useCallback(
    (project: UnifiedProject, details: { title?: string; description?: string }) => {
      switch (project.mode) {
        case 'chat':
          chatStore.updateProjectDetails(project.nativeId, details);
          break;
        case 'cowork':
          taskStore.updateProjectDetails(project.nativeId, details);
          break;
        case 'code':
          codeStore.updateWorkspaceDetails(project.nativeId, {
            displayName: details.title,
            description: details.description,
          });
          break;
        case 'design':
          designStore.updateProjectDetails(project.nativeId, {
            name: details.title,
            description: details.description,
          });
          break;
        case 'bb':
          bbStore.updateProjectDetails(project.nativeId, {
            name: details.title,
          });
          break;
      }
    },
    [chatStore, taskStore, codeStore, designStore, bbStore]
  );

  const renameProject = useCallback(
    (project: UnifiedProject, title: string) => {
      switch (project.mode) {
        case 'chat':
          chatStore.renameProject(project.nativeId, title);
          break;
        case 'cowork':
          taskStore.renameProject(project.nativeId, title);
          break;
        case 'code':
          codeStore.renameWorkspace(project.nativeId, title);
          break;
        case 'design':
          designStore.renameProject(project.nativeId, title);
          break;
        case 'bb':
          bbStore.renameProject(project.nativeId, title);
          break;
      }
    },
    [chatStore, taskStore, codeStore, designStore, bbStore]
  );

  const filterProjects = useCallback(
    (category: ProjectCategory, searchQuery: string, includeArchived = false) => {
      const query = searchQuery.trim().toLowerCase();
      return allProjects.filter((p) => {
        if (!includeArchived && p.isArchived) return false;
        if (category !== 'all' && p.mode !== category) return false;
        if (query && !p.title.toLowerCase().includes(query)) return false;
        return true;
      });
    },
    [allProjects]
  );

  return {
    allProjects,
    stats,
    createProject,
    setActiveProject,
    toggleFavorite,
    toggleArchive,
    deleteProject,
    renameProject,
    updateProjectDetails,
    filterProjects,
  };
}

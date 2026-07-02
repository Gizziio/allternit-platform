"use client";

import { useState, useCallback, useMemo } from 'react';
import { useChatStore } from '@/views/chat/ChatStore';
import { useNav } from '@/nav/useNav';
import { useMiniAppDiscovery } from '@/views/aci/use-mini-app-discovery';

export function useProjectManager() {
  const { 
    projects, 
    activeProjectId, 
    activeProjectLocalKey,
    threads, 
    setActiveThread,
    setActiveProject,
    addFileToProject,
    removeFileFromProject,
    addConnectorToProject,
    removeConnectorFromProject,
    renameProject,
    deleteProject,
    createThread,
  } = useChatStore();
  
  const { dispatch } = useNav();
  const { all: allMiniApps } = useMiniAppDiscovery();
  
  const [activeTab, setActiveTab] = useState('chats');
  const [isStarred, setIsStarred] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  
  // Modal states
  const [showAddFile, setShowAddFile] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showAddInstruction, setShowAddInstruction] = useState(false);
  const [instructionText, setInstructionText] = useState('');
  const [projectInstructions, setProjectInstructions] = useState<string[]>([]);
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const project = useMemo(() => {
    return activeProjectLocalKey
      ? projects.find((p) => p.localKey === activeProjectLocalKey) || projects.find((p) => p.id === activeProjectId)
      : projects.find((p) => p.id === activeProjectId);
  }, [activeProjectId, activeProjectLocalKey, projects]);

  const projectThreads = useMemo(() => 
    threads.filter(t => t.projectId === project?.id && t.mode !== 'agent'),
    [project?.id, threads]
  );
  
  const projectAgentSessions = useMemo(() => 
    threads.filter(t => t.projectId === project?.id && t.mode === 'agent'),
    [project?.id, threads]
  );
  
  const projectFiles = project?.files || [];
  const projectConnectorIds = project?.connectors || [];
  const attachedConnectors = allMiniApps.filter((app) => projectConnectorIds.includes(app.id));
  const availableConnectors = allMiniApps.filter((app) => !projectConnectorIds.includes(app.id));

  const hasContent = useMemo(() => {
    switch (activeTab) {
      case 'chats': return projectThreads.length > 0;
      case 'agent-sessions': return projectAgentSessions.length > 0;
      case 'sources': return projectFiles.length > 0;
      case 'connectors': return attachedConnectors.length > 0;
      default: return false;
    }
  }, [activeTab, projectThreads.length, projectAgentSessions.length, projectFiles.length, attachedConnectors.length]);

  const handleSend = useCallback(async (text: string) => {
    if (!project) return;
    setComposerInput('');
    await createThread(text.slice(0, 50) || 'New Chat', project.id);
    dispatch({ type: 'OPEN_VIEW', viewType: 'chat' });
  }, [project, createThread, dispatch]);

  const handleAddFile = useCallback((name: string) => {
    if (!project) return;
    addFileToProject(project.id, {
      name,
      size: 1024,
      type: 'text/markdown',
    });
    setShowAddFile(false);
  }, [project, addFileToProject]);

  const handleAddConnector = useCallback((connectorId: string) => {
    if (!project) return;
    addConnectorToProject(project.id, connectorId);
    setShowAddConnector(false);
  }, [project, addConnectorToProject]);

  return {
    project,
    activeTab,
    setActiveTab,
    isStarred,
    setIsStarred,
    composerInput,
    setComposerInput,
    showAddFile,
    setShowAddFile,
    showRenameModal,
    setShowRenameModal,
    showAddInstruction,
    setShowAddInstruction,
    instructionText,
    setInstructionText,
    projectInstructions,
    setProjectInstructions,
    showAddConnector,
    setShowAddConnector,
    confirmDialog,
    setConfirmDialog,
    projectThreads,
    projectAgentSessions,
    projectFiles,
    attachedConnectors,
    availableConnectors,
    hasContent,
    setActiveThread,
    setActiveProject,
    removeFileFromProject,
    removeConnectorFromProject,
    renameProject,
    deleteProject,
    handleSend,
    handleAddFile,
    handleAddConnector,
    dispatch,
  };
}

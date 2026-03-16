/**
 * A2rchitect Super-Agent OS - Launch Protocol
 * 
 * IPC (Inter-Process Communication) utilities for agents to launch
 * and control programs in the Utility Pane.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type {
  A2rProgramType,
  A2rProgramState,
  LaunchProgramRequest,
  ResearchDocState,
  DataGridState,
  PresentationState,
  CodePreviewState,
} from '../types/programs';

// ============================================================================
// Launch Functions
// ============================================================================

export function launchResearchDoc(
  title: string,
  topic: string,
  sourceThreadId: string,
  options?: { focus?: boolean; replaceExisting?: boolean }
): string {
  const initialState: ResearchDocState = {
    topic,
    sections: [],
    citations: [],
    evidence: [],
    tableOfContents: [],
    isGenerating: true,
    generationProgress: {
      currentStep: 'Initializing research...',
      percentComplete: 0,
    },
  };

  return useSidecarStore.getState().launchProgram<ResearchDocState>({
    type: 'research-doc',
    title,
    initialState,
    sourceThreadId,
    icon: '📄',
    launchOptions: options,
  });
}

export function launchDataGrid(
  title: string,
  columns: DataGridState['columns'],
  sourceThreadId: string,
  options?: { focus?: boolean; replaceExisting?: boolean }
): string {
  const initialState: DataGridState = {
    title,
    columns,
    rows: [],
    visualizations: [],
    isGenerating: false,
    pythonEnvironment: 'matplotlib',
  };

  return useSidecarStore.getState().launchProgram<DataGridState>({
    type: 'data-grid',
    title,
    initialState,
    sourceThreadId,
    icon: '📊',
    launchOptions: options,
  });
}

export function launchPresentation(
  title: string,
  sourceThreadId: string,
  options?: { focus?: boolean; replaceExisting?: boolean }
): string {
  const initialState: PresentationState = {
    title,
    slides: [],
    currentSlideIndex: 0,
    theme: {
      id: 'modern',
      name: 'Modern',
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      fontHeading: 'system-ui, sans-serif',
      fontBody: 'system-ui, sans-serif',
    },
    isPresenting: false,
    availableThemes: [],
    isGenerating: false,
  };

  return useSidecarStore.getState().launchProgram<PresentationState>({
    type: 'presentation',
    title,
    initialState,
    sourceThreadId,
    icon: '🎬',
    launchOptions: options,
  });
}

export function launchCodePreview(
  title: string,
  files: CodePreviewState['files'],
  entryFile: string,
  sourceThreadId: string,
  options?: { focus?: boolean; replaceExisting?: boolean }
): string {
  const initialState: CodePreviewState = {
    files,
    entryFile,
    consoleLogs: [],
    isBuilding: false,
    autoReload: true,
    sandboxConfig: {
      allowScripts: true,
      allowSameOrigin: false,
      allowForms: false,
    },
  };

  return useSidecarStore.getState().launchProgram<CodePreviewState>({
    type: 'code-preview',
    title,
    initialState,
    sourceThreadId,
    icon: '💻',
    launchOptions: options,
  });
}

export function launchAssetManager(sourceThreadId: string): string {
  return useSidecarStore.getState().launchProgram({
    type: 'asset-manager',
    title: 'Asset Manager',
    sourceThreadId,
    icon: '📁',
    launchOptions: { focus: false },
  });
}

export function launchImageStudio(imageUrl: string, sourceThreadId: string): string {
  return useSidecarStore.getState().launchProgram({
    type: 'image-studio',
    title: 'Image Studio',
    initialState: {
      imageUrl,
      originalImageUrl: imageUrl,
      layers: [],
      activeLayerId: 'default',
      brushSize: 10,
      brushColor: '#ff0000',
      tool: 'mask',
      zoom: 1,
      pan: { x: 0, y: 0 },
      isProcessing: false,
    },
    sourceThreadId,
    icon: '🎨',
    launchOptions: { focus: true },
  });
}

export function launchAudioStudio(title: string, sourceThreadId: string): string {
  return useSidecarStore.getState().launchProgram({
    type: 'audio-studio',
    title: `Audio: ${title}`,
    initialState: {
      title,
      script: [],
      voices: [],
      currentSegmentIndex: 0,
      settings: {
        pauseBetweenSegments: 0.5,
        globalSpeed: 1,
        normalizeAudio: true,
      },
    },
    sourceThreadId,
    icon: '🎧',
    launchOptions: { focus: true },
  });
}

export function launchTelephony(phoneNumber?: string, sourceThreadId: string = 'system'): string {
  return useSidecarStore.getState().launchProgram({
    type: 'telephony',
    title: phoneNumber ? `Call: ${phoneNumber}` : 'Phone',
    initialState: {
      callHistory: [],
      keypadOpen: true,
      microphoneMuted: false,
      speakerOn: false,
      isReady: true,
      provider: 'vapi',
    },
    sourceThreadId,
    icon: '📞',
    launchOptions: { focus: true },
  });
}

export function launchOrchestrator(taskDescription: string, sourceThreadId: string): string {
  return useSidecarStore.getState().launchProgram({
    type: 'orchestrator',
    title: 'Orchestrator',
    initialState: {
      agents: [],
      taskGraph: { nodes: [], edges: [] },
      overallProgress: 0,
      isRunning: false,
      originalPrompt: taskDescription,
      executionMode: 'parallel',
    },
    sourceThreadId,
    icon: '🧠',
    launchOptions: { focus: true },
  });
}

export function launchWorkflowBuilder(
  title: string,
  workspaceId: string,
  sourceThreadId: string,
  options?: { focus?: boolean; replaceExisting?: boolean }
): string {
  return useSidecarStore.getState().launchProgram({
    type: 'workflow-builder',
    title: title || 'Workflow Builder',
    initialState: {
      workspaceId,
      dagId: null,
      selectedNodeId: null,
      viewMode: 'canvas',
    },
    sourceThreadId,
    icon: '🌊',
    launchOptions: options,
  });
}

// ============================================================================
// XML-style Launch Protocol Parser
// ============================================================================

export interface LaunchCommand {
  type: A2rProgramType;
  params: Record<string, unknown>;
}

export function parseLaunchCommands(message: string): LaunchCommand[] {
  const commands: LaunchCommand[] = [];
  const regex = /<launch_utility\s+type="([^"]+)"(?:\s+title="([^"]*)")?[^>]*>([\s\S]*?)<\/launch_utility>/g;
  
  let match;
  while ((match = regex.exec(message)) !== null) {
    const type = match[1] as A2rProgramType;
    const title = match[2] || 'Untitled';
    const content = match[3].trim();
    
    let params: Record<string, unknown> = { title };
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        params = { ...params, ...parsed };
      } catch {
        params.content = content;
      }
    }
    
    commands.push({ type, params });
  }
  
  return commands;
}

export function executeLaunchCommands(
  commands: LaunchCommand[],
  sourceThreadId: string
): string[] {
  return commands.map(cmd => {
    switch (cmd.type) {
      case 'research-doc':
        return launchResearchDoc(
          String(cmd.params.title || 'Research'),
          String(cmd.params.topic || 'General'),
          sourceThreadId,
          { focus: true }
        );
      case 'data-grid':
        return launchDataGrid(
          String(cmd.params.title || 'Data'),
          (cmd.params.columns as DataGridState['columns']) || [],
          sourceThreadId,
          { focus: true }
        );
      case 'presentation':
        return launchPresentation(
          String(cmd.params.title || 'Presentation'),
          sourceThreadId,
          { focus: true }
        );
      case 'code-preview':
        return launchCodePreview(
          String(cmd.params.title || 'Preview'),
          (cmd.params.files as CodePreviewState['files']) || [],
          String(cmd.params.entryFile || 'index.html'),
          sourceThreadId,
          { focus: true }
        );
      case 'asset-manager':
        return launchAssetManager(sourceThreadId);
      case 'image-studio':
        return launchImageStudio(String(cmd.params.imageUrl || ''), sourceThreadId);
      case 'audio-studio':
        return launchAudioStudio(String(cmd.params.title || 'Audio'), sourceThreadId);
      case 'telephony':
        return launchTelephony(String(cmd.params.phoneNumber || ''), sourceThreadId);
      case 'orchestrator':
        return launchOrchestrator(String(cmd.params.task || 'Parallel Execution'), sourceThreadId);
      case 'workflow-builder':
        return launchWorkflowBuilder(
          String(cmd.params.title || 'Workflow Builder'),
          String(cmd.params.workspaceId || 'default'),
          sourceThreadId,
          { focus: true }
        );
      default:
        throw new Error(`Unknown program type: ${cmd.type}`);
    }
  });
}

export function processAgentMessage(message: string, sourceThreadId: string): string[] {
  const commands = parseLaunchCommands(message);
  if (commands.length === 0) return [];
  return executeLaunchCommands(commands, sourceThreadId);
}

export function wrapLaunchCommand(
  type: A2rProgramType,
  title: string,
  params: Record<string, unknown>
): string {
  return `<launch_utility type="${type}" title="${title}">
${JSON.stringify(params, null, 2)}
</launch_utility>`;
}

// ============================================================================
// React Hook for Agents
// ============================================================================

import { useCallback } from 'react';

export function useLaunchProtocol(sourceThreadId: string) {
  const { launchProgram } = useSidecarStore();
  
  return {
    launchResearchDoc: useCallback(
      (title: string, topic: string, options?: { focus?: boolean }) => 
        launchResearchDoc(title, topic, sourceThreadId, options),
      [sourceThreadId]
    ),
    launchDataGrid: useCallback(
      (title: string, columns: DataGridState['columns'], options?: { focus?: boolean }) =>
        launchDataGrid(title, columns, sourceThreadId, options),
      [sourceThreadId]
    ),
    launchPresentation: useCallback(
      (title: string, options?: { focus?: boolean }) =>
        launchPresentation(title, sourceThreadId, options),
      [sourceThreadId]
    ),
    launchCodePreview: useCallback(
      (title: string, files: CodePreviewState['files'], entryFile: string, options?: { focus?: boolean }) =>
        launchCodePreview(title, files, entryFile, sourceThreadId, options),
      [sourceThreadId]
    ),
    launchAssetManager: useCallback(
      () => launchAssetManager(sourceThreadId),
      [sourceThreadId]
    ),
    launchImageStudio: useCallback(
      (imageUrl: string) => launchImageStudio(imageUrl, sourceThreadId),
      [sourceThreadId]
    ),
    launchAudioStudio: useCallback(
      (title: string) => launchAudioStudio(title, sourceThreadId),
      [sourceThreadId]
    ),
    launchTelephony: useCallback(
      (phoneNumber?: string) => launchTelephony(phoneNumber, sourceThreadId),
      [sourceThreadId]
    ),
    launchOrchestrator: useCallback(
      (taskDescription: string) => launchOrchestrator(taskDescription, sourceThreadId),
      [sourceThreadId]
    ),
    launchWorkflowBuilder: useCallback(
      (title: string, workspaceId: string, options?: { focus?: boolean }) =>
        launchWorkflowBuilder(title, workspaceId, sourceThreadId, options),
      [sourceThreadId]
    ),
    launch: useCallback(
      <T extends Record<string, unknown>>(type: A2rProgramType, title: string, initialState: T) =>
        launchProgram<T>({ type, title, initialState, sourceThreadId }),
      [sourceThreadId, launchProgram]
    ),
  };
}

/**
 * allternit Super-Agent OS - Launch Protocol
 * 
 * IPC (Inter-Process Communication) utilities for agents to launch
 * and control programs in the Utility Pane.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type {
  AllternitProgramType,
  AllternitProgramState,
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
  options?: { focus?: boolean; replaceExisting?: boolean },
  initialContent?: {
    sections?: ResearchDocState['sections'];
    citations?: ResearchDocState['citations'];
    evidence?: ResearchDocState['evidence'];
    tableOfContents?: ResearchDocState['tableOfContents'];
  },
): string {
  const hasSections = initialContent?.sections && initialContent.sections.length > 0;
  const initialState: ResearchDocState = {
    topic,
    sections: initialContent?.sections ?? [],
    citations: initialContent?.citations ?? [],
    evidence: initialContent?.evidence ?? [],
    tableOfContents: initialContent?.tableOfContents ?? [],
    // Already have content → not generating; empty → show progress
    isGenerating: !hasSections,
    generationProgress: hasSections
      ? undefined
      : { currentStep: 'Initializing research...', percentComplete: 0 },
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
  options?: { focus?: boolean; replaceExisting?: boolean },
  initialContent?: {
    rows?: DataGridState['rows'];
    visualizations?: DataGridState['visualizations'];
  },
): string {
  const hasData = initialContent?.rows && initialContent.rows.length > 0;

  // Auto-create a default bar chart visualization when agent-provided data is present.
  // The chart is rendered client-side via Chart.js (no Python required).
  const autoViz: DataGridState['visualizations'] =
    hasData && (!initialContent?.visualizations || initialContent.visualizations.length === 0)
      ? [{
          id: 'auto-chart-1',
          type: 'bar',
          title: `${title} — Chart`,
          config: {
            xAxis: columns[0]?.id ?? '',
            yAxis: columns.find(c => c.type === 'number')?.id ?? columns[1]?.id ?? '',
            chartEngine: 'chartjs',
          },
          status: 'pending',
        }]
      : (initialContent?.visualizations ?? []);

  const initialState: DataGridState = {
    title,
    columns,
    rows: initialContent?.rows ?? [],
    visualizations: autoViz,
    isGenerating: !hasData,
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
  options?: { focus?: boolean; replaceExisting?: boolean },
  initialContent?: {
    slides?: PresentationState['slides'];
    theme?: Partial<PresentationState['theme']>;
  },
): string {
  const hasSlides = initialContent?.slides && initialContent.slides.length > 0;
  const defaultTheme: PresentationState['theme'] = {
    id: 'modern',
    name: 'Modern',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#0f172a',
    textColor: '#f1f5f9',
    fontHeading: 'system-ui, sans-serif',
    fontBody: 'system-ui, sans-serif',
  };
  const initialState: PresentationState = {
    title,
    slides: initialContent?.slides ?? [],
    currentSlideIndex: 0,
    theme: { ...defaultTheme, ...(initialContent?.theme ?? {}) },
    isPresenting: false,
    availableThemes: [],
    isGenerating: !hasSlides,
    generationProgress: hasSlides
      ? undefined
      : { currentSlide: 0, totalSlides: 0 },
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
  type: AllternitProgramType;
  params: Record<string, unknown>;
}

/** Strip trailing commas before ] or } so lenient JSON still parses */
function stripTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

/** Strip a leading/trailing markdown code fence from a string if present */
function stripCodeFence(s: string): string {
  return s.replace(/^```[\w]*\s*/m, '').replace(/\s*```\s*$/m, '').trim();
}

/** Try multiple JSON parse strategies, returning null on total failure */
function tryParseJSON(raw: string): Record<string, unknown> | null {
  const attempts = [
    raw,                             // as-is
    stripTrailingCommas(raw),        // trailing-comma fix
    stripCodeFence(raw),             // strip surrounding fences
    stripTrailingCommas(stripCodeFence(raw)), // both
  ];
  for (const attempt of attempts) {
    try {
      const v = JSON.parse(attempt);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // try next
    }
  }
  return null;
}

export function parseLaunchCommands(message: string): LaunchCommand[] {
  const commands: LaunchCommand[] = [];

  // Strip outer markdown code fences that may wrap the entire XML block
  const normalised = stripCodeFence(message);

  // Matches <launch_utility type="..." title="...">...</launch_utility>
  // - type/title can appear in either order and other attrs are tolerated
  // - content is captured non-greedy, allowing multiple tags per message
  const tagRe = /<launch_utility\b([^>]*)>([\s\S]*?)<\/launch_utility>/gi;
  const attrType = /\btype=["']([^"']+)["']/i;
  const attrTitle = /\btitle=["']([^"']*?)["']/i;

  // Search both the original message and the normalised version for tags
  for (const src of [message, normalised]) {
    let match: RegExpExecArray | null;
    tagRe.lastIndex = 0;
    while ((match = tagRe.exec(src)) !== null) {
      const attrs = match[1];
      const rawContent = match[2].trim();

      const typeMatch = attrType.exec(attrs);
      if (!typeMatch) continue;
      const type = typeMatch[1] as AllternitProgramType;

      const titleMatch = attrTitle.exec(attrs);
      const title = titleMatch ? titleMatch[1] : 'Untitled';

      let params: Record<string, unknown> = { title };

      if (rawContent) {
        const parsed = tryParseJSON(rawContent);
        if (parsed) {
          params = { ...params, ...parsed };
        } else {
          params.content = rawContent;
        }
      }

      // Deduplicate: skip if same type+title already queued from the other src pass
      const isDupe = commands.some(c => c.type === type && c.params.title === title);
      if (!isDupe) {
        commands.push({ type, params });
      }
    }
    // If we found commands in the original, no need to try the normalised copy
    if (commands.length > 0) break;
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
          { focus: true },
          {
            sections: cmd.params.sections as ResearchDocState['sections'] | undefined,
            citations: cmd.params.citations as ResearchDocState['citations'] | undefined,
            evidence: cmd.params.evidence as ResearchDocState['evidence'] | undefined,
            tableOfContents: cmd.params.tableOfContents as ResearchDocState['tableOfContents'] | undefined,
          },
        );
      case 'data-grid':
        return launchDataGrid(
          String(cmd.params.title || 'Data'),
          (cmd.params.columns as DataGridState['columns']) || [],
          sourceThreadId,
          { focus: true },
          {
            rows: cmd.params.rows as DataGridState['rows'] | undefined,
            visualizations: cmd.params.visualizations as DataGridState['visualizations'] | undefined,
          },
        );
      case 'presentation':
        return launchPresentation(
          String(cmd.params.title || 'Presentation'),
          sourceThreadId,
          { focus: true },
          {
            slides: cmd.params.slides as PresentationState['slides'] | undefined,
            theme: cmd.params.theme as Partial<PresentationState['theme']> | undefined,
          },
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

export type DispatchReplyEventFn = (
  conversationId: string,
  event: {
    type: "artifact.created";
    replyId: string;
    runId: string;
    itemId: string;
    artifactId: string;
    artifactType: string;
    title: string;
    metadata?: Record<string, unknown>;
    ts: number;
  }
) => void;

export function processAgentMessage(
  message: string,
  sourceThreadId: string,
  /**
   * Optional: reply ID whose text contained the launch tags.
   * When provided, program launches are also emitted as ArtifactReplyItems
   * so they appear inline in the CoworkTranscript.
   */
  options?: {
    replyId?: string;
    dispatchReplyEvent?: DispatchReplyEventFn;
  },
): string[] {
  const commands = parseLaunchCommands(message);
  if (commands.length === 0) return [];
  const programIds = executeLaunchCommands(commands, sourceThreadId);

  // Emit canonical ArtifactReplyItems so the transcript stays in sync
  if (options?.replyId && options?.dispatchReplyEvent) {
    const { replyId, dispatchReplyEvent } = options;
    programIds.forEach((programId, idx) => {
      const cmd = commands[idx];
      if (!cmd) return;
      dispatchReplyEvent(sourceThreadId, {
        type: "artifact.created",
        replyId,
        runId: "",
        itemId: `artifact-program-${programId}`,
        artifactId: programId,
        artifactType: `allternit-program:${cmd.type}`,
        title: (cmd.params.title as string) ?? cmd.type,
        metadata: { programType: cmd.type },
        ts: Date.now(),
      });
    });
  }

  return programIds;
}

export function wrapLaunchCommand(
  type: AllternitProgramType,
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
      <T extends Record<string, unknown>>(type: AllternitProgramType, title: string, initialState: T) =>
        launchProgram<T>({ type, title, initialState, sourceThreadId }),
      [sourceThreadId, launchProgram]
    ),
  };
}

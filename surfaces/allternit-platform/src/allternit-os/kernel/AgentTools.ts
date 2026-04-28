/**
 * allternit Super-Agent OS - Agent Tools
 * 
 * Tool definitions for agents to interact with the Utility Pane.
 * These are the functions that should be exposed to the LLM/Agent Runtime.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import { decomposeTask, OrchestratorEngine } from './OrchestratorEngine';
import type {
  AllternitProgramType,
  ResearchDocState,
  DataGridState,
  DataGridVisualization,
  PresentationState,
  CodePreviewState,
  OrchestratorState,
} from '../types/programs';

// ============================================================================
// Tool Definitions (for LLM function calling)
// ============================================================================

export const AGENT_TOOLS = [
  {
    name: 'launch_program',
    description: 'Launch a new program in the Utility Pane',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['research-doc', 'data-grid', 'presentation', 'code-preview', 'orchestrator'],
          description: 'Type of program to launch',
        },
        title: {
          type: 'string',
          description: 'Title for the program',
        },
        initialState: {
          type: 'object',
          description: 'Initial state for the program',
        },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'update_program',
    description: 'Update an existing program\'s state',
    parameters: {
      type: 'object',
      properties: {
        programId: {
          type: 'string',
          description: 'ID of the program to update',
        },
        updates: {
          type: 'object',
          description: 'Partial state updates',
        },
      },
      required: ['programId', 'updates'],
    },
  },
  {
    name: 'append_content',
    description: 'Append content to a research document (streaming)',
    parameters: {
      type: 'object',
      properties: {
        programId: {
          type: 'string',
          description: 'ID of the research document',
        },
        sectionId: {
          type: 'string',
          description: 'Section ID to append to',
        },
        content: {
          type: 'string',
          description: 'Content to append',
        },
      },
      required: ['programId', 'sectionId', 'content'],
    },
  },
  {
    name: 'add_data_row',
    description: 'Add a row to a data grid',
    parameters: {
      type: 'object',
      properties: {
        programId: {
          type: 'string',
          description: 'ID of the data grid',
        },
        row: {
          type: 'object',
          description: 'Row data (key-value pairs)',
        },
      },
      required: ['programId', 'row'],
    },
  },
  {
    name: 'add_slide',
    description: 'Add a slide to a presentation',
    parameters: {
      type: 'object',
      properties: {
        programId: {
          type: 'string',
          description: 'ID of the presentation',
        },
        type: {
          type: 'string',
          enum: ['title', 'content', 'split', 'image', 'code', 'chart', 'quote'],
        },
        content: {
          type: 'string',
          description: 'Slide content (markdown supported)',
        },
        notes: {
          type: 'string',
          description: 'Speaker notes',
        },
      },
      required: ['programId', 'type', 'content'],
    },
  },
  {
    name: 'run_orchestrator',
    description: 'Run a parallel multi-agent orchestration for complex tasks',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Task description to decompose and execute',
        },
        mode: {
          type: 'string',
          enum: ['sequential', 'parallel', 'dag'],
          description: 'Execution mode',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'visualize_data',
    description: 'Create a visualization from data grid',
    parameters: {
      type: 'object',
      properties: {
        programId: {
          type: 'string',
          description: 'ID of the data grid',
        },
        chartType: {
          type: 'string',
          enum: ['bar', 'line', 'scatter', 'pie', 'heatmap'],
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to visualize',
        },
      },
      required: ['programId', 'chartType', 'columns'],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

export interface ToolContext {
  threadId: string;
  programId?: string;
}

export function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext
): { success: boolean; result?: unknown; error?: string } {
  const store = useSidecarStore.getState();

  try {
    switch (toolName) {
      case 'launch_program':
        return handleLaunchProgram(args, context);
      
      case 'update_program':
        return handleUpdateProgram(args);
      
      case 'append_content':
        return handleAppendContent(args);
      
      case 'add_data_row':
        return handleAddDataRow(args);
      
      case 'add_slide':
        return handleAddSlide(args);
      
      case 'run_orchestrator':
        return handleRunOrchestrator(args, context);
      
      case 'visualize_data':
        return handleVisualizeData(args);
      
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function handleLaunchProgram(
  args: Record<string, unknown>,
  context: ToolContext
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const type = args.type as AllternitProgramType;
  const title = args.title as string;

  let programId: string;

  switch (type) {
    case 'research-doc':
      programId = store.launchProgram<ResearchDocState>({
        type,
        title,
        initialState: (args.initialState as ResearchDocState) || {
          topic: title,
          sections: [],
          citations: [],
          evidence: [],
          tableOfContents: [],
          isGenerating: true,
        },
        sourceThreadId: context.threadId,
        icon: '📄',
        launchOptions: { focus: true },
      });
      break;

    case 'data-grid':
      programId = store.launchProgram<DataGridState>({
        type,
        title,
        initialState: (args.initialState as DataGridState) || {
          title,
          columns: [],
          rows: [],
          visualizations: [],
          isGenerating: false,
        },
        sourceThreadId: context.threadId,
        icon: '📊',
        launchOptions: { focus: true },
      });
      break;

    case 'presentation':
      programId = store.launchProgram<PresentationState>({
        type,
        title,
        initialState: (args.initialState as PresentationState) || {
          title,
          slides: [],
          currentSlideIndex: 0,
          theme: {
            id: 'modern',
            name: 'Modern',
            primaryColor: 'var(--status-info)',
            secondaryColor: '#8b5cf6',
            backgroundColor: '#ffffff',
            textColor: 'var(--surface-panel)',
            fontHeading: 'system-ui, sans-serif',
            fontBody: 'system-ui, sans-serif',
          },
          isPresenting: false,
          availableThemes: [],
          isGenerating: false,
        },
        sourceThreadId: context.threadId,
        icon: '🎬',
        launchOptions: { focus: true },
      });
      break;

    case 'code-preview':
      programId = store.launchProgram<CodePreviewState>({
        type,
        title,
        initialState: (args.initialState as CodePreviewState) || {
          files: [],
          entryFile: 'index.html',
          consoleLogs: [],
          isBuilding: false,
          autoReload: true,
          sandboxConfig: {
            allowScripts: true,
            allowSameOrigin: false,
            allowForms: false,
          },
        },
        sourceThreadId: context.threadId,
        icon: '💻',
        launchOptions: { focus: true },
      });
      break;

    case 'orchestrator':
      programId = store.launchProgram<OrchestratorState>({
        type,
        title,
        initialState: (args.initialState as OrchestratorState) || {
          agents: [],
          taskGraph: { nodes: [], edges: [] },
          overallProgress: 0,
          isRunning: false,
          originalPrompt: '',
          executionMode: 'parallel',
        },
        sourceThreadId: context.threadId,
        icon: '🧠',
        launchOptions: { focus: true },
      });
      break;

    default:
      throw new Error(`Unsupported program type: ${type}`);
  }

  return { success: true, result: { programId } };
}

function handleUpdateProgram(
  args: Record<string, unknown>
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const programId = args.programId as string;
  const updates = args.updates as Record<string, unknown>;

  store.updateProgramState(programId, (state) => ({
    ...state,
    ...updates,
  }));

  return { success: true };
}

function handleAppendContent(
  args: Record<string, unknown>
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const programId = args.programId as string;
  const sectionId = args.sectionId as string;
  const content = args.content as string;

  store.startStream(programId);
  store.appendStreamChunk(programId, {
    sectionId,
    content,
    isComplete: false,
  });

  return { success: true };
}

function handleAddDataRow(
  args: Record<string, unknown>
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const programId = args.programId as string;
  const row = args.row as Record<string, unknown>;

  store.updateProgramState<DataGridState>(programId, (state) => ({
    ...state,
    rows: [...state.rows, {
      id: `row_${Date.now()}`,
      cells: row,
    }],
  }));

  return { success: true };
}

function handleAddSlide(
  args: Record<string, unknown>
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const programId = args.programId as string;
  const type = args.type as PresentationState['slides'][0]['type'];
  const content = args.content as string;
  const notes = args.notes as string | undefined;

  store.updateProgramState<PresentationState>(programId, (state) => ({
    ...state,
    slides: [...state.slides, {
      id: `slide_${Date.now()}`,
      type,
      content,
      notes,
      layout: 'default',
    }],
  }));

  return { success: true };
}

function handleRunOrchestrator(
  args: Record<string, unknown>,
  context: ToolContext
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const prompt = args.prompt as string;
  const mode = (args.mode as 'sequential' | 'parallel' | 'dag') || 'dag';

  // Launch orchestrator program
  const programId = store.launchProgram<OrchestratorState>({
    type: 'orchestrator',
    title: 'Orchestrator',
    initialState: {
      agents: [],
      taskGraph: { nodes: [], edges: [] },
      overallProgress: 0,
      isRunning: true,
      originalPrompt: prompt,
      executionMode: mode,
    },
    sourceThreadId: context.threadId,
    icon: '🧠',
    launchOptions: { focus: true },
  });

  // Start execution
  const plan = decomposeTask(prompt);
  plan.executionMode = mode;
  
  const engine = new OrchestratorEngine(programId, plan, () => {
    // Updates handled internally
  });
  
  engine.execute().catch(console.error);

  return { success: true, result: { programId } };
}

function handleVisualizeData(
  args: Record<string, unknown>
): { success: boolean; result?: unknown } {
  const store = useSidecarStore.getState();
  const programId = args.programId as string;
  const chartType = args.chartType as DataGridVisualization['type'];
  const columns = args.columns as string[];

  store.updateProgramState<DataGridState>(programId, (state) => ({
    ...state,
    visualizations: [...state.visualizations, {
      id: `viz_${Date.now()}`,
      type: chartType,
      title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
      config: { columns },
      status: 'pending',
    }],
  }));

  return { success: true };
}

// ============================================================================
// React Hook
// ============================================================================

import { useCallback } from 'react';

export function useAgentTools(threadId: string) {
  const executeTool = useCallback((
    toolName: string,
    args: Record<string, unknown>
  ) => {
    return handleToolCall(toolName, args, { threadId });
  }, [threadId]);

  const launchProgram = useCallback((
    type: AllternitProgramType,
    title: string,
    initialState?: Record<string, unknown>
  ) => {
    return handleLaunchProgram(
      { type, title, initialState },
      { threadId }
    );
  }, [threadId]);

  return {
    executeTool,
    launchProgram,
    tools: AGENT_TOOLS,
  };
}

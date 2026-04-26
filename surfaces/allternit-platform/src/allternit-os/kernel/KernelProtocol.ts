/**
 * allternit Super-Agent OS - Kernel Protocol Handler
 * 
 * Processes messages from the 1-kernel Brain Runtime and routes them
 * to the appropriate programs in the Utility Pane.
 * 
 * Protocol Format:
 * {
 *   type: 'program.launch' | 'program.update' | 'program.stream' | 'program.complete',
 *   programId?: string,
 *   programType?: string,
 *   payload: { ... }
 * }
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type {
  AllternitProgramType,
  AllternitProgramState,
  ResearchDocState,
  DataGridState,
  PresentationState,
  CodePreviewState,
  OrchestratorState,
  StreamingChunk,
  ResearchDocSection,
  ResearchDocCitation,
  DataGridRow,
  PresentationSlide,
} from '../types/programs';

// ============================================================================
// Kernel Message Types
// ============================================================================

export type KernelMessageType = 
  | 'program.launch'
  | 'program.update'
  | 'program.stream'
  | 'program.stream.end'
  | 'program.complete'
  | 'program.error'
  | 'orchestrator.agent.update'
  | 'orchestrator.task.update'
  | 'datagrid.row.add'
  | 'datagrid.viz.complete'
  | 'presentation.slide.add';

export interface KernelMessage {
  id: string;
  type: KernelMessageType;
  timestamp: number;
  threadId: string;
  programId?: string;
  programType?: AllternitProgramType;
  payload: unknown;
}

// ============================================================================
// Protocol Handler
// ============================================================================

export class KernelProtocolHandler {
  private messageQueue: KernelMessage[] = [];
  private processing = false;
  private handlers: Map<KernelMessageType, (msg: KernelMessage) => void>;

  constructor() {
    this.handlers = new Map([
      ['program.launch', this.handleProgramLaunch.bind(this)],
      ['program.update', this.handleProgramUpdate.bind(this)],
      ['program.stream', this.handleProgramStream.bind(this)],
      ['program.stream.end', this.handleStreamEnd.bind(this)],
      ['program.complete', this.handleProgramComplete.bind(this)],
      ['program.error', this.handleProgramError.bind(this)],
      ['orchestrator.agent.update', this.handleOrchestratorAgentUpdate.bind(this)],
      ['orchestrator.task.update', this.handleOrchestratorTaskUpdate.bind(this)],
      ['datagrid.row.add', this.handleDataGridRowAdd.bind(this)],
      ['datagrid.viz.complete', this.handleDataGridVizComplete.bind(this)],
      ['presentation.slide.add', this.handlePresentationSlideAdd.bind(this)],
    ]);
  }

  /**
   * Process a message from the kernel
   */
  processMessage(message: KernelMessage): void {
    this.messageQueue.push(message);
    this.processQueue();
  }

  /**
   * Process raw JSON string from kernel
   */
  processJSON(jsonString: string): void {
    try {
      const message: KernelMessage = JSON.parse(jsonString);
      this.processMessage(message);
    } catch (err) {
      console.error('[KernelProtocol] Failed to parse message:', err);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.messageQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      const handler = this.handlers.get(message.type);
      
      if (handler) {
        try {
          handler(message);
        } catch (err) {
          console.error(`[KernelProtocol] Handler failed for ${message.type}:`, err);
        }
      } else {
        console.warn(`[KernelProtocol] No handler for message type: ${message.type}`);
      }
    }
    
    this.processing = false;
  }

  // ========================================================================
  // Message Handlers
  // ========================================================================

  private handleProgramLaunch(msg: KernelMessage): void {
    const store = useSidecarStore.getState();
    const payload = msg.payload as {
      title: string;
      type: AllternitProgramType;
      initialState?: Record<string, unknown>;
      options?: { focus?: boolean; replaceExisting?: boolean };
    };

    const programId = store.launchProgram({
      type: payload.type,
      title: payload.title,
      initialState: payload.initialState,
      sourceThreadId: msg.threadId,
      launchOptions: payload.options,
    });

    console.log(`[KernelProtocol] Launched ${payload.type}: ${programId}`);
  }

  private handleProgramUpdate(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    store.setProgramState(msg.programId, msg.payload as AllternitProgramState);
  }

  private handleProgramStream(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const payload = msg.payload as StreamingChunk & { 
      sectionType?: ResearchDocSection['type'];
      sectionTitle?: string;
    };

    // Auto-create section if needed for research-doc
    const program = store.programs[msg.programId];
    if (program?.type === 'research-doc' && payload.sectionId) {
      const state = program.state as ResearchDocState;
      const sectionExists = state.sections.some(s => s.id === payload.sectionId);
      
      if (!sectionExists && payload.sectionType) {
        // Create new section
        const sectionType = payload.sectionType as ResearchDocSection['type'];
        store.updateProgramState<ResearchDocState>(msg.programId, (prev) => ({
          ...prev,
          sections: [...prev.sections, {
            id: payload.sectionId,
            type: sectionType,
            content: '',
            metadata: payload.sectionTitle ? { title: payload.sectionTitle } : undefined,
          }],
        }));
      }
    }

    store.startStream(msg.programId);
    store.appendStreamChunk(msg.programId, {
      sectionId: payload.sectionId,
      content: payload.content,
      isComplete: payload.isComplete,
    });
  }

  private handleStreamEnd(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    store.endStream(msg.programId);
    
    // Flush any remaining buffer
    const program = store.programs[msg.programId];
    if (program?.type === 'research-doc') {
      const state = program.state as ResearchDocState;
      if (state.streamingContent?.buffer) {
        const { currentSectionId, buffer } = state.streamingContent;
        if (currentSectionId && buffer) {
          store.updateProgramState<ResearchDocState>(msg.programId, (prev) => ({
            ...prev,
            sections: prev.sections.map(s => 
              s.id === currentSectionId 
                ? { ...s, content: s.content + buffer }
                : s
            ),
            streamingContent: { currentSectionId: null, buffer: '' },
          }));
        }
      }
    }
  }

  private handleProgramComplete(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const program = store.programs[msg.programId];
    
    if (!program) return;

    // Type-specific completion handling
    switch (program.type) {
      case 'research-doc':
        store.updateProgramState<ResearchDocState>(msg.programId, (prev) => ({
          ...prev,
          isGenerating: false,
          generationProgress: undefined,
        }));
        break;
        
      case 'data-grid':
        store.updateProgramState<DataGridState>(msg.programId, (prev) => ({
          ...prev,
          isGenerating: false,
        }));
        break;
        
      case 'presentation':
        store.updateProgramState<PresentationState>(msg.programId, (prev) => ({
          ...prev,
          isGenerating: false,
          generationProgress: undefined,
        }));
        break;
    }

    store.endStream(msg.programId);
  }

  private handleProgramError(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    store.emitEvent({
      type: 'program.error',
      programId: msg.programId,
      payload: msg.payload,
    });
  }

  private handleOrchestratorAgentUpdate(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const payload = msg.payload as {
      agentId: string;
      status?: string;
      progress?: number;
      currentTask?: string;
      log?: string;
    };

    store.updateProgramState<OrchestratorState>(msg.programId, (prev) => ({
      ...prev,
      agents: prev.agents.map(a => 
        a.id === payload.agentId 
          ? { 
              ...a, 
              status: (payload.status as OrchestratorState['agents'][0]['status']) || a.status,
              progress: payload.progress ?? a.progress,
              currentTask: payload.currentTask ?? a.currentTask,
              logs: payload.log ? [...a.logs, payload.log] : a.logs,
            }
          : a
      ),
    }));
  }

  private handleOrchestratorTaskUpdate(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const payload = msg.payload as {
      taskId: string;
      status: string;
      output?: unknown;
    };

    store.updateProgramState<OrchestratorState>(msg.programId, (prev) => ({
      ...prev,
      taskGraph: {
        ...prev.taskGraph,
        nodes: prev.taskGraph.nodes.map(n => 
          n.id === payload.taskId 
            ? { ...n, status: payload.status }
            : n
        ),
      },
    }));
  }

  private handleDataGridRowAdd(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const payload = msg.payload as {
      row: Record<string, unknown>;
      metadata?: DataGridRow['metadata'];
    };

    store.updateProgramState<DataGridState>(msg.programId, (prev) => ({
      ...prev,
      rows: [...prev.rows, {
        id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        cells: payload.row,
        metadata: payload.metadata,
      }],
    }));
  }

  private handleDataGridVizComplete(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const payload = msg.payload as {
      vizId: string;
      resultUrl: string;
      errorMessage?: string;
    };

    store.updateProgramState<DataGridState>(msg.programId, (prev) => ({
      ...prev,
      visualizations: prev.visualizations.map(v => 
        v.id === payload.vizId 
          ? { 
              ...v, 
              status: payload.errorMessage ? 'error' : 'complete',
              resultUrl: payload.resultUrl,
              errorMessage: payload.errorMessage,
            }
          : v
      ),
    }));
  }

  private handlePresentationSlideAdd(msg: KernelMessage): void {
    if (!msg.programId) return;
    
    const store = useSidecarStore.getState();
    const payload = msg.payload as PresentationSlide;

    store.updateProgramState<PresentationState>(msg.programId, (prev) => ({
      ...prev,
      slides: [...prev.slides, { ...payload, id: payload.id || `slide_${Date.now()}` }],
    }));
  }
}

// ============================================================================
// Auto-Launch Detector
// ============================================================================

interface LaunchDirective {
  type: AllternitProgramType;
  title: string;
  detected: boolean;
}

/**
 * Detect if an agent message contains implicit program launch directives
 */
export function detectLaunchDirectives(content: string): LaunchDirective[] {
  const directives: LaunchDirective[] = [];
  const lower = content.toLowerCase();

  // Research document detection
  if (lower.includes('research') || lower.includes('report') || lower.includes('analysis')) {
    if (lower.includes('document') || lower.includes('report') || content.length > 500) {
      directives.push({
        type: 'research-doc',
        title: extractTitle(content) || 'Research Document',
        detected: true,
      });
    }
  }

  // Data grid detection
  if (lower.includes('table') || lower.includes('data') || lower.includes('spreadsheet')) {
    if (lower.includes('rows') || lower.includes('columns') || lower.includes('csv')) {
      directives.push({
        type: 'data-grid',
        title: extractTitle(content) || 'Data Analysis',
        detected: true,
      });
    }
  }

  // Presentation detection
  if (lower.includes('slide') || lower.includes('presentation') || lower.includes('deck')) {
    directives.push({
      type: 'presentation',
      title: extractTitle(content) || 'Presentation',
      detected: true,
    });
  }

  // Code preview detection
  if (lower.includes('```') && (lower.includes('html') || lower.includes('react') || lower.includes('component'))) {
    directives.push({
      type: 'code-preview',
      title: extractTitle(content) || 'Code Preview',
      detected: true,
    });
  }

  return directives;
}

function extractTitle(content: string): string | null {
  // Try to extract title from first line or markdown heading
  const lines = content.split('\n');
  
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    
    // Markdown heading
    const headingMatch = trimmed.match(/^#+\s+(.+)$/);
    if (headingMatch) return headingMatch[1];
    
    // Bold title
    const boldMatch = trimmed.match(/\*\*(.+?)\*\*/);
    if (boldMatch && trimmed.length < 100) return boldMatch[1];
  }
  
  return null;
}

// ============================================================================
// React Hook
// ============================================================================

import { useCallback, useRef, useEffect } from 'react';

export function useKernelProtocol(threadId: string) {
  const handlerRef = useRef(new KernelProtocolHandler());
  const autoLaunchRef = useRef(true);

  const processMessage = useCallback((message: KernelMessage | string) => {
    if (typeof message === 'string') {
      handlerRef.current.processJSON(message);
    } else {
      handlerRef.current.processMessage(message);
    }
  }, []);

  const processAgentResponse = useCallback((content: string) => {
    // First, check for explicit launch commands
    const explicitLaunchRegex = /<launch_(\w+)\s+title="([^"]*)"[^>]*>/g;
    let match;
    
    while ((match = explicitLaunchRegex.exec(content)) !== null) {
      const type = match[1] as AllternitProgramType;
      const title = match[2];
      
      handlerRef.current.processMessage({
        id: `auto-${Date.now()}`,
        type: 'program.launch',
        timestamp: Date.now(),
        threadId,
        payload: { type, title, options: { focus: true } },
      });
    }

    // Then, check for implicit directives if auto-launch is enabled
    if (autoLaunchRef.current) {
      const directives = detectLaunchDirectives(content);
      
      directives.forEach(directive => {
        handlerRef.current.processMessage({
          id: `auto-${Date.now()}`,
          type: 'program.launch',
          timestamp: Date.now(),
          threadId,
          payload: { 
            type: directive.type, 
            title: directive.title,
            options: { focus: false }, // Don't focus on auto-detected
          },
        });
      });
    }
  }, [threadId]);

  const setAutoLaunch = useCallback((enabled: boolean) => {
    autoLaunchRef.current = enabled;
  }, []);

  return {
    processMessage,
    processAgentResponse,
    setAutoLaunch,
    handler: handlerRef.current,
  };
}

// Singleton for non-React usage
export const kernelProtocol = new KernelProtocolHandler();

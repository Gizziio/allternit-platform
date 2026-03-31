/**
 * A2rchitect Super-Agent OS - Program Launcher
 * 
 * Centralized program launching with URI scheme support:
 * - Parse a2r:// URIs
 * - Launch programs by type with initial state
 * - Batch launch multiple programs
 * - Handle launch queue and priorities
 */

import type { A2rProgram, A2rProgramType, LaunchProgramRequest } from '../types/programs';

// ============================================================================
// Types
// ============================================================================

export interface LaunchOptions {
  /** Focus the program after launch */
  focus?: boolean;
  /** Replace existing program of same type */
  replaceExisting?: boolean;
  /** Launch in background */
  background?: boolean;
  /** Source thread/chat ID */
  threadId?: string;
  /** Custom icon */
  icon?: string;
}

export interface ProgramLaunchRequest {
  type: A2rProgramType;
  title: string;
  initialState?: Record<string, unknown>;
  options?: LaunchOptions;
}

export interface LaunchQueueItem extends ProgramLaunchRequest {
  id: string;
  timestamp: number;
  priority: number;
  status: 'pending' | 'launching' | 'completed' | 'failed';
  error?: string;
  result?: A2rProgram;
}

export type LaunchHandler = (request: LaunchProgramRequest) => Promise<A2rProgram>;

// ============================================================================
// URI Scheme Parser
// ============================================================================

const PROGRAM_URI_SCHEME = 'a2r:';

export interface ParsedA2rUri {
  type: A2rProgramType;
  params: Record<string, string>;
  action?: string;
}

export function parseA2rUri(uri: string): ParsedA2rUri | null {
  try {
    // Handle both a2r://type and a2r:type formats
    const normalized = uri.replace(/^a2r:\/\//, 'a2r:/');
    const url = new URL(normalized);
    
    if (url.protocol !== PROGRAM_URI_SCHEME) {
      return null;
    }

    // Extract type from pathname (remove leading /)
    const type = url.pathname.replace(/^\//, '') || url.hostname;
    
    if (!isValidProgramType(type)) {
      return null;
    }

    // Parse params
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = decodeURIComponent(value);
    });

    return {
      type: type as A2rProgramType,
      params,
      action: params.action,
    };
  } catch (error) {
    console.error('Failed to parse A2r URI:', error);
    return null;
  }
}

export function buildA2rUri(
  type: A2rProgramType, 
  params: Record<string, string> = {}
): string {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `a2r://${type}${queryString ? `?${queryString}` : ''}`;
}

function isValidProgramType(type: string): boolean {
  const validTypes: A2rProgramType[] = [
    'research-doc',
    'data-grid',
    'presentation',
    'code-preview',
    'asset-manager',
    'image-studio',
    'audio-studio',
    'telephony',
    'browser',
    'orchestrator',
    'workflow-builder',
    'custom',
  ];
  return validTypes.includes(type as A2rProgramType);
}

// ============================================================================
// Program Launcher Class
// ============================================================================

class ProgramLauncher {
  private launchHandler: LaunchHandler | null = null;
  private queue: LaunchQueueItem[] = [];
  private processing = false;
  private listeners: Set<(queue: LaunchQueueItem[]) => void> = new Set();

  /**
   * Set the handler responsible for actually launching programs
   */
  setHandler(handler: LaunchHandler): void {
    this.launchHandler = handler;
  }

  /**
   * Launch a single program
   */
  async launch(
    request: ProgramLaunchRequest
  ): Promise<A2rProgram> {
    const queueItem: LaunchQueueItem = {
      ...request,
      id: `launch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      priority: 0,
      status: 'pending',
    };

    this.queue.push(queueItem);
    this.notifyListeners();

    try {
      queueItem.status = 'launching';
      this.notifyListeners();

      if (!this.launchHandler) {
        throw new Error('No launch handler registered');
      }

      const programRequest: LaunchProgramRequest = {
        type: request.type,
        title: request.title,
        initialState: request.initialState,
        sourceThreadId: request.options?.threadId || 'default',
        icon: request.options?.icon,
      };

      const result = await this.launchHandler(programRequest);
      
      queueItem.status = 'completed';
      queueItem.result = result;
      this.notifyListeners();

      return result;
    } catch (error) {
      queueItem.status = 'failed';
      queueItem.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Launch multiple programs in batch
   */
  async launchBatch(
    requests: ProgramLaunchRequest[]
  ): Promise<A2rProgram[]> {
    const results: A2rProgram[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.launch(request);
        results.push(result);
      } catch (error) {
        console.error('Failed to launch program:', error);
        // Continue with other launches
      }
    }

    return results;
  }

  /**
   * Launch from URI scheme
   */
  async launchFromUri(uri: string): Promise<A2rProgram | null> {
    const parsed = parseA2rUri(uri);
    
    if (!parsed) {
      console.error('Invalid A2r URI:', uri);
      return null;
    }

    const { type, params } = parsed;
    
    // Build initial state from params
    const initialState: Record<string, unknown> = {};
    
    // Common params that map to state
    if (params.topic) initialState.topic = params.topic;
    if (params.url) initialState.url = params.url;
    if (params.data) {
      try {
        initialState.data = JSON.parse(params.data);
      } catch {
        initialState.data = params.data;
      }
    }
    if (params.content) initialState.content = params.content;
    if (params.title) initialState.title = params.title;

    // Type-specific state parsing
    switch (type) {
      case 'research-doc':
        if (params.query) initialState.query = params.query;
        if (params.sources) initialState.sources = params.sources.split(',');
        break;
        
      case 'data-grid':
        if (params.csv) initialState.csvData = params.csv;
        if (params.file) initialState.filePath = params.file;
        break;
        
      case 'code-preview':
        if (params.code) initialState.code = params.code;
        if (params.language) initialState.language = params.language;
        break;
        
      case 'asset-manager':
        if (params.path) initialState.initialPath = params.path;
        break;
        
      case 'browser':
        if (params.url) initialState.initialUrl = params.url;
        break;
    }

    return this.launch({
      type,
      title: params.title || `${type} - ${new Date().toLocaleTimeString()}`,
      initialState,
      options: {
        focus: params.focus !== 'false',
        replaceExisting: params.replace === 'true',
        threadId: params.threadId,
      },
    });
  }

  /**
   * Get current queue status
   */
  getQueue(): LaunchQueueItem[] {
    return [...this.queue];
  }

  /**
   * Clear completed/failed items from queue
   */
  clearQueue(): void {
    this.queue = this.queue.filter(item => item.status === 'pending' || item.status === 'launching');
    this.notifyListeners();
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(callback: (queue: LaunchQueueItem[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.queue]));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const programLauncher = new ProgramLauncher();

// ============================================================================
// React Hook
// ============================================================================

export function useProgramLauncher() {
  const [queue, setQueue] = useState<LaunchQueueItem[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    const unsubscribe = programLauncher.subscribe(newQueue => {
      setQueue(newQueue);
      setIsLaunching(newQueue.some(item => item.status === 'launching'));
    });
    return unsubscribe;
  }, []);

  const launch = useCallback(async (request: ProgramLaunchRequest) => {
    return programLauncher.launch(request);
  }, []);

  const launchFromUri = useCallback(async (uri: string) => {
    return programLauncher.launchFromUri(uri);
  }, []);

  const launchBatch = useCallback(async (requests: ProgramLaunchRequest[]) => {
    return programLauncher.launchBatch(requests);
  }, []);

  const clearQueue = useCallback(() => {
    programLauncher.clearQueue();
  }, []);

  return {
    launch,
    launchFromUri,
    launchBatch,
    clearQueue,
    queue,
    isLaunching,
    pendingCount: queue.filter(i => i.status === 'pending').length,
    completedCount: queue.filter(i => i.status === 'completed').length,
    failedCount: queue.filter(i => i.status === 'failed').length,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function launchResearchDoc(
  topic: string,
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'research-doc',
    title: `Research: ${topic}`,
    initialState: { topic, sections: [], citations: [], evidence: [] },
    options,
  });
}

export function launchDataGrid(
  title: string,
  data?: Record<string, unknown>[],
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'data-grid',
    title,
    initialState: { 
      title, 
      rows: data || [],
      columns: data && data.length > 0 
        ? Object.keys(data[0]).map(key => ({ id: key, header: key, type: 'text' }))
        : [],
    },
    options,
  });
}

export function launchPresentation(
  title: string,
  slides?: { type: string; content: string }[],
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'presentation',
    title,
    initialState: { 
      title, 
      slides: slides || [],
      currentSlideIndex: 0,
    },
    options,
  });
}

export function launchCodePreview(
  code: string,
  language: string,
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'code-preview',
    title: `Code: ${language}`,
    initialState: { 
      files: [{ path: `main.${language}`, content: code, language }],
      entryFile: `main.${language}`,
    },
    options,
  });
}

export function launchAssetManager(
  initialPath?: string,
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'asset-manager',
    title: 'Asset Manager',
    initialState: { currentPath: initialPath || '/' },
    options,
  });
}

export function launchOrchestrator(
  prompt: string,
  agents?: string[],
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'orchestrator',
    title: 'Mixture of Agents',
    initialState: { 
      originalPrompt: prompt,
      agents: agents || [],
      isRunning: false,
    },
    options,
  });
}

export function launchWorkflowBuilder(
  workflowId?: string,
  options?: LaunchOptions
): Promise<A2rProgram> {
  return programLauncher.launch({
    type: 'workflow-builder',
    title: workflowId ? `Workflow: ${workflowId}` : 'Workflow Builder',
    initialState: workflowId ? { workflowId } : {},
    options,
  });
}

// ============================================================================
// Import React for hook
// ============================================================================

import * as React from 'react';
const { useState, useEffect, useCallback } = React;

export default programLauncher;

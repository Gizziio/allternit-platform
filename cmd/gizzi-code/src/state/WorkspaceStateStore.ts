/**
 * Gizzi Workspace State Store
 * 
 * Enhanced state management with workspace/agent context integration
 * Extends AppStateStore with agent workspace capabilities
 */

import { AppStateStore, getGlobalStore } from './AppStateStore';
import type { TypedMessage, AssistantMessage } from '../types/message';
import type { ContextPack, WorkspaceSession } from '../workspace/types';
import { loadWorkspace, executeStartupTasks, enhanceSessionWithWorkspace } from '../workspace/loader';
import type { FileSystem } from '../workspace/loader';
import { buildSystemPrompt, shouldRefreshContext } from '../context/pack-builder';
import { TaskScheduler, taskScheduler, type ScheduledTask } from '../scheduler/TaskScheduler';
import { WorkspaceWatcher, getWorkspaceWatcher, type FileChange } from '../watcher/WorkspaceWatcher';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceEnhancedState {
  session: WorkspaceSession | null;
  contextPack: ContextPack | null;
  isAgentMode: boolean;
}

// ============================================================================
// Workspace State Store
// ============================================================================

export class WorkspaceStateStore extends AppStateStore {
  private workspaceState: WorkspaceEnhancedState = {
    session: null,
    contextPack: null,
    isAgentMode: false,
  };
  
  private fs: FileSystem | null = null;
  private basePath: string = '';
  private taskScheduler: TaskScheduler;
  private workspaceWatcher: WorkspaceWatcher | null = null;

  constructor() {
    super();
    this.taskScheduler = new TaskScheduler({
      onTaskExecute: async (job) => {
        console.log(`[WorkspaceStateStore] Executing scheduled task: ${job.taskId}`);
        // Add system message for task execution
        this.addMessage({
          id: `scheduled-${Date.now()}`,
          role: 'system',
          content: `[Scheduled Task] Executing: ${job.taskId}`,
          systemType: 'info',
        } as TypedMessage);
      },
    });
  }

  setFileSystem(fs: FileSystem, basePath: string) {
    this.fs = fs;
    this.basePath = basePath;
  }

  // ========================================================================
  // Agent Mode Activation
  // ========================================================================

  async activateAgentMode(agentId: string, agentName: string): Promise<boolean> {
    if (!this.fs || !this.basePath) {
      console.error('[WorkspaceStateStore] FileSystem not configured');
      return false;
    }

    console.log(`[WorkspaceStateStore] Activating agent mode: ${agentName}`);

    try {
      // Load workspace
      const workspace = await loadWorkspace({
        agentId,
        agentName,
        sessionId: this.workspaceState.session?.id || `session-${Date.now()}`,
        fs: this.fs,
        basePath: this.basePath,
      });

      if (!workspace) {
        console.log('[WorkspaceStateStore] No workspace found, using default agent settings');
        return false;
      }

      // Execute startup tasks
      await executeStartupTasks(workspace.startupTasks, (content) => {
        // Send startup task message if needed
        this.addMessage({
          id: `system-${Date.now()}`,
          role: 'system',
          content,
          systemType: 'info',
        } as TypedMessage);
      });

      // Register recurring tasks with scheduler
      const recurringTasks: ScheduledTask[] = workspace.startupTasks
        .filter(t => t.frequency !== 'startup')
        .map(t => ({
          id: t.id,
          action: t.action,
          frequency: t.frequency as any,
          completed: false,
        }));
      
      if (recurringTasks.length > 0) {
        this.taskScheduler.registerTasks(agentId, recurringTasks);
        this.taskScheduler.start();
        console.log(`[WorkspaceStateStore] Started task scheduler with ${recurringTasks.length} recurring tasks`);
      }

      // Setup file watcher for auto-refresh
      if (this.fs && this.basePath) {
        this.workspaceWatcher = getWorkspaceWatcher(agentId, this.basePath, this.fs, {
          pollIntervalMs: 5000,
          onChange: (changes) => {
            console.log(`[WorkspaceStateStore] Workspace changed, refreshing context:`,
              changes.map(c => c.path).join(', '));
            // Refresh context
            this.refreshContext();
          },
        });
        this.workspaceWatcher.start();
      }

      // Update state
      this.workspaceState = {
        session: enhanceSessionWithWorkspace(
          { id: `session-${Date.now()}`, name: agentName, mode: 'agent' },
          workspace
        ),
        contextPack: workspace.contextPack,
        isAgentMode: true,
      };

      // Add system message with agent context
      this.addMessage({
        id: `context-${Date.now()}`,
        role: 'system',
        content: `[Agent Context Loaded] ${agentName} is now active with full workspace context.`,
        systemType: 'info',
      } as TypedMessage);

      console.log('[WorkspaceStateStore] Agent mode activated successfully');
      return true;
    } catch (error) {
      console.error('[WorkspaceStateStore] Failed to activate agent mode:', error);
      return false;
    }
  }

  // ========================================================================
  // Message Sending with Context
  // ========================================================================

  async sendMessageWithContext(
    content: string,
    options: { 
      skipContext?: boolean;
      onThinking?: (thinking: string) => void;
      onResponse?: (response: AssistantMessage) => void;
    } = {}
  ): Promise<void> {
    // Add user message
    const userMessage: TypedMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    this.addMessage(userMessage);

    // Check if we should refresh context
    if (this.workspaceState.contextPack && shouldRefreshContext(this.workspaceState.contextPack)) {
      console.log('[WorkspaceStateStore] Context expired, refreshing...');
      if (this.workspaceState.session?.agentId && this.workspaceState.session?.agentName) {
        await this.activateAgentMode(
          this.workspaceState.session.agentId,
          this.workspaceState.session.agentName
        );
      }
    }

    // Build context for AI
    const context = this.workspaceState.isAgentMode && !options.skipContext
      ? this.workspaceState.contextPack
      : null;

    // Here you would send to your AI backend with the context
    // For now, we'll simulate the response structure
    console.log('[WorkspaceStateStore] Sending message with context:', {
      content: content.slice(0, 50) + '...',
      hasContext: !!context,
      trustTiers: context?.trustTiers ? 'included' : 'none',
    });

    // The actual AI integration would happen here:
    // const response = await aiClient.complete({
    //   messages: [...this.getState().messages, userMessage],
    //   systemPrompt: context?.systemPrompt,
    //   trustTiers: context?.trustTiers,
    // });
  }

  // ========================================================================
  // Context Utilities
  // ========================================================================

  getContextPack(): ContextPack | null {
    return this.workspaceState.contextPack;
  }

  getSystemPrompt(): string {
    return this.workspaceState.contextPack?.systemPrompt || 
      'You are Gizzi, a helpful AI assistant.';
  }

  isAgentMode(): boolean {
    return this.workspaceState.isAgentMode;
  }

  requiresPermission(action: string): boolean {
    if (!this.workspaceState.contextPack) return false;
    
    // Check Tier 3 rules
    const actionLower = action.toLowerCase();
    return this.workspaceState.contextPack.trustTiers.tier3.rules.some(
      rule => actionLower.includes(rule.toLowerCase())
    );
  }

  getTrustTiers() {
    return this.workspaceState.contextPack?.trustTiers || null;
  }

  // ========================================================================
  // Context Refresh
  // ========================================================================

  async refreshContext(): Promise<void> {
    if (!this.workspaceState.session?.agentId || !this.workspaceState.session?.agentName) {
      return;
    }

    console.log('[WorkspaceStateStore] Refreshing context...');
    await this.activateAgentMode(
      this.workspaceState.session.agentId,
      this.workspaceState.session.agentName
    );
  }

  // ========================================================================
  // State Reset
  // ========================================================================

  resetAgentMode(): void {
    // Stop scheduler
    this.taskScheduler.stop();
    this.taskScheduler.unregisterAgentTasks(this.workspaceState.session?.agentId || '');

    // Stop watcher
    if (this.workspaceWatcher) {
      this.workspaceWatcher.stop();
      this.workspaceWatcher = null;
    }

    this.workspaceState = {
      session: null,
      contextPack: null,
      isAgentMode: false,
    };
    this.clearMessages();
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let workspaceStore: WorkspaceStateStore | null = null;

export function getWorkspaceStore(): WorkspaceStateStore {
  if (!workspaceStore) {
    workspaceStore = new WorkspaceStateStore();
  }
  return workspaceStore;
}

export function setWorkspaceStore(store: WorkspaceStateStore | null): void {
  workspaceStore = store;
}

/**
 * Gizzi Workspace Loader
 * 
 * Loads agent workspace files and integrates with Gizzi state
 */

import type { WorkspaceSession, ContextPack, WorkspaceFile } from './types';
import { buildContextPack, getStartupTasks } from '../context/pack-builder';

// ============================================================================
// File System Abstraction
// ============================================================================

export interface FileSystem {
  readFile(path: string): Promise<string>;
  listDirectory(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]>;
  exists(path: string): Promise<boolean>;
}

// ============================================================================
// Workspace File Patterns
// ============================================================================

const WORKSPACE_FILE_PATTERNS = [
  '.allternit/manifest.json',
  '.allternit/brain/BRAIN.md',
  '.allternit/memory/MEMORY.md',
  '.allternit/memory/active-tasks.md',
  '.allternit/memory/daily.md',
  '.allternit/memory/lessons.md',
  '.allternit/memory/self-review.md',
  '.allternit/identity/IDENTITY.md',
  '.allternit/identity/SOUL.md',
  '.allternit/identity/USER.md',
  '.allternit/identity/VOICE.md',
  '.allternit/identity/POLICY.md',
  '.allternit/governance/PLAYBOOK.md',
  '.allternit/governance/TOOLS.md',
  '.allternit/governance/HEARTBEAT.md',
  '.allternit/governance/SYSTEM.md',
  '.allternit/governance/CHANNELS.md',
  '.allternit/skills/**',
  '.allternit/business/CLIENTS.md',
] as const;

// ============================================================================
// Workspace Loader
// ============================================================================

export interface LoadWorkspaceOptions {
  agentId: string;
  agentName: string;
  sessionId: string;
  fs: FileSystem;
  basePath: string;
}

export interface LoadedWorkspace {
  files: Map<string, string>;
  contextPack: ContextPack;
  startupTasks: ReturnType<typeof getStartupTasks>;
}

export async function loadWorkspace(
  options: LoadWorkspaceOptions
): Promise<LoadedWorkspace | null> {
  const { agentId, agentName, sessionId, fs, basePath } = options;
  
  console.log('[Gizzi Workspace] Loading workspace for agent:', agentId);
  
  const files = new Map<string, string>();
  
  // Load core files
  for (const pattern of WORKSPACE_FILE_PATTERNS) {
    if (pattern.includes('**')) continue;
    
    const fullPath = `${basePath}/${pattern}`;
    try {
      if (await fs.exists(fullPath)) {
        const content = await fs.readFile(fullPath);
        files.set(pattern, content);
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  
  // Load skill files
  try {
    const skillsPath = `${basePath}/.allternit/skills`;
    if (await fs.exists(skillsPath)) {
      const entries = await fs.listDirectory(skillsPath);
      for (const entry of entries) {
        if (entry.type === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.json'))) {
          const content = await fs.readFile(`${skillsPath}/${entry.name}`);
          files.set(`.allternit/skills/${entry.name}`, content);
        }
      }
    }
  } catch {
    // Skills directory doesn't exist
  }
  
  if (files.size === 0) {
    console.log('[Gizzi Workspace] No workspace files found');
    return null;
  }
  
  console.log(`[Gizzi Workspace] Loaded ${files.size} files`);
  
  // Build context pack
  const contextPack = buildContextPack({
    sessionId,
    agentId,
    agentName,
    files,
  });
  
  // Get startup tasks
  const startupTasks = getStartupTasks(contextPack);
  console.log(`[Gizzi Workspace] ${startupTasks.length} startup tasks to execute`);
  
  return { files, contextPack, startupTasks };
}

// ============================================================================
// Execute Startup Tasks
// ============================================================================

export async function executeStartupTasks(
  tasks: LoadedWorkspace['startupTasks'],
  sendMessage: (content: string) => void
): Promise<void> {
  for (const task of tasks) {
    console.log(`[Gizzi Workspace] Executing startup task: ${task.action}`);
    
    // Execute the task
    // For now, just log it - in production this would perform actual actions
    try {
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Optionally send a message about the task
      if (task.action.toLowerCase().includes('greet') || task.action.toLowerCase().includes('introduce')) {
        // Don't auto-send, let the agent handle it naturally
      }
      
      task.lastExecuted = new Date().toISOString();
    } catch (error) {
      console.error(`[Gizzi Workspace] Task failed:`, error);
    }
  }
}

// ============================================================================
// Session Enhancement
// ============================================================================

export function enhanceSessionWithWorkspace(
  session: WorkspaceSession,
  workspace: LoadedWorkspace
): WorkspaceSession {
  return {
    ...session,
    mode: 'agent',
    contextPack: workspace.contextPack,
    contextHash: workspace.contextPack.hash,
    contextRefreshedAt: new Date().toISOString(),
    workspaceFiles: Array.from(workspace.files.keys()),
  };
}

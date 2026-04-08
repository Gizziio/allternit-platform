/**
 * Agent Workspace Session Integration
 * 
 * Provides workspace mounting and context pack building for agent sessions.
 * Bridges workspace files with agent context.
 */

import { agentWorkspaceService } from './agent-workspace.service';
import { realFileSystem } from '@/plugins/fileSystem.real';
import { nodeTerminalService } from '@/views/nodes/terminal/terminal.service';

// ============================================================================
// Types
// ============================================================================

export interface MountedWorkspaceFile {
  path: string;
  content: string;
  type: string;
  size: number;
}

export interface AgentWorkspaceMount {
  agentId: string;
  sessionId: string;
  files: MountedWorkspaceFile[];
  workspacePath: string;
  mountedAt: string;
}

// ============================================================================
// Workspace Mounting
// ============================================================================

/**
 * Mount agent workspace for a session
 * Loads all workspace files into memory for the agent to access
 */
export async function mountAgentWorkspace(
  agentId: string,
  sessionId: string
): Promise<AgentWorkspaceMount> {
  const workspacePath = await agentWorkspaceService.getWorkspacePath(agentId);
  
  // Ensure workspace exists
  await agentWorkspaceService.ensureWorkspace(agentId);
  
  // Get all files in workspace
  const files = await loadWorkspaceFiles(workspacePath);
  
  const mount: AgentWorkspaceMount = {
    agentId,
    sessionId,
    files,
    workspacePath,
    mountedAt: new Date().toISOString(),
  };
  
  // Store mount in session state (could use a Map or session store)
  activeMounts.set(sessionId, mount);
  
  return mount;
}

/**
 * Refresh workspace files for a session
 * Reloads files that may have changed
 */
export async function refreshAgentWorkspace(
  sessionId: string
): Promise<AgentWorkspaceMount | null> {
  const mount = activeMounts.get(sessionId);
  if (!mount) return null;
  
  // Reload files
  const files = await loadWorkspaceFiles(mount.workspacePath);
  mount.files = files;
  mount.mountedAt = new Date().toISOString();
  
  return mount;
}

/**
 * Unmount workspace for a session
 */
export async function unmountAgentWorkspace(sessionId: string): Promise<void> {
  activeMounts.delete(sessionId);
}

/**
 * Load and mount workspace in one call
 * Convenience function for session initialization
 */
export async function loadAndMountWorkspaceForSession(
  agentId: string,
  sessionId: string
): Promise<AgentWorkspaceMount> {
  return mountAgentWorkspace(agentId, sessionId);
}

// ============================================================================
// Context Pack Building
// ============================================================================

/**
 * Build context pack from mounted workspace
 * Creates structured context for AI with file contents and metadata
 */
export async function buildWorkspaceContextPack(
  sessionId: string,
  options: {
    maxFiles?: number;
    maxTotalSize?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
  } = {}
): Promise<{
  files: MountedWorkspaceFile[];
  summary: string;
  totalSize: number;
  fileCount: number;
}> {
  const mount = activeMounts.get(sessionId);
  if (!mount) {
    return {
      files: [],
      summary: 'No workspace mounted',
      totalSize: 0,
      fileCount: 0,
    };
  }
  
  const { maxFiles = 50, maxTotalSize = 100000 } = options;
  
  let files = mount.files;
  
  // Apply filters
  if (options.includePatterns) {
    files = files.filter(f => 
      options.includePatterns!.some(pattern => f.path.includes(pattern))
    );
  }
  
  if (options.excludePatterns) {
    files = files.filter(f => 
      !options.excludePatterns!.some(pattern => f.path.includes(pattern))
    );
  }
  
  // Limit files
  files = files.slice(0, maxFiles);
  
  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  // If too large, trim content
  if (totalSize > maxTotalSize) {
    files = trimFilesToSize(files, maxTotalSize);
  }
  
  return {
    files,
    summary: `Workspace: ${mount.workspacePath}\n${files.length} files, ${(totalSize / 1024).toFixed(1)}KB`,
    totalSize,
    fileCount: files.length,
  };
}

// ============================================================================
// Helpers
// ============================================================================

// In-memory store for active mounts
const activeMounts = new Map<string, AgentWorkspaceMount>();

async function loadWorkspaceFiles(workspacePath: string): Promise<MountedWorkspaceFile[]> {
  const files: MountedWorkspaceFile[] = [];
  
  try {
    const entries = await realFileSystem.readDir(workspacePath);
    
    for (const entry of entries) {
      if (entry.type === 'file') {
        try {
          const content = await realFileSystem.readFile(entry.path);
          files.push({
            path: entry.path,
            content,
            type: entry.name.split('.').pop() || 'unknown',
            size: entry.size || content.length,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Directory may not exist yet
  }
  
  return files;
}

function trimFilesToSize(files: MountedWorkspaceFile[], maxSize: number): MountedWorkspaceFile[] {
  let currentSize = 0;
  const result: MountedWorkspaceFile[] = [];
  
  for (const file of files) {
    if (currentSize + file.size > maxSize) {
      // Add file with truncated content
      const remainingSpace = maxSize - currentSize;
      if (remainingSpace > 100) {
        result.push({
          ...file,
          content: file.content.slice(0, remainingSpace) + '\n... [truncated]',
          size: remainingSpace,
        });
      }
      break;
    }
    result.push(file);
    currentSize += file.size;
  }
  
  return result;
}

// ============================================================================
// Legacy Exports (for backward compatibility)
// ============================================================================

export {
  agentWorkspaceService,
};

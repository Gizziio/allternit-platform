/**
 * Agent Workspace File System
 * 
 * Real file system implementation for agent workspaces.
 * Uses RealFileSystem to read from agents/{agentId}/.allternit/
 */

// Import with fallback for test environments
import { realFileSystem as importedRealFileSystem } from '@/plugins/fileSystem.real';

// For tests, we may need to use a direct Node.js fs implementation
const getFileSystem = () => {
  // In test environment, try to use direct Node.js fs
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const os = require('os');
      
      return {
        readDir: async (dirPath: string) => {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          return Promise.all(entries.map(async (entry: any) => {
            const fullPath = path.join(dirPath, entry.name);
            const stat = await fs.stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stat.size,
              modified: stat.mtime,
            };
          }));
        },
        readFile: (filePath: string) => fs.readFile(filePath, 'utf-8'),
        exists: async (filePath: string) => {
          try {
            await fs.access(filePath);
            return true;
          } catch {
            return false;
          }
        },
        join: (...paths: string[]) => path.join(...paths),
        getHomeDir: () => os.homedir(),
      };
    } catch {
      // Fall through to use imported realFileSystem
    }
  }
  
  // Use the imported RealFileSystem
  return importedRealFileSystem;
};

const realFileSystem = getFileSystem();

export interface WorkspaceFile {
  path: string;
  name: string;
  content: string;
  type: 'core' | 'skill' | 'memory' | 'governance';
  lastModified: Date;
}

export interface AgentWorkspace {
  agentId: string;
  basePath: string;
  files: WorkspaceFile[];
  loadedAt: Date;
}

// Core files that define agent behavior
const CORE_FILES = [
  'SOUL.md',
  'IDENTITY.md',
  'VOICE.md',
  'POLICY.md',
];

// Governance and automation
const GOVERNANCE_FILES = [
  'HEARTBEAT.md',
  'PLAYBOOK.md',
  'TOOLS.md',
  'SYSTEM.md',
];

// Memory and state
const MEMORY_FILES = [
  'BRAIN.md',
  'MEMORY.md',
  'LESSONS.md',
];

export class AgentWorkspaceFileSystem {
  private fs = realFileSystem;
  private workspaceCache = new Map<string, AgentWorkspace>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the base path for an agent's workspace
   */
  getWorkspacePath(agentId: string): string {
    const homeDir = this.fs.getHomeDir();
    return this.fs.join(homeDir, 'agents', agentId, '.allternit');
  }

  /**
   * Check if agent workspace exists
   */
  async workspaceExists(agentId: string): Promise<boolean> {
    const workspacePath = this.getWorkspacePath(agentId);
    return this.fs.exists(workspacePath);
  }

  /**
   * Load all workspace files for an agent
   */
  async loadWorkspace(agentId: string): Promise<AgentWorkspace | null> {
    // Check cache
    const cached = this.workspaceCache.get(agentId);
    if (cached && Date.now() - cached.loadedAt.getTime() < this.cacheTTL) {
      return cached;
    }

    const workspacePath = this.getWorkspacePath(agentId);
    
    if (!(await this.fs.exists(workspacePath))) {
      return null;
    }

    const files: WorkspaceFile[] = [];

    try {
      await this.scanDirectory(workspacePath, '', files);
    } catch (error) {
      console.error(`[AgentWorkspace] Failed to load workspace for ${agentId}:`, error);
      return null;
    }

    const workspace: AgentWorkspace = {
      agentId,
      basePath: workspacePath,
      files,
      loadedAt: new Date(),
    };

    this.workspaceCache.set(agentId, workspace);
    return workspace;
  }

  /**
   * Scan a directory recursively for workspace files
   */
  private async scanDirectory(
    basePath: string,
    relativePath: string,
    files: WorkspaceFile[]
  ): Promise<void> {
    const fullPath = this.fs.join(basePath, relativePath);
    const entries = await this.fs.readDir(fullPath);

    for (const entry of entries) {
      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.type === 'directory') {
        // Recursively scan subdirectories
        await this.scanDirectory(basePath, entryRelPath, files);
      } else if (entry.type === 'file') {
        // Skip files that are too large (> 100KB)
        if (entry.size && entry.size > 100_000) {
          console.warn(`[AgentWorkspace] Skipping large file: ${entryRelPath}`);
          continue;
        }

        try {
          const content = await this.fs.readFile(entry.path);
          const type = this.classifyFile(entry.name);
          
          files.push({
            path: entryRelPath,
            name: entry.name,
            content,
            type,
            lastModified: entry.modified || new Date(),
          });
        } catch (error) {
          console.warn(`[AgentWorkspace] Failed to read file: ${entryRelPath}`, error);
        }
      }
    }
  }

  /**
   * Classify a file by its name
   */
  private classifyFile(filename: string): WorkspaceFile['type'] {
    const upperName = filename.toUpperCase();
    
    if (CORE_FILES.includes(upperName)) return 'core';
    if (GOVERNANCE_FILES.includes(upperName)) return 'governance';
    if (MEMORY_FILES.includes(upperName)) return 'memory';
    if (upperName.endsWith('.SKILL.MD') || upperName.endsWith('_SKILL.MD')) return 'skill';
    
    return 'core'; // Default
  }

  /**
   * Get a specific file from workspace
   */
  async getFile(agentId: string, filePath: string): Promise<WorkspaceFile | null> {
    const workspace = await this.loadWorkspace(agentId);
    if (!workspace) return null;
    
    return workspace.files.find(f => f.path === filePath) || null;
  }

  /**
   * Read file content directly (bypass cache)
   */
  async readFile(agentId: string, filePath: string): Promise<string | null> {
    const workspacePath = this.getWorkspacePath(agentId);
    const fullPath = this.fs.join(workspacePath, filePath);
    
    try {
      if (!(await this.fs.exists(fullPath))) return null;
      return await this.fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  /**
   * Write file to workspace
   */
  async writeFile(agentId: string, filePath: string, content: string): Promise<boolean> {
    const workspacePath = this.getWorkspacePath(agentId);
    const fullPath = this.fs.join(workspacePath, filePath);
    
    try {
      await (this.fs as any).writeFile(fullPath, content);
      // Invalidate cache
      this.workspaceCache.delete(agentId);
      return true;
    } catch (error) {
      console.error(`[AgentWorkspace] Failed to write file: ${filePath}`, error);
      return false;
    }
  }

  /**
   * Invalidate cache for an agent
   */
  invalidateCache(agentId: string): void {
    this.workspaceCache.delete(agentId);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.workspaceCache.clear();
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(agentId: string): Promise<{
    exists: boolean;
    fileCount: number;
    totalSize: number;
    lastModified: Date | null;
  }> {
    const workspace = await this.loadWorkspace(agentId);
    
    if (!workspace) {
      return {
        exists: false,
        fileCount: 0,
        totalSize: 0,
        lastModified: null,
      };
    }

    const totalSize = workspace.files.reduce((sum, f) => sum + f.content.length, 0);
    const lastModified = workspace.files.length > 0
      ? new Date(Math.max(...workspace.files.map(f => f.lastModified.getTime())))
      : null;

    return {
      exists: true,
      fileCount: workspace.files.length,
      totalSize,
      lastModified,
    };
  }
}

// Export singleton
export const agentWorkspaceFS = new AgentWorkspaceFileSystem();

/**
 * Real File System Implementation
 * 
 * Uses actual Node.js fs APIs to scan directories and read files.
 * This file should only be used in Electron's main process, not renderer.
 */

import type { FileSystemAPI, FileEntry } from './fileSystem.types';

// ============================================================================
// Real File System (for Electron/Node.js environment)
// ============================================================================

export class RealFileSystem implements FileSystemAPI {
  private fs: any = null;
  private path: any = null;
  private os: any = null;
  private childProcess: any = null;
  private homeDir: string = '';
  private isNode: boolean = false;

  constructor() {
    // Defer initialization to avoid Vite trying to bundle Node modules
    this.detectEnvironment();
  }

  private hydrateNodeModules(fsModule: any, pathModule: any, osModule: any, cpModule: any) {
    this.fs = fsModule?.default ?? fsModule;
    this.path = pathModule?.default ?? pathModule;
    this.os = osModule?.default ?? osModule;
    this.childProcess = cpModule?.default ?? cpModule;
    this.homeDir = typeof this.os?.homedir === 'function'
      ? this.os.homedir()
      : ((globalThis as any)?.process?.env?.HOME || '/Users/macbook');
    this.isNode = Boolean(this.fs && this.path && this.os && this.childProcess);
  }

  private tryRequireNodeModules(): boolean {
    const g = globalThis as any;
    const requireCandidates = [
      g?.require,
      g?.window?.require,
      g?.process?.mainModule?.require,
    ];

    for (const requireFn of requireCandidates) {
      if (typeof requireFn !== 'function') continue;
      try {
        const fsModule = requireFn('fs/promises');
        const pathModule = requireFn('path');
        const osModule = requireFn('os');
        const cpModule = requireFn('child_process');
        this.hydrateNodeModules(fsModule, pathModule, osModule, cpModule);
        if (this.isNode) return true;
      } catch {
        // Try next require source.
      }
    }

    return false;
  }

  private async detectEnvironment() {
    if (this.tryRequireNodeModules()) {
      console.log('[RealFileSystem] Using Node.js fs APIs via require');
      return;
    }

    try {
      // Avoid literal import(...) tokens so Vite doesn't try to resolve Node builtins in renderer bundles.
      const dynamicImport = (specifier: string) =>
        eval(`im${'port'}(${JSON.stringify(specifier)})`);

      const fsModule = await dynamicImport('fs/promises');
      const pathModule = await dynamicImport('path');
      const osModule = await dynamicImport('os');
      const cpModule = await dynamicImport('child_process');

      this.hydrateNodeModules(fsModule, pathModule, osModule, cpModule);
      if (this.isNode) {
        console.log('[RealFileSystem] Using Node.js fs APIs via dynamic import');
        return;
      }
    } catch (e) {
      // Silent fail - Node.js fs not available in browser, using fallback
      if (process.env.NODE_ENV === 'development') {
        console.debug('[RealFileSystem] Browser environment detected, using API-backed filesystem');
      }
    }

    this.isNode = false;
    this.homeDir = (globalThis as any)?.process?.env?.HOME || '/Users/macbook';
  }

  private ensureNode() {
    if (!this.isNode) {
      throw new Error('File system operations require Node.js environment');
    }
  }

  async readDir(dirPath: string): Promise<FileEntry[]> {
    if (!this.isNode || !this.fs) {
      return [];
    }

    const entries: FileEntry[] = [];

    try {
      const items = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = this.path.join(dirPath, item.name);
        let type: 'file' | 'directory' = item.isDirectory() ? 'directory' : 'file';
        let size: number | undefined;
        let modified: Date | undefined;

        try {
          const stat = await this.fs.stat(fullPath);
          type = stat.isDirectory() ? 'directory' : 'file';
          size = stat.size;
          modified = stat.mtime;
        } catch {
          // Broken symlink or protected entry: skip quietly and continue scanning.
          continue;
        }

        entries.push({
          name: item.name,
          path: fullPath,
          type,
          size,
          modified,
        });
      }
    } catch {
      console.log(`[RealFileSystem] Cannot read directory: ${dirPath}`);
    }

    return entries;
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.isNode || !this.fs) {
      throw new Error('File reading requires Node.js environment');
    }

    const content = await this.fs.readFile(filePath, 'utf-8');
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.isNode || !this.fs) {
      throw new Error('File writing requires Node.js environment');
    }

    const dir = this.path ? this.path.dirname(filePath) : filePath.split('/').slice(0, -1).join('/');
    await this.mkdir(dir);
    await this.fs.writeFile(filePath, content, 'utf-8');
  }

  async exists(filePath: string): Promise<boolean> {
    if (!this.isNode || !this.fs) {
      return false;
    }

    try {
      await this.fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    if (!this.isNode || !this.fs) {
      return;
    }

    try {
      await this.fs.mkdir(dirPath, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.isNode || !this.fs) {
      throw new Error('File deletion requires Node.js environment');
    }

    try {
      await this.fs.unlink(filePath);
      return;
    } catch (error: any) {
      if (error?.code !== 'EISDIR' && error?.code !== 'EPERM' && error?.code !== 'ENOENT') {
        throw error;
      }
    }

    // Support directory removal for recursive cleanup flows.
    await this.fs.rm(filePath, { recursive: true, force: true });
  }

  join(...paths: string[]): string {
    if (!this.isNode || !this.path) {
      return paths.join('/').replace(/\/+/g, '/');
    }
    return this.path.join(...paths);
  }

  basename(filePath: string): string {
    if (!this.isNode || !this.path) {
      const parts = filePath.split('/');
      return parts[parts.length - 1] || '';
    }
    return this.path.basename(filePath);
  }

  dirname(filePath: string): string {
    if (!this.isNode || !this.path) {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/') || '/';
    }
    return this.path.dirname(filePath);
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.isNode || !this.childProcess) {
      throw new Error('Command execution requires Node.js environment');
    }

    return new Promise((resolve, reject) => {
      this.childProcess.exec(command, (error: any, stdout: string, stderr: string) => {
        if (error && !stdout) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  getHomeDir(): string {
    return this.homeDir;
  }

  isReady(): boolean {
    return this.isNode;
  }
}

// ============================================================================
// Environment Scanner
// ============================================================================

export class EnvironmentScanner {
  private fs: RealFileSystem;

  constructor(fs: RealFileSystem) {
    this.fs = fs;
  }

  async scanSkills(): Promise<Array<{
    id: string;
    name: string;
    path: string;
    content: string;
    config?: any;
  }>> {
    const skills: Array<{
      id: string;
      name: string;
      path: string;
      content: string;
      config?: any;
    }> = [];

    const searchPaths = [
      this.fs.join(this.fs.getHomeDir(), '.allternit', 'skills'),
      '/usr/share/allternit/skills',
    ];

    for (const basePath of searchPaths) {
      try {
        const entries = await this.fs.readDir(basePath);
        
        for (const entry of entries) {
          if (entry.type === 'directory') {
            const skillMdPath = this.fs.join(entry.path, 'SKILL.md');
            const configPath = this.fs.join(entry.path, 'config.json');
            
            try {
              const content = await this.fs.readFile(skillMdPath);
              const config: { name?: string; [key: string]: any } = {};
              
              try {
                const configContent = await this.fs.readFile(configPath);
                Object.assign(config, JSON.parse(configContent));
              } catch (e) {
                // No config file
              }

              skills.push({
                id: `skill-${entry.name}`,
                name: config.name || entry.name,
                path: entry.path,
                content,
                config,
              });
            } catch (e) {
              // No SKILL.md, skip
            }
          }
        }
      } catch (e) {
        // Directory doesn't exist
      }
    }

    return skills;
  }

  async scanCliTools(): Promise<Array<{
    name: string;
    path: string;
    version: string;
  }>> {
    const tools: Array<{
      name: string;
      path: string;
      version: string;
    }> = [];

    const commonTools = [
      'git', 'docker', 'node', 'npm', 'yarn', 'pnpm',
      'python', 'python3', 'pip', 'pip3',
      'go', 'rustc', 'cargo',
      'kubectl', 'helm', 'terraform', 'aws', 'gcloud', 'az',
      'code', 'cursor', 'vim', 'nvim', 'emacs',
      'curl', 'wget', 'jq', 'fzf', 'rg', 'fd',
      'brew', 'apt', 'yum', 'pacman',
      'make', 'cmake', 'gcc', 'clang',
    ];

    for (const tool of commonTools) {
      try {
        const result = await this.fs.exec(`which ${tool}`);
        if (result.stdout.trim()) {
          const toolPath = result.stdout.trim();
          let version = 'unknown';
          
          try {
            const versionResult = await this.fs.exec(`${tool} --version 2>/dev/null || ${tool} -v 2>/dev/null || echo "unknown"`);
            version = versionResult.stdout.trim().split('\n')[0].substring(0, 50);
          } catch (e) {
            // Can't get version
          }

          tools.push({
            name: tool,
            path: toolPath,
            version,
          });
        }
      } catch (e) {
        // Tool not found
      }
    }

    return tools;
  }

  async scanPlugins(): Promise<Array<{
    id: string;
    name: string;
    path: string;
    config: any;
    files: Array<{
      name: string;
      path: string;
      type: 'file' | 'directory';
      content?: string;
    }>;
  }>> {
    const plugins: Array<{
      id: string;
      name: string;
      path: string;
      config: any;
      files: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        content?: string;
      }>;
    }> = [];

    const searchPaths = [
      this.fs.join(this.fs.getHomeDir(), '.allternit', 'plugins'),
    ];

    for (const basePath of searchPaths) {
      try {
        const entries = await this.fs.readDir(basePath);
        
        for (const entry of entries) {
          if (entry.type === 'directory') {
            const pluginJsonPath = this.fs.join(entry.path, 'plugin.json');
            
            try {
              const configContent = await this.fs.readFile(pluginJsonPath);
              const config = JSON.parse(configContent);
              const files = await this.scanDirectory(entry.path);
              
              plugins.push({
                id: config.id || entry.name,
                name: config.name || entry.name,
                path: entry.path,
                config,
                files,
              });
            } catch (e) {
              // No plugin.json
            }
          }
        }
      } catch (e) {
        // Directory doesn't exist
      }
    }

    return plugins;
  }

  private async scanDirectory(dirPath: string): Promise<Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    content?: string;
  }>> {
    const files: Array<{
      name: string;
      path: string;
      type: 'file' | 'directory';
      content?: string;
    }> = [];

    try {
      const entries = await this.fs.readDir(dirPath);
      
      for (const entry of entries) {
        if (entry.type === 'directory') {
          files.push({
            name: entry.name,
            path: entry.path,
            type: 'directory',
          });
          
          const subFiles = await this.scanDirectory(entry.path);
          files.push(...subFiles);
        } else {
          let content: string | undefined;
          try {
            if ((entry.size || 0) < 100000) {
              content = await this.fs.readFile(entry.path);
            }
          } catch (e) {}
          
          files.push({
            name: entry.name,
            path: entry.path,
            type: 'file',
            content,
          });
        }
      }
    } catch (e) {}

    return files;
  }
}

// Export singleton
export const realFileSystem = new RealFileSystem();
export const environmentScanner = new EnvironmentScanner(realFileSystem);

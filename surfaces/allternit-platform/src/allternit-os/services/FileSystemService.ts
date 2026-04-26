/**
 * allternit Super-Agent OS - FileSystem Service
 * 
 * Production-ready filesystem operations for the .allternit/drive virtual filesystem.
 * Supports both Electron main process (Node.js fs) and browser (HTTP API) modes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DriveEntry {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  createdAt: number;
  modifiedAt: number;
  mimeType?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  /** For folders */
  children?: DriveEntry[];
  /** Parent folder ID */
  parentId?: string;
}

export interface FileUpload {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  result?: DriveEntry;
}

export interface DriveSearchResult {
  entries: DriveEntry[];
  total: number;
  query: string;
}

export interface DriveStats {
  totalSpace: number;
  usedSpace: number;
  fileCount: number;
  folderCount: number;
}

export type FileSystemBackend = 'electron' | 'http' | 'memory';

export interface FileSystemConfig {
  backend: FileSystemBackend;
  /** Base path for the drive (e.g., ~/.allternit/drive) */
  basePath: string;
  /** HTTP endpoint for file operations (HTTP mode) */
  httpEndpoint?: string;
  /** Enable file watching for real-time updates */
  enableWatching: boolean;
  /** Debug logging */
  debug: boolean;
}

// ============================================================================
// Events
// ============================================================================

export type FileSystemEventType = 
  | 'entry.created'
  | 'entry.updated'
  | 'entry.deleted'
  | 'entry.moved'
  | 'upload.progress'
  | 'upload.complete'
  | 'upload.error';

export interface FileSystemEvent {
  type: FileSystemEventType;
  timestamp: number;
  path: string;
  entry?: DriveEntry;
  upload?: FileUpload;
  oldPath?: string;
}

export type FileSystemEventHandler = (event: FileSystemEvent) => void;

// ============================================================================
// FileSystem Service
// ============================================================================

export class FileSystemService {
  private config: FileSystemConfig;
  private eventHandlers: Set<FileSystemEventHandler> = new Set();
  private uploadQueue: Map<string, FileUpload> = new Map();
  private memoryStore: Map<string, DriveEntry> = new Map();
  private currentStats: DriveStats | null = null;

  constructor(config: Partial<FileSystemConfig> = {}) {
    this.config = {
      backend: config.backend ?? this.detectBackend(),
      basePath: config.basePath ?? this.getDefaultBasePath(),
      httpEndpoint: config.httpEndpoint ?? 'http://127.0.0.1:3021/drive',
      enableWatching: config.enableWatching ?? true,
      debug: config.debug ?? false,
    };

    this.log('Initialized with backend:', this.config.backend);
    this.initializeMemoryStore();
  }

  private detectBackend(): FileSystemBackend {
    if (typeof window !== 'undefined' && window.electron?.fs) {
      return 'electron';
    }
    return 'memory';
  }

  private getDefaultBasePath(): string {
    if (typeof process !== 'undefined' && process.env.HOME) {
      return `${process.env.HOME}/.allternit/drive`;
    }
    return '/.allternit/drive';
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[FileSystemService]', ...args);
    }
  }

  private emit(event: FileSystemEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('[FileSystemService] Event handler error:', err);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Event Management
  // -------------------------------------------------------------------------

  subscribe(handler: FileSystemEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // -------------------------------------------------------------------------
  // Path Utilities
  // -------------------------------------------------------------------------

  normalizePath(path: string): string {
    return path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  joinPath(...parts: string[]): string {
    return parts
      .map(p => p.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
  }

  getExtension(filename: string): string {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  getMimeType(filename: string): string {
    const ext = this.getExtension(filename);
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'pdf': 'application/pdf',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'json': 'application/json',
      'csv': 'text/csv',
      'html': 'text/html',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'py': 'text/x-python',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  async listEntries(folderPath: string = ''): Promise<DriveEntry[]> {
    const normalizedPath = this.normalizePath(folderPath);

    switch (this.config.backend) {
      case 'electron':
        return this.listEntriesElectron(normalizedPath);
      case 'http':
        return this.listEntriesHttp(normalizedPath);
      case 'memory':
      default:
        return this.listEntriesMemory(normalizedPath);
    }
  }

  async getEntry(path: string): Promise<DriveEntry | null> {
    const normalizedPath = this.normalizePath(path);

    switch (this.config.backend) {
      case 'electron':
        return this.getEntryElectron(normalizedPath);
      case 'http':
        return this.getEntryHttp(normalizedPath);
      case 'memory':
      default:
        return this.getEntryMemory(normalizedPath);
    }
  }

  async createFolder(name: string, parentPath: string = ''): Promise<DriveEntry> {
    const normalizedParent = this.normalizePath(parentPath);
    const folderPath = this.joinPath(normalizedParent, name);

    const entry: DriveEntry = {
      id: this.generateId(),
      name,
      path: folderPath,
      type: 'folder',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      parentId: normalizedParent || undefined,
      children: [],
    };

    switch (this.config.backend) {
      case 'electron':
        await this.createFolderElectron(folderPath);
        break;
      case 'http':
        await this.createFolderHttp(folderPath);
        break;
      case 'memory':
      default:
        this.memoryStore.set(folderPath, entry);
        break;
    }

    this.emit({
      type: 'entry.created',
      timestamp: Date.now(),
      path: folderPath,
      entry,
    });

    return entry;
  }

  async writeFile(
    path: string, 
    content: Blob | string | ArrayBuffer,
    metadata?: Record<string, unknown>
  ): Promise<DriveEntry> {
    const normalizedPath = this.normalizePath(path);
    const name = normalizedPath.split('/').pop() || 'unnamed';

    const entry: DriveEntry = {
      id: this.generateId(),
      name,
      path: normalizedPath,
      type: 'file',
      size: content instanceof Blob ? content.size : 
            typeof content === 'string' ? new Blob([content]).size : 
            content.byteLength,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      mimeType: this.getMimeType(name),
      metadata,
    };

    switch (this.config.backend) {
      case 'electron':
        await this.writeFileElectron(normalizedPath, content);
        break;
      case 'http':
        await this.writeFileHttp(normalizedPath, content);
        break;
      case 'memory':
      default:
        this.memoryStore.set(normalizedPath, entry);
        this.memoryStore.set(`__content__${normalizedPath}`, content as unknown as DriveEntry);
        break;
    }

    this.emit({
      type: 'entry.created',
      timestamp: Date.now(),
      path: normalizedPath,
      entry,
    });

    return entry;
  }

  async readFile(path: string): Promise<ArrayBuffer | null> {
    const normalizedPath = this.normalizePath(path);

    switch (this.config.backend) {
      case 'electron':
        return this.readFileElectron(normalizedPath);
      case 'http':
        return this.readFileHttp(normalizedPath);
      case 'memory':
      default:
        return this.readFileMemory(normalizedPath);
    }
  }

  async deleteEntry(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    switch (this.config.backend) {
      case 'electron':
        await this.deleteEntryElectron(normalizedPath);
        break;
      case 'http':
        await this.deleteEntryHttp(normalizedPath);
        break;
      case 'memory':
      default:
        this.memoryStore.delete(normalizedPath);
        this.memoryStore.delete(`__content__${normalizedPath}`);
        break;
    }

    this.emit({
      type: 'entry.deleted',
      timestamp: Date.now(),
      path: normalizedPath,
    });
  }

  async moveEntry(fromPath: string, toPath: string): Promise<DriveEntry> {
    const normalizedFrom = this.normalizePath(fromPath);
    const normalizedTo = this.normalizePath(toPath);

    switch (this.config.backend) {
      case 'electron':
        await this.moveEntryElectron(normalizedFrom, normalizedTo);
        break;
      case 'http':
        await this.moveEntryHttp(normalizedFrom, normalizedTo);
        break;
      case 'memory':
      default:
        const entry = this.memoryStore.get(normalizedFrom);
        if (entry) {
          entry.path = normalizedTo;
          entry.name = normalizedTo.split('/').pop() || entry.name;
          entry.modifiedAt = Date.now();
          this.memoryStore.set(normalizedTo, entry);
          this.memoryStore.delete(normalizedFrom);
        }
        break;
    }

    const entry = await this.getEntry(normalizedTo);

    this.emit({
      type: 'entry.moved',
      timestamp: Date.now(),
      path: normalizedTo,
      oldPath: normalizedFrom,
      entry: entry || undefined,
    });

    return entry!;
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async search(query: string, folderPath: string = ''): Promise<DriveSearchResult> {
    const normalizedPath = this.normalizePath(folderPath);

    switch (this.config.backend) {
      case 'electron':
        return this.searchElectron(query, normalizedPath);
      case 'http':
        return this.searchHttp(query, normalizedPath);
      case 'memory':
      default:
        return this.searchMemory(query, normalizedPath);
    }
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  async getStats(): Promise<DriveStats> {
    if (this.currentStats) {
      return this.currentStats;
    }

    switch (this.config.backend) {
      case 'electron':
        this.currentStats = await this.getStatsElectron();
        break;
      case 'http':
        this.currentStats = await this.getStatsHttp();
        break;
      case 'memory':
      default:
        this.currentStats = this.getStatsMemory();
        break;
    }

    return this.currentStats;
  }

  // -------------------------------------------------------------------------
  // Upload Management
  // -------------------------------------------------------------------------

  async uploadFile(
    file: File,
    folderPath: string = '',
    onProgress?: (upload: FileUpload) => void
  ): Promise<DriveEntry> {
    const uploadId = this.generateId();
    const normalizedFolder = this.normalizePath(folderPath);
    const filePath = this.joinPath(normalizedFolder, file.name);

    const upload: FileUpload = {
      id: uploadId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading',
    };

    this.uploadQueue.set(uploadId, upload);

    try {
      for (let progress = 0; progress <= 100; progress += 10) {
        upload.progress = progress;
        
        this.emit({
          type: 'upload.progress',
          timestamp: Date.now(),
          path: filePath,
          upload: { ...upload },
        });

        if (onProgress) {
          onProgress({ ...upload });
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const entry = await this.writeFile(filePath, file, {
        originalName: file.name,
        uploadId,
      });

      upload.status = 'complete';
      upload.result = entry;
      upload.progress = 100;

      this.emit({
        type: 'upload.complete',
        timestamp: Date.now(),
        path: filePath,
        upload: { ...upload },
      });

      if (onProgress) {
        onProgress({ ...upload });
      }

      return entry;
    } catch (error) {
      upload.status = 'error';
      upload.error = error instanceof Error ? error.message : String(error);

      this.emit({
        type: 'upload.error',
        timestamp: Date.now(),
        path: filePath,
        upload: { ...upload },
      });

      throw error;
    } finally {
      this.uploadQueue.delete(uploadId);
    }
  }

  getUpload(uploadId: string): FileUpload | undefined {
    return this.uploadQueue.get(uploadId);
  }

  // -------------------------------------------------------------------------
  // Memory Mode Implementation
  // -------------------------------------------------------------------------

  private initializeMemoryStore(): void {
    const defaultFolders = ['Documents', 'Images', 'Videos', 'Audio', 'Exports'];
    
    for (const folder of defaultFolders) {
      const entry: DriveEntry = {
        id: this.generateId(),
        name: folder,
        path: folder,
        type: 'folder',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        children: [],
      };
      this.memoryStore.set(folder, entry);
    }

  }

  private listEntriesMemory(folderPath: string): DriveEntry[] {
    const entries: DriveEntry[] = [];
    
    this.memoryStore.forEach((entry, path) => {
      if (path.startsWith('__content__')) return;
      
      const parentPath = path.split('/').slice(0, -1).join('/') || '';
      if (parentPath === folderPath) {
        entries.push(entry);
      }
    });

    return entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  private getEntryMemory(path: string): DriveEntry | null {
    return this.memoryStore.get(path) || null;
  }

  private readFileMemory(path: string): ArrayBuffer | null {
    const content = this.memoryStore.get(`__content__${path}`);
    if (!content) return null;
    
    if (typeof content === 'string') {
      return new TextEncoder().encode(content).buffer;
    }
    return null;
  }

  private searchMemory(query: string, folderPath: string): DriveSearchResult {
    const lowerQuery = query.toLowerCase();
    const entries: DriveEntry[] = [];

    this.memoryStore.forEach((entry, path) => {
      if (path.startsWith('__content__')) return;
      if (path.startsWith(folderPath) && entry.name.toLowerCase().includes(lowerQuery)) {
        entries.push(entry);
      }
    });

    return {
      entries,
      total: entries.length,
      query,
    };
  }

  private getStatsMemory(): DriveStats {
    let usedSpace = 0;
    let fileCount = 0;
    let folderCount = 0;

    this.memoryStore.forEach((entry, path) => {
      if (path.startsWith('__content__')) return;
      
      if (entry.type === 'file') {
        fileCount++;
        usedSpace += entry.size || 0;
      } else {
        folderCount++;
      }
    });

    return {
      totalSpace: 10 * 1024 * 1024 * 1024,
      usedSpace,
      fileCount,
      folderCount,
    };
  }

  // -------------------------------------------------------------------------
  // Electron Mode Stubs
  // -------------------------------------------------------------------------

  private async listEntriesElectron(folderPath: string): Promise<DriveEntry[]> {
    if (window.electron?.fs) {
      return window.electron.fs.listEntries(folderPath);
    }
    return this.listEntriesMemory(folderPath);
  }

  private async getEntryElectron(path: string): Promise<DriveEntry | null> {
    if (window.electron?.fs) {
      return window.electron.fs.getEntry(path);
    }
    return this.getEntryMemory(path);
  }

  private async createFolderElectron(path: string): Promise<DriveEntry> {
    if (window.electron?.fs) {
      return window.electron.fs.createFolder(path);
    }
    throw new Error('Electron fs not available');
  }

  private async writeFileElectron(
    path: string, 
    content: Blob | string | ArrayBuffer
  ): Promise<DriveEntry> {
    if (window.electron?.fs) {
      let data: Uint8Array;
      if (typeof content === 'string') {
        data = new TextEncoder().encode(content);
      } else if (content instanceof Blob) {
        const buffer = await content.arrayBuffer();
        data = new Uint8Array(buffer as ArrayBuffer);
      } else if (content instanceof ArrayBuffer) {
        data = new Uint8Array(content);
      } else {
        data = content as Uint8Array;
      }
      return window.electron.fs.writeFile(path, data);
    }
    throw new Error('Electron fs not available');
  }

  private async readFileElectron(path: string): Promise<ArrayBuffer | null> {
    if (window.electron?.fs) {
      const data = await window.electron.fs.readFile(path);
      return (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return this.readFileMemory(path);
  }

  private async deleteEntryElectron(path: string): Promise<void> {
    if (window.electron?.fs) {
      await window.electron.fs.deleteEntry(path);
    }
  }

  private async moveEntryElectron(fromPath: string, toPath: string): Promise<DriveEntry> {
    if (window.electron?.fs) {
      return window.electron.fs.moveEntry(fromPath, toPath);
    }
    throw new Error('Electron fs not available');
  }

  private async searchElectron(query: string, folderPath: string): Promise<DriveSearchResult> {
    // TODO: Implement search in Electron API
    return this.searchMemory(query, folderPath);
  }

  private async getStatsElectron(): Promise<DriveStats> {
    if (window.electron?.fs) {
      const stats = await window.electron.fs.getStats();
      return {
        ...stats,
        fileCount: 0,
        folderCount: 0,
      };
    }
    return this.getStatsMemory();
  }

  // -------------------------------------------------------------------------
  // HTTP Mode Stubs
  // -------------------------------------------------------------------------

  private async listEntriesHttp(folderPath: string): Promise<DriveEntry[]> {
    const response = await fetch(`${this.config.httpEndpoint}/list?path=${encodeURIComponent(folderPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  private async getEntryHttp(path: string): Promise<DriveEntry | null> {
    const response = await fetch(`${this.config.httpEndpoint}/entry?path=${encodeURIComponent(path)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  private async createFolderHttp(path: string): Promise<void> {
    const response = await fetch(`${this.config.httpEndpoint}/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private async writeFileHttp(
    path: string, 
    content: Blob | string | ArrayBuffer
  ): Promise<void> {
    const formData = new FormData();
    formData.append('path', path);
    
    if (content instanceof Blob) {
      formData.append('file', content);
    } else if (typeof content === 'string') {
      formData.append('file', new Blob([content]));
    } else {
      formData.append('file', new Blob([content]));
    }

    const response = await fetch(`${this.config.httpEndpoint}/file`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private async readFileHttp(path: string): Promise<ArrayBuffer | null> {
    const response = await fetch(`${this.config.httpEndpoint}/file?path=${encodeURIComponent(path)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  private async deleteEntryHttp(path: string): Promise<void> {
    const response = await fetch(`${this.config.httpEndpoint}/entry?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private async moveEntryHttp(fromPath: string, toPath: string): Promise<void> {
    const response = await fetch(`${this.config.httpEndpoint}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromPath, to: toPath }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  private async searchHttp(query: string, folderPath: string): Promise<DriveSearchResult> {
    const response = await fetch(
      `${this.config.httpEndpoint}/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(folderPath)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  private async getStatsHttp(): Promise<DriveStats> {
    const response = await fetch(`${this.config.httpEndpoint}/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseFileSystemOptions {
  backend?: FileSystemBackend;
  basePath?: string;
  enableWatching?: boolean;
  debug?: boolean;
}

export function useFileSystem(options: UseFileSystemOptions = {}) {
  const serviceRef = useRef(new FileSystemService({
    backend: options.backend,
    basePath: options.basePath,
    enableWatching: options.enableWatching,
    debug: options.debug,
  }));

  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (path: string = currentPath) => {
    setIsLoading(true);
    setError(null);
    try {
      const newEntries = await serviceRef.current.listEntries(path);
      setEntries(newEntries);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]);

  const navigate = useCallback(async (folderName: string) => {
    const newPath = serviceRef.current.joinPath(currentPath, folderName);
    await refresh(newPath);
  }, [currentPath, refresh]);

  const navigateUp = useCallback(async () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/');
    await refresh(newPath);
  }, [currentPath, refresh]);

  const createFolder = useCallback(async (name: string) => {
    await serviceRef.current.createFolder(name, currentPath);
    await refresh();
  }, [currentPath, refresh]);

  const uploadFile = useCallback(async (file: File) => {
    await serviceRef.current.uploadFile(file, currentPath);
    await refresh();
  }, [currentPath, refresh]);

  const deleteEntry = useCallback(async (name: string) => {
    const path = serviceRef.current.joinPath(currentPath, name);
    await serviceRef.current.deleteEntry(path);
    await refresh();
  }, [currentPath, refresh]);

  const search = useCallback(async (query: string) => {
    return serviceRef.current.search(query, currentPath);
  }, [currentPath]);

  useEffect(() => {
    const unsubscribe = serviceRef.current.subscribe((event) => {
      if (event.path.startsWith(currentPath)) {
        refresh();
      }
    });
    return unsubscribe;
  }, [currentPath, refresh]);

  useEffect(() => {
    refresh('');
  }, []);

  return {
    entries,
    currentPath,
    isLoading,
    error,
    refresh,
    navigate,
    navigateUp,
    createFolder,
    uploadFile,
    deleteEntry,
    search,
    service: serviceRef.current,
  };
}

export const fileSystemService = new FileSystemService();
export default FileSystemService;

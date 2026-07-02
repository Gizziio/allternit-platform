import React, { useCallback, useEffect, useRef, useState } from "react";
/**
 * allternit Super-Agent OS - File System Watcher
 * 
 * Watches the .allternit/drive folder for generated media and syncs to AssetManager.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type { AssetManagerState, AssetManagerItem } from '../types/programs';

// ============================================================================
// Types
// ============================================================================

type FileChangeType = 'created' | 'modified' | 'deleted';

interface FileChangeEvent {
  type: FileChangeType;
  path: string;
  name: string;
  size: number;
  timestamp: number;
  mimeType?: string;
}

interface WatcherOptions {
  /** Folder path to watch (relative or absolute) */
  folderPath: string;
  /** Poll interval in ms (fallback if native watcher unavailable) */
  pollInterval?: number;
  /** File extensions to watch */
  extensions?: string[];
  /** Callback on file change */
  onChange?: (event: FileChangeEvent) => void;
  /** Enable recursive watching */
  recursive?: boolean;
  /** Include file content in change events */
  includeContent?: boolean;
}

// ============================================================================
// File Type Detection
// ============================================================================

function getFileType(filename: string): AssetManagerItem['type'] {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv'];
  
  if (imageExts.includes(ext || '')) return 'image';
  if (videoExts.includes(ext || '')) return 'video';
  if (audioExts.includes(ext || '')) return 'audio';
  if (docExts.includes(ext || '')) return 'document';
  
  return 'folder';
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    json: 'application/json',
    csv: 'text/csv',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// ============================================================================
// File System Watcher
// ============================================================================

class FileSystemWatcher {
  private options: WatcherOptions;
  private intervalId: NodeJS.Timeout | null = null;
  private fileCache: Map<string, { size: number; mtime: number }> = new Map();
  private watching = false;

  constructor(options: WatcherOptions) {
    this.options = {
      pollInterval: 1000,
      extensions: [],
      recursive: true,
      ...options,
    };
  }

  /**
   * Start watching the folder
   */
  start(): void {
    if (this.watching) return;
    
    this.watching = true;
    this.performScan(); // Initial scan
    
    // Start polling
    this.intervalId = setInterval(() => {
      this.performScan();
    }, this.options.pollInterval);
    
    logger.debug(`Started watching: ${this.options.folderPath}`);
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.watching = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.debug(`Stopped watching: ${this.options.folderPath}`);
  }

  /**
   * Perform a scan of the folder
   */
  private performScan(): void {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      this.scanWithFileSystemAPI();
    } else {
      // Fallback: simulate with cached data
      this.scanWithFallback();
    }
  }

  private async scanWithFileSystemAPI(): Promise<void> {
    try {
      // Request directory access if not already granted
      const dirHandle = await (window as any).showDirectoryPicker();
      const newFiles = new Map<string, { size: number; mtime: number }>();
      
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          const path = `${this.options.folderPath}/${entry.name}`;
          
          newFiles.set(path, {
            size: file.size,
            mtime: file.lastModified,
          });
          
          // Check for changes
          this.checkForChanges(path, entry.name, file.size, file.lastModified);
        }
      }
      
      // Check for deletions
      this.fileCache.forEach((_, path) => {
        if (!newFiles.has(path)) {
          this.emitChange({
            type: 'deleted',
            path,
            name: path.split('/').pop() || '',
            size: 0,
            timestamp: Date.now(),
          });
        }
      });
      
      this.fileCache = newFiles;
      
    } catch (err) {
      logger.warn({ err: err }, 'File System API not available');
      this.scanWithFallback();
    }
  }

  private scanWithFallback(): void {
    // In Electron or Node environment, use fs module
    // For browser-only, we rely on kernel notifications
    logger.debug('Using fallback scan mode');
  }

  private checkForChanges(path: string, name: string, size: number, mtime: number): void {
    const cached = this.fileCache.get(path);
    
    if (!cached) {
      // New file
      this.emitChange({
        type: 'created',
        path,
        name,
        size,
        timestamp: mtime,
        mimeType: getMimeType(name),
      });
    } else if (cached.size !== size || cached.mtime !== mtime) {
      // Modified
      this.emitChange({
        type: 'modified',
        path,
        name,
        size,
        timestamp: mtime,
        mimeType: getMimeType(name),
      });
    }
  }

  private emitChange(event: FileChangeEvent): void {
    this.options.onChange?.(event);
  }

  /**
   * Manually trigger a file event (for kernel notifications)
   */
  notifyChange(event: FileChangeEvent): void {
    this.emitChange(event);
  }
}

// ============================================================================
// AssetManager Sync
// ============================================================================

class AssetManagerSync {
  private watcher: FileSystemWatcher;
  private programId: string | null = null;

  constructor(folderPath: string = '.allternit/drive') {
    this.watcher = new FileSystemWatcher({
      folderPath,
      onChange: this.handleFileChange.bind(this),
    });
  }

  /**
   * Start syncing to an AssetManager program
   */
  startSync(programId: string): void {
    this.programId = programId;
    this.watcher.start();
    
    // Set watch folder in state
    const store = useSidecarStore.getState();
    store.updateProgramState<AssetManagerState>(programId, (prev) => ({
      ...prev,
      watchFolder: this.watcher['options'].folderPath,
    }));
  }

  /**
   * Stop syncing
   */
  stopSync(): void {
    this.watcher.stop();
    this.programId = null;
  }

  /**
   * Manually add a file (e.g., from kernel notification)
   */
  addFile(fileInfo: {
    name: string;
    path: string;
    size: number;
    type?: AssetManagerItem['type'];
    thumbnailUrl?: string;
    tags?: string[];
  }): void {
    if (!this.programId) return;

    const store = useSidecarStore.getState();
    const now = Date.now();
    
    const newItem: AssetManagerItem = {
      id: `file_${now}_${Math.random().toString(36).substr(2, 9)}`,
      name: fileInfo.name,
      type: fileInfo.type || getFileType(fileInfo.name),
      path: fileInfo.path,
      size: fileInfo.size,
      createdAt: now,
      updatedAt: now,
      thumbnailUrl: fileInfo.thumbnailUrl,
      tags: fileInfo.tags || [],
    };

    store.updateProgramState<AssetManagerState>(this.programId, (prev) => ({
      ...prev,
      items: [newItem, ...prev.items],
    }));
  }

  private handleFileChange(event: FileChangeEvent): void {
    if (!this.programId) return;

    const store = useSidecarStore.getState();

    switch (event.type) {
      case 'created':
        this.addFile({
          name: event.name,
          path: event.path,
          size: event.size,
          type: getFileType(event.name),
        });
        break;

      case 'modified':
        store.updateProgramState<AssetManagerState>(this.programId!, (prev) => ({
          ...prev,
          items: prev.items.map(item => 
            item.path === event.path 
              ? { ...item, size: event.size, updatedAt: event.timestamp }
              : item
          ),
        }));
        break;

      case 'deleted':
        store.updateProgramState<AssetManagerState>(this.programId!, (prev) => ({
          ...prev,
          items: prev.items.filter(item => item.path !== event.path),
        }));
        break;
    }
  }
}

// ============================================================================
// React Hooks
// ============================================================================
import { createModuleLogger } from '@/lib/logger';
const logger = createModuleLogger('FileSystemWatcher');

function useFileSystemWatcher(options: WatcherOptions) {
  const watcherRef = useRef<FileSystemWatcher | null>(null);
  const [events, setEvents] = useState<FileChangeEvent[]>([]);

  useEffect(() => {
    watcherRef.current = new FileSystemWatcher({
      ...options,
      onChange: (event) => {
        setEvents(prev => [...prev.slice(-50), event]); // Keep last 50
        options.onChange?.(event);
      },
    });

    watcherRef.current.start();

    return () => {
      watcherRef.current?.stop();
    };
  }, [options.folderPath, options.onChange, options.recursive, options.includeContent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    clearEvents,
    watcher: watcherRef.current,
  };
}

function useAssetManagerSync(programId: string, folderPath: string = '.allternit/drive') {
  const syncRef = useRef<AssetManagerSync | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inline state adjustment for programId/folderPath change
  const [prevSyncParams, setPrevSyncParams] = useState({ programId, folderPath });
  if (programId !== prevSyncParams.programId || folderPath !== prevSyncParams.folderPath) {
    setPrevSyncParams({ programId, folderPath });
    setIsSyncing(false); // Reset while new sync starts
  }

  useEffect(() => {
    syncRef.current = new AssetManagerSync(folderPath);
    syncRef.current.startSync(programId);
    setIsSyncing(true);

    return () => {
      syncRef.current?.stopSync();
      setIsSyncing(false);
    };
  }, [programId, folderPath]);

  const addFile = useCallback((fileInfo: Parameters<AssetManagerSync['addFile']>[0]) => {
    syncRef.current?.addFile(fileInfo);
  }, []);

  return {
    isSyncing,
    addFile,
    sync: syncRef.current,
  };
}

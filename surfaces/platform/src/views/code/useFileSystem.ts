/**
 * File System Hook for Code Mode
 * 
 * Provides real file system operations for the ExplorerView.
 * Uses the filesApi for all operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { filesApi, type FileEntry } from '@/lib/agents/files-api';

export interface FileNode extends FileEntry {
  children?: FileNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  error?: string;
}

export interface UseFileSystemOptions {
  rootPath: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseFileSystemReturn {
  fileTree: FileNode[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  expandNode: (path: string) => Promise<void>;
  collapseNode: (path: string) => void;
  readFile: (path: string) => Promise<string>;
  createFile: (path: string, content?: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  renameEntry: (oldPath: string, newPath: string) => Promise<void>;
  searchFiles: (query: string) => Promise<FileEntry[]>;
}

// Recursively update a node in the tree
function updateNodeInTree(
  nodes: FileNode[],
  targetPath: string,
  update: (node: FileNode) => FileNode
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return update(node);
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeInTree(node.children, targetPath, update),
      };
    }
    return node;
  });
}

// Find a node in the tree
function findNodeInTree(nodes: FileNode[], targetPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }
    if (node.children) {
      const found = findNodeInTree(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

export function useFileSystem(options: UseFileSystemOptions): UseFileSystemReturn {
  const { rootPath, autoRefresh = true, refreshInterval = 5000 } = options;
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileCache = useRef<Map<string, string>>(new Map());

  // Load root directory
  const loadRoot = useCallback(async () => {
    if (!rootPath) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await filesApi.listDirectory({ 
        path: rootPath,
        includeDetails: true,
        recursive: false 
      });
      
      const nodes: FileNode[] = response.entries.map((entry) => ({
        ...entry,
        isExpanded: false,
        isLoading: false,
      }));
      
      setFileTree(nodes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load directory';
      setError(message);
      console.error('[useFileSystem] Load root failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [rootPath]);

  // Expand a directory node
  const expandNode = useCallback(async (path: string) => {
    const node = findNodeInTree(fileTree, path);
    if (!node || node.type !== 'directory' || node.children) {
      // Already loaded or not a directory
      if (node) {
        setFileTree((prev) =>
          updateNodeInTree(prev, path, (n) => ({ ...n, isExpanded: true }))
        );
      }
      return;
    }

    // Mark as loading
    setFileTree((prev) =>
      updateNodeInTree(prev, path, (n) => ({ ...n, isLoading: true, error: undefined }))
    );

    try {
      const response = await filesApi.listDirectory({
        path,
        includeDetails: true,
        recursive: false,
      });

      const children: FileNode[] = response.entries.map((entry) => ({
        ...entry,
        isExpanded: false,
        isLoading: false,
      }));

      setFileTree((prev) =>
        updateNodeInTree(prev, path, (n) => ({
          ...n,
          children,
          isExpanded: true,
          isLoading: false,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load directory';
      setFileTree((prev) =>
        updateNodeInTree(prev, path, (n) => ({
          ...n,
          isLoading: false,
          error: message,
          isExpanded: false,
        }))
      );
    }
  }, [fileTree]);

  // Collapse a directory node
  const collapseNode = useCallback((path: string) => {
    setFileTree((prev) =>
      updateNodeInTree(prev, path, (n) => ({ ...n, isExpanded: false }))
    );
  }, []);

  // Read file content (with caching)
  const readFile = useCallback(async (path: string): Promise<string> => {
    // Check cache first
    const cached = fileCache.current.get(path);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await filesApi.readFile({ path });
      fileCache.current.set(path, response.content);
      return response.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file';
      throw new Error(message);
    }
  }, []);

  // Create new file
  const createFile = useCallback(async (path: string, content: string = ''): Promise<void> => {
    try {
      await filesApi.writeFile({ path, content });
      // Refresh parent directory
      const parentPath = path.substring(0, path.lastIndexOf('/')) || rootPath;
      
      // If parent is expanded, refresh it
      const parent = findNodeInTree(fileTree, parentPath);
      if (parent?.isExpanded) {
        await expandNode(parentPath);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create file';
      throw new Error(message);
    }
  }, [fileTree, rootPath, expandNode]);

  // Create new directory
  const createDirectory = useCallback(async (path: string): Promise<void> => {
    try {
      // Note: filesApi doesn't have a createDirectory method directly
      // We'll create a placeholder file and then delete it, or use a different approach
      // For now, this is a stub that would need backend support
      console.warn('[useFileSystem] createDirectory not yet implemented');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create directory';
      throw new Error(message);
    }
  }, []);

  // Delete file or directory
  const deleteEntry = useCallback(async (path: string): Promise<void> => {
    try {
      // Note: filesApi needs a delete method
      console.warn('[useFileSystem] deleteEntry not yet implemented');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      throw new Error(message);
    }
  }, []);

  // Rename entry
  const renameEntry = useCallback(async (oldPath: string, newPath: string): Promise<void> => {
    try {
      // Note: filesApi needs a rename method
      console.warn('[useFileSystem] renameEntry not yet implemented');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      throw new Error(message);
    }
  }, []);

  // Search files
  const searchFiles = useCallback(async (query: string): Promise<FileEntry[]> => {
    try {
      const response = await filesApi.searchCode({
        query,
        type: 'file',
        maxResults: 50,
      });
      
      // Convert search results to FileEntry format
      const uniqueFiles = new Map<string, FileEntry>();
      response.results.forEach((result) => {
        if (!uniqueFiles.has(result.file)) {
          uniqueFiles.set(result.file, {
            name: result.file.split('/').pop() || result.file,
            path: result.file,
            type: 'file',
          });
        }
      });
      
      return Array.from(uniqueFiles.values());
    } catch (err) {
      console.error('[useFileSystem] Search failed:', err);
      return [];
    }
  }, []);

  // Refresh entire tree
  const refresh = useCallback(async () => {
    await loadRoot();
    
    // Re-expand any expanded nodes
    const expandedPaths: string[] = [];
    const collectExpanded = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.isExpanded && node.children) {
          expandedPaths.push(node.path);
          collectExpanded(node.children);
        }
      }
    };
    collectExpanded(fileTree);
    
    // Reload expanded directories
    for (const path of expandedPaths) {
      await expandNode(path);
    }
  }, [loadRoot, fileTree, expandNode]);

  // Initial load
  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    fileTree,
    isLoading,
    error,
    refresh,
    expandNode,
    collapseNode,
    readFile,
    createFile,
    createDirectory,
    deleteEntry,
    renameEntry,
    searchFiles,
  };
}

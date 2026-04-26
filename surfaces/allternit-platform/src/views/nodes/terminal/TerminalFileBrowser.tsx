"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  DownloadSimple,
  Trash,
  ArrowsClockwise,
  CaretUp,
  CaretRight,
  UploadSimple,
  X,
  DotsThreeVertical,
  HardDrive,
  House,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getRuntimeGatewayBaseUrl } from '@/lib/runtime-backend-client';

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  permissions?: number;
  mime_type?: string;
}

export interface FileTransfer {
  id: string;
  type: 'upload' | 'download';
  filename: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  error?: string;
  totalBytes: number;
  transferredBytes: number;
}

interface TerminalFileBrowserProps {
  sessionId: string;
  nodeId: string;
  initialPath?: string;
  className?: string;
  onFileSelect?: (file: FileEntry) => void;
}

export function TerminalFileBrowser({
  sessionId,
  nodeId,
  initialPath = '/',
  className = '',
  onFileSelect,
}: TerminalFileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FileEntry | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const gatewayBaseUrl = await getRuntimeGatewayBaseUrl();
      const response = await fetch(
        `${gatewayBaseUrl}/api/v1/terminal/${sessionId}/files/list?path=${encodeURIComponent(path)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load directory');
      }

      const data = await response.json();
      setEntries(data.entries || []);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    loadDirectory(currentPath);
  }, [loadDirectory]);

  // Navigate to a directory
  const navigateTo = useCallback((entry: FileEntry) => {
    if (entry.is_dir) {
      loadDirectory(entry.path);
    } else if (onFileSelect) {
      onFileSelect(entry);
    }
  }, [loadDirectory, onFileSelect]);

  // Navigate up
  const navigateUp = useCallback(() => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parent);
  }, [currentPath, loadDirectory]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Download file
  const downloadFile = useCallback(async (entry: FileEntry) => {
    const transferId = `${Date.now()}-${entry.name}`;
    
    // Add to transfers
    setTransfers(prev => [...prev, {
      id: transferId,
      type: 'download',
      filename: entry.name,
      progress: 0,
      status: 'transferring',
      totalBytes: entry.size,
      transferredBytes: 0,
    }]);

    try {
      const gatewayBaseUrl = await getRuntimeGatewayBaseUrl();
      const response = await fetch(
        `${gatewayBaseUrl}/api/v1/terminal/${sessionId}/files/download?path=${encodeURIComponent(entry.path)}`
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Mark as completed
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, progress: 100, status: 'completed', transferredBytes: entry.size }
          : t
      ));

      // Remove after delay
      setTimeout(() => {
        setTransfers(prev => prev.filter(t => t.id !== transferId));
      }, 3000);
    } catch (err) {
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, status: 'error', error: err instanceof Error ? err.message : 'Download failed' }
          : t
      ));
    }
  }, [sessionId]);

  // Upload file
  const uploadFile = useCallback(async (file: File, targetPath: string) => {
    const transferId = `${Date.now()}-${file.name}`;
    const fullPath = `${targetPath}/${file.name}`.replace(/\/+/g, '/');
    
    // Add to transfers
    setTransfers(prev => [...prev, {
      id: transferId,
      type: 'upload',
      filename: file.name,
      progress: 0,
      status: 'transferring',
      totalBytes: file.size,
      transferredBytes: 0,
    }]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const gatewayBaseUrl = await getRuntimeGatewayBaseUrl();

      const response = await fetch(
        `${gatewayBaseUrl}/api/v1/terminal/${sessionId}/files/upload?path=${encodeURIComponent(fullPath)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: uint8Array,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      // Mark as completed
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, progress: 100, status: 'completed', transferredBytes: file.size }
          : t
      ));

      // Refresh directory
      loadDirectory(currentPath);

      // Remove after delay
      setTimeout(() => {
        setTransfers(prev => prev.filter(t => t.id !== transferId));
      }, 3000);
    } catch (err) {
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
          : t
      ));
    }
  }, [sessionId, currentPath, loadDirectory]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        uploadFile(file, currentPath);
      });
    }
    // Reset input
    e.target.value = '';
  }, [currentPath, uploadFile]);

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget && !dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => {
        uploadFile(file, currentPath);
      });
    }
  }, [currentPath, uploadFile]);

  // Delete file/directory
  const deleteEntry = useCallback(async (entry: FileEntry) => {
    try {
      const gatewayBaseUrl = await getRuntimeGatewayBaseUrl();
      const response = await fetch(
        `${gatewayBaseUrl}/api/v1/terminal/${sessionId}/files?path=${encodeURIComponent(entry.path)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Delete failed');
      }

      // Refresh directory
      loadDirectory(currentPath);
      setShowDeleteConfirm(false);
      setEntryToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [sessionId, currentPath, loadDirectory]);

  // Confirm delete
  const confirmDelete = useCallback((entry: FileEntry) => {
    setEntryToDelete(entry);
    setShowDeleteConfirm(true);
  }, []);

  // Breadcrumb navigation
  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = [
    { name: 'root', path: '/' },
    ...pathParts.map((part, index) => ({
      name: part,
      path: '/' + pathParts.slice(0, index + 1).join('/'),
    })),
  ];

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Files</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadDirectory(currentPath)}
            disabled={isLoading}
          >
            <ArrowsClockwise className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadSimple size={16} />
          </Button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateUp}
          disabled={currentPath === '/'}
          className="h-6 px-1"
        >
          <CaretUp size={12} />
        </Button>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center">
            {index > 0 && <CaretRight className="h-3 w-3 mx-1 text-muted-foreground" />}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadDirectory(crumb.path)}
              className={cn(
                "h-6 px-2 text-xs",
                index === breadcrumbs.length - 1 && "font-medium"
              )}
            >
              {crumb.name === 'root' ? <House size={12} /> : crumb.name}
            </Button>
          </div>
        ))}
      </div>

      {/* File list */}
      <div
        ref={dropZoneRef}
        className={cn(
          "flex-1 overflow-auto",
          isDragging && "bg-primary/10 ring-2 ring-primary ring-inset"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDirectory(currentPath)}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ) : entries.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Folder className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Empty directory</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drag and drop files here to upload
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-right px-3 py-2 font-medium w-24">Size</th>
                <th className="text-left px-3 py-2 font-medium w-40 hidden sm:table-cell">Modified</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  className={cn(
                    "border-b hover:bg-muted/50 cursor-pointer",
                    selectedEntry?.path === entry.path && "bg-muted"
                  )}
                  onClick={() => {
                    setSelectedEntry(entry);
                    if (entry.is_dir) {
                      navigateTo(entry);
                    }
                  }}
                  onDoubleClick={() => navigateTo(entry)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {entry.is_dir ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate max-w-[200px]">{entry.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {entry.is_dir ? '--' : formatSize(entry.size)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {formatDate(entry.modified)}
                  </td>
                  <td className="px-1 py-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DotsThreeVertical size={12} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!entry.is_dir && (
                          <DropdownMenuItem onClick={() => downloadFile(entry)}>
                            <DownloadSimple className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => confirmDelete(entry)}
                          className="text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Transfer progress */}
      {transfers.length > 0 && (
        <div className="border-t bg-muted/30 p-2 space-y-2 max-h-32 overflow-auto">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="flex items-center gap-2 text-xs">
              {transfer.type === 'upload' ? (
                <UploadSimple className="h-3 w-3 text-muted-foreground" />
              ) : (
                <DownloadSimple className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{transfer.filename}</span>
              {transfer.status === 'transferring' && (
                <Progress value={transfer.progress} />
              )}
              {transfer.status === 'completed' && (
                <span className="text-green-500">Done</span>
              )}
              {transfer.status === 'error' && (
                <span className="text-destructive" title={transfer.error}>
                  Error
                </span>
              )}
              <button
                onClick={() => setTransfers(prev => prev.filter(t => t.id !== transfer.id))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{entryToDelete?.name}&quot;?
              {entryToDelete?.is_dir && ' This will delete the entire directory and its contents.'}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => entryToDelete && deleteEntry(entryToDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TerminalFileBrowser;

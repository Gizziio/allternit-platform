/**
 * Orca File Tree
 * 
 * File tree sidebar for navigating documents
 */

import React, { useState, useCallback } from 'react';
import { DocumentFile } from './types';
import { cn } from './cn';
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  DotsThree as MoreHorizontal,
  CaretRight as ChevronRight,
  CaretDown as ChevronDown,
  FileCode,
  MarkdownLogo,
} from '@phosphor-icons/react';

interface FileTreeProps {
  files: DocumentFile[];
  activeFileId?: string;
  onFileSelect: (file: DocumentFile) => void;
  onFileCreate: (name: string, parentId?: string) => void;
  onFolderCreate: (name: string, parentId?: string) => void;
  onFileRename: (fileId: string, newName: string) => void;
  onFileDelete: (fileId: string) => void;
  onToggleFolder: (folderId: string) => void;
}

interface FileTreeItemProps {
  file: DocumentFile;
  depth: number;
  activeFileId?: string;
  onSelect: (file: DocumentFile) => void;
  onToggle: (folderId: string) => void;
  onContextMenu: (e: React.MouseEvent, file: DocumentFile) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  file,
  depth,
  activeFileId,
  onSelect,
  onToggle,
  onContextMenu,
}) => {
  const isFolder = file.type === 'folder';
  const isActive = file.id === activeFileId;
  const Icon = isFolder 
    ? (file.isOpen ? FolderOpen : Folder)
    : file.name.endsWith('.md') 
      ? MarkdownLogo 
      : FileText;

  return (
    <div>
      <button
        onClick={() => isFolder ? onToggle(file.id) : onSelect(file)}
        onContextMenu={(e) => onContextMenu(e, file)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
          isActive 
            ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500' 
            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {isFolder && (
          <span className="text-zinc-600">
            {file.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        <Icon size={16} className={cn(
          isFolder && (file.isOpen ? 'text-yellow-500' : 'text-zinc-500')
        )} />
        <span className="truncate">{file.name}</span>
      </button>
      
      {isFolder && file.isOpen && file.children && (
        <div>
          {file.children.map(child => (
            <FileTreeItem
              key={child.id}
              file={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFileId,
  onFileSelect,
  onFileCreate,
  onFolderCreate,
  onFileRename,
  onFileDelete,
  onToggleFolder,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: DocumentFile } | null>(null);
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; parentId?: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const handleContextMenu = useCallback((e: React.MouseEvent, file: DocumentFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (!newItemName.trim()) {
      setIsCreating(null);
      return;
    }

    if (isCreating?.type === 'file') {
      onFileCreate(newItemName, isCreating!.parentId);
    } else {
      onFolderCreate(newItemName, isCreating!.parentId);
    }
    
    setNewItemName('');
    setIsCreating(null);
  }, [newItemName, isCreating, onFileCreate, onFolderCreate]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-300">Files</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreating({ type: 'file' })}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
            title="New File"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto py-2">
        {files.map(file => (
          <FileTreeItem
            key={file.id}
            file={file}
            depth={0}
            activeFileId={activeFileId}
            onSelect={onFileSelect}
            onToggle={onToggleFolder}
            onContextMenu={handleContextMenu}
          />
        ))}
        
        {files.length === 0 && (
          <div className="text-center py-8 text-zinc-600 text-sm">
            <p>No files yet</p>
            <button
              onClick={() => setIsCreating({ type: 'file' })}
              className="mt-2 text-blue-400 hover:underline"
            >
              Create your first file
            </button>
          </div>
        )}

        {/* New item input */}
        {isCreating && (
          <div className="px-3 py-1.5 flex items-center gap-2" style={{ paddingLeft: '12px' }}>
            {isCreating.type === 'folder' ? <Folder size={16} className="text-zinc-500" /> : <FileText size={16} className="text-zinc-500" />}
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onBlur={handleCreateSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit();
                if (e.key === 'Escape') setIsCreating(null);
              }}
              placeholder={isCreating.type === 'folder' ? 'Folder name' : 'File name'}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl min-w-[140px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                onFileSelect(contextMenu.file);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Open
            </button>
            {contextMenu.file.type === 'folder' && (
              <>
                <div className="my-1 border-t border-zinc-800" />
                <button
                  onClick={() => {
                    setIsCreating({ type: 'file', parentId: contextMenu.file.id });
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  New File
                </button>
                <button
                  onClick={() => {
                    setIsCreating({ type: 'folder', parentId: contextMenu.file.id });
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  New Folder
                </button>
              </>
            )}
            <div className="my-1 border-t border-zinc-800" />
            <button
              onClick={() => {
                const newName = prompt('Rename:', contextMenu.file.name);
                if (newName) onFileRename(contextMenu.file.id, newName);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Rename
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${contextMenu.file.name}"?`)) {
                  onFileDelete(contextMenu.file.id);
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-800"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FileTree;

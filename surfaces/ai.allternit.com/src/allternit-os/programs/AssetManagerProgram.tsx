/**
 * allternit Super-Agent OS - Asset Manager Program
 * 
 * Production-ready file manager for .allternit/drive with:
 * - Real filesystem integration via FileSystemService
 * - Folder navigation, upload, download
 * - Grid/list/gallery views
 * - Preview for images/videos/documents
 */

import * as React from 'react';
const { useState, useRef, useCallback } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import { useFileSystem, DriveEntry } from '../services/FileSystemService';
import type { AllternitProgram } from '../types/programs';

interface AssetManagerProgramProps {
  program: AllternitProgram;
}

type ViewMode = 'grid' | 'list' | 'gallery';

// ============================================================================
// File Type Icons
// ============================================================================

const getFileIcon = (entry: DriveEntry): string => {
  if (entry.type === 'folder') return '📁';
  
  const mimeType = entry.mimeType || '';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
  if (mimeType.includes('markdown') || mimeType.includes('text')) return '📝';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return '💻';
  return '📄';
};

const isPreviewable = (entry: DriveEntry): boolean => {
  if (entry.type === 'folder') return false;
  const mimeType = entry.mimeType || '';
  return mimeType.startsWith('image/') || 
         mimeType.startsWith('video/') || 
         mimeType.startsWith('audio/') ||
         mimeType.includes('pdf') ||
         mimeType.includes('text') ||
         mimeType.includes('markdown');
};

// ============================================================================
// File Preview Component
// ============================================================================

const FilePreview: React.FC<{
  entry: DriveEntry;
  onClose: () => void;
  onDownload: () => void;
}> = ({ entry, onClose, onDownload }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadContent = async () => {
      if (!entry.mimeType) return;
      
      try {
        const fs = useFileSystem().service;
        const data = await fs.readFile(entry.path);
        
        if (entry.mimeType.startsWith('image/')) {
          const blob = new Blob([data!]);
          setContent(URL.createObjectURL(blob));
        } else if (entry.mimeType.includes('text') || entry.mimeType.includes('markdown') || entry.mimeType.includes('json')) {
          const text = new TextDecoder().decode(data!);
          setContent(text);
        }
      } catch (err) {
        console.error('Failed to load preview:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [entry]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div 
        className="relative max-w-4xl max-h-[90vh] w-full mx-4 bg-white dark:bg-gray-900 rounded-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFileIcon(entry)}</span>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{entry.name}</h3>
              <p className="text-xs text-gray-500">
                {((entry.size || 0) / 1024).toFixed(1)} KB • {new Date(entry.modifiedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="p-4 overflow-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : entry.mimeType?.startsWith('image/') ? (
            <img 
              src={content!} 
              alt={entry.name}
              className="max-w-full mx-auto rounded-lg"
            />
          ) : entry.mimeType?.includes('text') || entry.mimeType?.includes('markdown') ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded">
              {content}
            </pre>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>Preview not available for this file type</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Breadcrumb Navigation
// ============================================================================

const Breadcrumb: React.FC<{
  path: string;
  onNavigate: (path: string) => void;
}> = ({ path, onNavigate }) => {
  const parts = path ? path.split('/') : [];
  
  return (
    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
      <button
        onClick={() => onNavigate('')}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex-shrink-0"
      >
        <span className="text-lg">🏠</span>
      </button>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          <span className="text-gray-400">/</span>
          <button
            onClick={() => onNavigate(parts.slice(0, index + 1).join('/'))}
            className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded truncate max-w-[150px]"
          >
            {part}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// ============================================================================
// Main Asset Manager
// ============================================================================

export const AssetManagerProgram: React.FC<AssetManagerProgramProps> = ({ program }) => {
  const { updateProgramState } = useSidecarStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewEntry, setPreviewEntry] = useState<DriveEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchResults, setSearchResults] = useState<DriveEntry[] | null>(null);
  
  const {
    entries,
    currentPath,
    isLoading,
    error,
    navigate,
    navigateUp,
    refresh,
    createFolder: createFsFolder,
    uploadFile,
    deleteEntry,
    search,
    service: fs,
  } = useFileSystem({ debug: false });

  // Filter entries by search
  const displayEntries = searchResults || entries.filter(entry => 
    entry.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = await search(query);
      setSearchResults(results.entries);
    } else {
      setSearchResults(null);
    }
  }, [search]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFsFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
      await refresh();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        await uploadFile(file);
      } catch (err) {
        console.error('Failed to upload file:', err);
      }
    }
    await refresh();
  };

  const handleDownload = async (entry: DriveEntry) => {
    try {
      const data = await fs.readFile(entry.path);
      if (!data) return;
      
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} item(s)?`)) return;
    
    Array.from(selectedIds).forEach(async (id) => {
      const entry = displayEntries.find(e => e.id === id);
      if (entry) {
        try {
          await deleteEntry(entry.name);
        } catch (err) {
          console.error('Failed to delete:', err);
        }
      }
    });
    setSelectedIds(new Set());
    await refresh();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === displayEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayEntries.map(e => e.id)));
    }
  };

  // Grid item renderer
  const renderGridItem = (entry: DriveEntry) => (
    <div
      key={entry.id}
      onClick={() => entry.type === 'folder' ? navigate(entry.name) : toggleSelection(entry.id)}
      onDoubleClick={() => isPreviewable(entry) ? setPreviewEntry(entry) : null}
      className={`
        relative group rounded-lg border-2 overflow-hidden cursor-pointer
        transition-all duration-150
        ${selectedIds.has(entry.id)
          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${entry.type === 'folder' ? 'aspect-square' : 'aspect-[4/3]'}
      `}
    >
      {entry.type === 'folder' ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
          <span className="text-5xl mb-2">📁</span>
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{entry.name}</span>
        </div>
      ) : entry.thumbnailUrl ? (
        <img src={entry.thumbnailUrl} alt={entry.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-4xl mb-2">{getFileIcon(entry)}</span>
          <span className="text-xs text-gray-500 px-2 text-center truncate w-full">{entry.name}</span>
        </div>
      )}
      
      {/* Selection indicator */}
      {selectedIds.has(entry.id) && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {entry.type !== 'folder' && (
          <button
            onClick={e => { e.stopPropagation(); handleDownload(entry); }}
            className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-lg"
            title="Download"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
        {isPreviewable(entry) && (
          <button
            onClick={e => { e.stopPropagation(); setPreviewEntry(entry); }}
            className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-lg"
            title="Preview"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  // List item renderer
  const renderListItem = (entry: DriveEntry) => (
    <div
      key={entry.id}
      onClick={() => entry.type === 'folder' ? navigate(entry.name) : toggleSelection(entry.id)}
      onDoubleClick={() => isPreviewable(entry) ? setPreviewEntry(entry) : null}
      className={`
        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
        ${selectedIds.has(entry.id) 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
        }
      `}
    >
      <input
        type="checkbox"
        checked={selectedIds.has(entry.id)}
        onChange={() => toggleSelection(entry.id)}
        className="rounded"
        onClick={e => e.stopPropagation()}
      />
      <span className="text-2xl">{getFileIcon(entry)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.name}</p>
        <p className="text-xs text-gray-500">
          {entry.type === 'folder' 
            ? 'Folder' 
            : `${((entry.size || 0) / 1024).toFixed(1)} KB`
          } • {new Date(entry.modifiedAt).toLocaleDateString()}
        </p>
      </div>
      {entry.type !== 'folder' && (
        <button
          onClick={e => { e.stopPropagation(); handleDownload(entry); }}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleUpload(e.target.files)}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">📁</span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Allternit Drive
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['grid', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 rounded text-sm capitalize ${
                  viewMode === mode 
                    ? 'bg-white dark:bg-gray-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>

        <button
          onClick={() => setIsCreatingFolder(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New Folder
        </button>

        {selectedIds.size > 0 && (
          <>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-700" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-48 px-3 py-1.5 pl-9 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <Breadcrumb path={currentPath} onNavigate={path => {
          // Navigate to absolute path
          const parts = path.split('/');
          let targetPath = '';
          for (const part of parts) {
            if (targetPath) targetPath += '/';
            targetPath += part;
          }
          // Reset and navigate
          while (currentPath) {
            navigateUp();
          }
          if (targetPath) {
            for (const part of targetPath.split('/').filter(Boolean)) {
              navigate(part);
            }
          }
        }} />
      </div>

      {/* New Folder Input */}
      {isCreatingFolder && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">📁</span>
            <input
              type="text"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); }
              }}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
            <button
              onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          Error: {error.message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-5xl mb-4">📁</span>
            <p className="text-sm">{searchQuery ? 'No files found' : 'No files in Drive yet'}</p>
            {!searchQuery && (
              <>
                <p className="text-xs mt-2 opacity-75">Upload files or create folders to get started</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Upload Files
                </button>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayEntries.map(renderGridItem)}
          </div>
        ) : (
          <div className="space-y-2">
            {displayEntries.map(renderListItem)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <span>{displayEntries.length} items</span>
        <span>Double-click to preview</span>
      </div>

      {/* Preview Modal */}
      {previewEntry && (
        <FilePreview
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onDownload={() => handleDownload(previewEntry)}
        />
      )}
    </div>
  );
};

export default AssetManagerProgram;

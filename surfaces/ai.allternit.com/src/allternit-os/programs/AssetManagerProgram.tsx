import { cn } from "@/lib/utils";
import React, { useCallback, useRef, useState } from "react";

"use client";
import { useSidecarStore } from '../stores/useSidecarStore';
import { useFileSystem, DriveEntry } from '../services/FileSystemService';
import type { AllternitProgram } from '../types/programs';
import { ConfirmModal } from '@/components/ConfirmModal';

// Modular components and utils
import { ProgramErrorBoundary } from '../components/ProgramErrorBoundary';
import { FilePreview } from './asset-manager/FilePreview';
import { Breadcrumb } from './asset-manager/Breadcrumb';
import { AssetItem } from './asset-manager/AssetItem';
import { isPreviewable } from './asset-manager/assetUtils';

import { createModuleLogger } from '@/lib/logger';
const logger = createModuleLogger('AssetManagerProgram');

interface AssetManagerProgramProps {
  program: AllternitProgram;
}

type ViewMode = 'grid' | 'list';

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
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

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
      logger.error({ err: err }, 'Failed to create folder:');
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        await uploadFile(file);
      } catch (err) {
        logger.error({ err: err }, 'Failed to upload file:');
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
      logger.error({ err: err }, 'Failed to download file:');
    }
  };

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    setConfirmDialog({
      message: `Delete ${count} item(s)?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await Promise.all(Array.from(selectedIds).map(async (id) => {
          const entry = displayEntries.find(e => e.id === id);
          if (entry) {
            try { await deleteEntry(entry.name); } catch (err) { logger.error({ err: err }, 'Failed to delete:'); }
          }
        }));
        setSelectedIds(new Set());
        await refresh();
      },
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 relative">
      {/* Hidden file input */}
      <input ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleUpload(e.target.files)}
        aria-label="Upload files"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-xl">📁</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Allternit Drive
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 shadow-inner border border-zinc-200 dark:border-zinc-700">
            {(['grid', 'list'] as const).map(mode => (
              <button type="button"
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                  viewMode === mode 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex-wrap">
        <button type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>

        <button type="button"
          onClick={() => setIsCreatingFolder(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New Folder
        </button>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />
            <span className="text-xs font-medium text-zinc-500">
              {selectedIds.size} selected
            </span>
            <button type="button"
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Drive…"
            aria-label="Search Drive"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-48 px-3 py-1.5 pl-9 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
          <svg className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <Breadcrumb path={currentPath} onNavigate={path => {
          // Navigate to absolute path
          const parts = path.split('/').filter(Boolean);
          // Simple way to navigate to absolute path by resetting and going down
          // In a real FS we might have a goToPath method
          window.location.reload(); // Fallback if logic is complex
        }} />
      </div>

      {/* New Folder Input */}
      {isCreatingFolder && (
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-900/10 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <span className="text-xl">📁</span>
            <input
              type="text"
              placeholder="Folder name…"
              aria-label="New folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); }
              }}
              className="flex-1 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:ring-1 focus:ring-blue-500 outline-none"
              autoFocus
            />
            <button type="button"
              onClick={handleCreateFolder}
              className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Create
            </button>
            <button type="button"
              onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
              className="px-4 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-zinc-50/30 dark:bg-zinc-950/20">
        <ProgramErrorBoundary programName="Asset Manager">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
              <div className="size-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-xs font-medium animate-pulse">Syncing with Drive…</span>
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center animate-in fade-in duration-500">
              <div className="size-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 opacity-50">
                <span className="text-6xl">📁</span>
              </div>
              <p className="text-base font-semibold text-zinc-700 dark:text-zinc-200">{searchQuery ? 'No files found' : 'Empty Drive'}</p>
              <p className="text-sm mt-1 opacity-70 max-w-xs">{searchQuery ? `No results for "${searchQuery}" in this folder.` : 'Upload assets or create folders to organize your agent data.'}</p>
              {!searchQuery && (
                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:scale-105 active:scale-95"
                >
                  Add Files
                </button>
              )}
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" 
                : "flex flex-col gap-2 max-w-4xl mx-auto"
            )}>
              {displayEntries.map((entry) => (
                <AssetItem
                  key={entry.id}
                  entry={entry}
                  viewMode={viewMode}
                  isSelected={selectedIds.has(entry.id)}
                  onToggle={toggleSelection}
                  onNavigate={navigate}
                  onPreview={setPreviewEntry}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </ProgramErrorBoundary>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <div className="flex items-center gap-4">
          <span>{displayEntries.length} items</span>
          {selectedIds.size > 0 && <span className="text-blue-500">{selectedIds.size} selected</span>}
        </div>
        <span className="opacity-60">Double-click to preview</span>
      </div>

      {/* Preview Modal */}
      {previewEntry && (
        <FilePreview
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onDownload={() => handleDownload(previewEntry)}
        />
      )}

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title="Delete"
        message={confirmDialog?.message || ''}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default AssetManagerProgram;

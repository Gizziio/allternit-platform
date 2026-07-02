"use client";

import React from 'react';
import { DriveEntry } from '../../services/FileSystemService';
import { getFileIcon, isPreviewable } from './assetUtils';

interface AssetItemProps {
  entry: DriveEntry;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onToggle: (id: string) => void;
  onNavigate: (name: string) => void;
  onPreview: (entry: DriveEntry) => void;
  onDownload: (entry: DriveEntry) => void;
}

export const AssetItem: React.FC<AssetItemProps> = ({ 
  entry, 
  viewMode, 
  isSelected, 
  onToggle, 
  onNavigate, 
  onPreview, 
  onDownload 
}) => {
  const isFolder = entry.type === 'folder';

  if (viewMode === 'grid') {
    return (
      <div role="button" tabIndex={0}
        onClick={() => isFolder ? onNavigate(entry.name) : onToggle(entry.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { isFolder ? onNavigate(entry.name) : onToggle(entry.id); } }}
        onDoubleClick={() => isPreviewable(entry) ? onPreview(entry) : null}
        className={`
          relative group rounded-xl border-2 overflow-hidden cursor-pointer
          transition-all duration-200
          ${isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10' 
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
          }
          ${isFolder ? 'aspect-square' : 'aspect-[4/3]'}
        `}
      >
        {isFolder ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10">
            <span className="text-5xl mb-2 filter drop-shadow-sm">📁</span>
            <span className="text-sm text-zinc-700 dark:text-zinc-300 font-semibold px-2 text-center truncate w-full">{entry.name}</span>
          </div>
        ) : entry.thumbnailUrl ? (
          <img src={entry.thumbnailUrl} alt={entry.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <span className="text-4xl mb-2 opacity-80">{getFileIcon(entry)}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 px-3 text-center truncate w-full font-medium">{entry.name}</span>
          </div>
        )}
        
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 size-6  bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-zinc-900 z-10">
            <svg className="size-3.5  text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
          {!isFolder && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onDownload(entry); }}
              className="size-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl"
              title="Download"
              aria-label={`Download ${entry.name}`}
            >
              <svg className="size-5 text-zinc-700 dark:text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
          {isPreviewable(entry) && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onPreview(entry); }}
              className="size-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl"
              title="Preview"
              aria-label={`Preview ${entry.name}`}
            >
              <svg className="size-5 text-zinc-700 dark:text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div role="button" tabIndex={0}
      onClick={() => isFolder ? onNavigate(entry.name) : onToggle(entry.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { isFolder ? onNavigate(entry.name) : onToggle(entry.id); } }}
      onDoubleClick={() => isPreviewable(entry) ? onPreview(entry) : null}
      className={`
        flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all duration-150
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
          : 'border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 bg-white dark:bg-zinc-900'
        }
      `}
    >
      <div className="flex items-center shrink-0">
        <input type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(entry.id)}
          aria-label={`Select ${entry.name}`}
          className="size-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
          onClick={e => e.stopPropagation()}
        />
      </div>
      <span className="text-3xl shrink-0 filter drop-shadow-sm">{getFileIcon(entry)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{entry.name}</p>
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
          {isFolder 
            ? 'Folder' 
            : `${((entry.size || 0) / 1024).toFixed(1)} KB`
          } • {new Date(entry.modifiedAt).toLocaleDateString()}
        </p>
      </div>
      {!isFolder && (
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={e => { e.stopPropagation(); onDownload(entry); }}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Download"
            aria-label={`Download ${entry.name}`}
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {isPreviewable(entry) && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onPreview(entry); }}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors"
              title="Preview"
              aria-label={`Preview ${entry.name}`}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

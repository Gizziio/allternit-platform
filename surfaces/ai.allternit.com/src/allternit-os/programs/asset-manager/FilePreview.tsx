"use client";

import React, { useState, useEffect } from 'react';
import { useFileSystem, DriveEntry } from '../../services/FileSystemService';
import { getFileIcon } from './assetUtils';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('FilePreview');

interface FilePreviewProps {
  entry: DriveEntry;
  onClose: () => void;
  onDownload: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ entry, onClose, onDownload }) => {
  const fsService = useFileSystem().service;
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      if (!entry.mimeType) return;
      
      try {
        const data = await fsService.readFile(entry.path);
        
        if (entry.mimeType.startsWith('image/')) {
          const blob = new Blob([data!]);
          setContent(URL.createObjectURL(blob));
        } else if (entry.mimeType.includes('text') || entry.mimeType.includes('markdown') || entry.mimeType.includes('json')) {
          const text = new TextDecoder().decode(data!);
          setContent(text);
        }
      } catch (err) {
        logger.error({ err: err }, 'Failed to load preview:');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [entry, fsService]);

  return (
    <div role="button" tabIndex={0} 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" 
      onClick={onClose} 
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div role="button" tabIndex={0} 
        className="relative max-w-4xl max-h-[90vh] w-full mx-4 bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFileIcon(entry)}</span>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white truncate max-w-md">{entry.name}</h3>
              <p className="text-xs text-zinc-500">
                {((entry.size || 0) / 1024).toFixed(1)} KB • {new Date(entry.modifiedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={onDownload}
              className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Download
            </button>
            <button type="button"
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="p-4 overflow-auto max-h-[70vh] bg-zinc-50 dark:bg-zinc-950">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="size-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : entry.mimeType?.startsWith('image/') ? (
            <img 
              src={content!} 
              alt={entry.name}
              className="max-w-full mx-auto rounded-lg shadow-sm"
            />
          ) : entry.mimeType?.includes('text') || entry.mimeType?.includes('markdown') || entry.mimeType?.includes('json') ? (
            <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
              {content}
            </pre>
          ) : (
            <div className="text-center text-zinc-500 py-24 flex flex-col items-center">
              <div className="size-20 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                 <span className="text-4xl opacity-50">{getFileIcon(entry)}</span>
              </div>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">No Preview Available</p>
              <p className="text-sm opacity-60 mt-1">This file type ({entry.mimeType || 'unknown'}) cannot be previewed directly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

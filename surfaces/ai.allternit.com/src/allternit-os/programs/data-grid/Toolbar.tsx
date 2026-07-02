"use client";

import React from 'react';

interface ToolbarProps {
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteSelected: () => void;
  onExport: (format: 'csv' | 'json') => void;
  onImport: () => void;
  onToggleViz: () => void;
  onSaveToDrive: () => void;
  hasViz: boolean;
  selectedCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddRow, 
  onAddColumn, 
  onDeleteSelected, 
  onExport, 
  onImport,
  onToggleViz,
  onSaveToDrive,
  hasViz,
  selectedCount 
}) => {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex-wrap">
      <button type="button"
        onClick={onAddRow}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Row
      </button>
      
      <button type="button"
        onClick={onAddColumn}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Column
      </button>

      {selectedCount > 0 && (
        <button type="button"
          onClick={onDeleteSelected}
          className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 bg-white dark:bg-zinc-800 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete ({selectedCount})
        </button>
      )}

      <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

      <button type="button"
        onClick={onImport}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import CSV
      </button>

      <select aria-label="Selection" onChange={(e) => e.target.value && onExport(e.target.value as 'csv' | 'json')}
        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        defaultValue=""
      >
        <option value="" disabled>Export…</option>
        <option value="csv">Export CSV</option>
        <option value="json">Export JSON</option>
      </select>

      <button type="button"
        onClick={onSaveToDrive}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Save to Drive
      </button>

      <div className="flex-1" />

      <button type="button"
        onClick={onToggleViz}
        disabled={!hasViz}
        className={`
          flex items-center gap-1 px-2 py-1 text-sm rounded transition-all
          ${hasViz 
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 shadow-sm' 
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-50'
          }
        `}
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Visualize
      </button>
    </div>
  );
};

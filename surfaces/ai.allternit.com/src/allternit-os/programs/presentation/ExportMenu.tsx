"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { PresentationState } from '../../types/programs';
import { exportToPPTX } from './exportUtils';

interface ExportMenuProps {
  state: PresentationState;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePPTXExport = async () => {
    await exportToPPTX(state);
    setIsOpen(false);
  };

  const handleJSONExport = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.title || 'presentation').replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title="Export"
      >
        💾
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 z-50">
          <button type="button"
            onClick={handlePPTXExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 first:rounded-t-lg flex items-center gap-2"
          >
            <span>📊</span> Export to PPTX
          </button>
          <button type="button"
            onClick={handleJSONExport}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 last:rounded-b-lg flex items-center gap-2"
          >
            <span>📋</span> Export JSON
          </button>
        </div>
      )}
    </div>
  );
};

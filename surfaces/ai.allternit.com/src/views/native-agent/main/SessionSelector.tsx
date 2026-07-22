"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash, 
  CaretDown, 
  Chat, 
  Check,
  Robot
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { formatSessionTimestamp } from './NativeAgentView.utils';
import type { ChatSession as NativeSession } from '@/views/chat/ChatSessionStore';

interface SessionSelectorProps {
  sessions: NativeSession[];
  activeSession: NativeSession | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function sessionWorkDir(session: NativeSession | null): string | null {
  if (!session) return null;
  for (const key of ['workDir', 'cwd', 'directory', 'projectPath'] as const) {
    const value = session.metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.replace(/^\/Users\/[^/]+/, '~');
  }
  return null;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  activeSession,
  onSelect,
  onNew,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeWorkDir = sessionWorkDir(activeSession);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-solid border-zinc-200 dark:border-zinc-700 cursor-pointer transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
      >
        <div className="size-5 rounded bg-blue-500/10 flex items-center justify-center">
          <Chat size={14} className="text-blue-500" weight="fill" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
            {activeSession?.name || 'Select Session'}
          </div>
          <div className="text-[10px] text-zinc-500 truncate">
            {activeSession ? formatSessionTimestamp(activeSession.updatedAt) : 'No session active'}
          </div>
          {activeWorkDir && (
            <div className="text-[10px] text-zinc-500 truncate [direction:rtl] text-left" title={activeWorkDir}>
              {activeWorkDir}
            </div>
          )}
        </div>
        <CaretDown size={14} className={cn("text-zinc-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-solid border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
              <button type="button"
                onClick={() => { onNew(); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors"
              >
                <Plus size={14} weight="bold" />
                New Session
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto p-1">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-zinc-400 text-xs italic">
                  No sessions found
                </div>
              ) : (
                sessions.map((session) => {
                  const workDir = sessionWorkDir(session);
                  return (
                  <div 
                    key={session.id}
                    className={cn(
                      "group flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer",
                      activeSession?.id === session.id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                    onClick={() => { onSelect(session.id); setIsOpen(false); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate dark:text-zinc-200">
                        {session.name}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {formatSessionTimestamp(session.updatedAt)}
                      </div>
                      {workDir && (
                        <div className="text-[10px] text-zinc-500 truncate [direction:rtl] text-left" title={workDir}>
                          {workDir}
                        </div>
                      )}
                    </div>
                    {activeSession?.id === session.id ? (
                      <Check size={14} weight="bold" className="text-blue-500 shrink-0" />
                    ) : (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                        className="p-1 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

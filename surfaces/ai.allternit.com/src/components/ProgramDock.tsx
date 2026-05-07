/**
 * ProgramDock - Functional Program Launcher
 * 
 * Launches real Allternit programs via the sidecar store.
 * Integrated into ChatView below the chat input.
 */

import React, { useCallback, useEffect } from 'react';
import {
  FileText,
  Table,
  Presentation,
  Code,
  FolderOpen,
  Cpu,
  Graph,
  Globe,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';

// Use the shell store which is already available
import { useChatStore } from '@/views/chat/ChatStore';

const PROGRAMS = [
  { id: 'research-doc', name: 'Research', icon: FileText, color: 'var(--status-info)', shortcut: 'R' },
  { id: 'data-grid', name: 'Data', icon: Table, color: 'var(--status-success)', shortcut: 'D' },
  { id: 'presentation', name: 'Slides', icon: Presentation, color: 'var(--status-warning)', shortcut: 'P' },
  { id: 'code-preview', name: 'Code', icon: Code, color: '#8b5cf6', shortcut: 'C' },
  { id: 'asset-manager', name: 'Assets', icon: FolderOpen, color: '#ec4899', shortcut: 'A' },
  { id: 'orchestrator', name: 'Agents', icon: Cpu, color: 'var(--status-error)', shortcut: 'O' },
  { id: 'workflow-builder', name: 'Flow', icon: Graph, color: 'var(--status-info)', shortcut: 'F' },
  { id: 'browser', name: 'Web', icon: Globe, color: '#6366f1', shortcut: 'W' },
] as const;

interface ProgramDockProps {
  onLaunchProgram?: (programId: string) => void;
  activePrograms?: string[];
  threadId?: string;
}

export const ProgramDock: React.FC<ProgramDockProps> = ({
  onLaunchProgram,
  activePrograms = [],
  threadId,
}) => {
  const chatStore = useChatStore();

  const handleLaunch = useCallback((programId: string) => {
    const program = PROGRAMS.find(p => p.id === programId);
    if (!program) return;

    // Call the external handler if provided
    if (onLaunchProgram) {
      onLaunchProgram(programId);
      return;
    }

    // Default behavior: open a new chat with program context
    const programNames: Record<string, string> = {
      'research-doc': 'Research Document',
      'data-grid': 'Data Grid',
      'presentation': 'Presentation',
      'code-preview': 'Code Preview',
      'asset-manager': 'Asset Manager',
      'orchestrator': 'Orchestrator',
      'workflow-builder': 'Workflow Builder',
      'browser': 'Browser',
    };

    // Create a new thread for this program
    chatStore.createThread(
      `${programNames[programId]} Session`,
      undefined,
      'llm'
    );

    console.log(`[ProgramDock] Launched ${programId} in thread ${threadId}`);
  }, [onLaunchProgram, chatStore, threadId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        const program = PROGRAMS.find(p => 
          p.shortcut.toLowerCase() === e.key.toLowerCase()
        );
        if (program) {
          e.preventDefault();
          handleLaunch(program.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLaunch]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-1 px-2 py-2"
    >
      {PROGRAMS.map((program) => {
        const Icon = program.icon;
        const isActive = activePrograms.includes(program.id);

        return (
          <button
            key={program.id}
            onClick={() => handleLaunch(program.id)}
            className={`
              group relative flex items-center justify-center
              w-9 h-9 rounded-lg transition-all duration-200
              hover:scale-110 active:scale-95
              ${isActive 
                ? 'bg-white/20 ring-1 ring-white/40' 
                : 'hover:bg-white/10'
              }
            `}
            title={`${program.name} (⌘⇧${program.shortcut})`}
          >
            <Icon 
              className="w-[18px] h-[18px] transition-colors" 
              style={{ color: program.color }}
              strokeWidth={2}
            />

            {/* Tooltip */}
            <span className="
              absolute -top-9 left-1/2 -translate-x-1/2 
              px-2 py-1 bg-slate-800 text-white text-xs rounded-md
              opacity-0 group-hover:opacity-100 transition-opacity
              pointer-events-none whitespace-nowrap z-50
              border border-slate-700 shadow-lg
            ">
              {program.name}
              <span className="ml-1 text-slate-400">⌘⇧{program.shortcut}</span>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-r border-b border-slate-700" />
            </span>

            {/* Active indicator dot */}
            {isActive && (
              <span 
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: program.color }}
              />
            )}
          </button>
        );
      })}
    </motion.div>
  );
};

export default ProgramDock;

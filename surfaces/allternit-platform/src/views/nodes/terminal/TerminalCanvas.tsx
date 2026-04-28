"use client";

/**
 * Terminal Canvas - Dynamic terminal grid
 * 
 * Features:
 * - Only shows active terminals (no empty slot placeholders)
 * - Add terminals dynamically via toolbar button
 * - Grid auto-adjusts as terminals are added/removed
 * - Drag to rearrange
 * - Max terminals based on rows/cols config
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { nodeTerminalService, type TerminalSession } from './terminal.service';
import { Button } from '@/components/ui/button';
import {
  X,
  Plus,
  DotsSixVertical,
  SquaresFour,
  Trash,
} from '@phosphor-icons/react';
const Grid = SquaresFour;
import { cn } from '@/lib/utils';
import 'xterm/css/xterm.css';
import { openInBrowser } from '@/lib/openInBrowser';

// ============================================================================
// Theme Helper
// ============================================================================

// Terminal is ALWAYS dark theme for readability
// The container/chrome follows platform theme, but terminal content is always dark
// This ensures shell output is always readable regardless of platform theme
const terminalTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black: '#010409',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#c9d1d9',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#ffffff',
};

// ============================================================================
// Types
// ============================================================================

interface TerminalInstance {
  id: string;
  session: TerminalSession;
  title: string;
  createdAt: Date;
}

interface TerminalCanvasProps {
  nodeId: string;
  rows?: number;
  cols?: number;
  className?: string;
}

interface CanvasTerminalProps {
  terminal: TerminalInstance;
  index: number;
  onClose: () => void;
  onDragStart: () => void;
  isDragging?: boolean;
}

// ============================================================================
// Single Terminal Component
// ============================================================================

function CanvasTerminal({
  terminal,
  index,
  onClose,
  onDragStart,
  isDragging,
}: CanvasTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: terminalTheme,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      scrollback: 10000,
      // Enable clipboard API
      allowProposedApi: true,
    });

    termRef.current = term;

    // Add addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    
    const searchAddon = new SearchAddon();
    searchAddonRef.current = searchAddon;
    term.loadAddon(searchAddon);
    
    term.loadAddon(new WebLinksAddon((event, uri) => {
      event.preventDefault();
      openInBrowser(uri);
    }));

    term.open(terminalRef.current);

    // Enable clipboard integration
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Handle Ctrl+C - Copy when text is selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.type === 'keydown') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {});
          return false; // Prevent default
        }
      }
      // Handle Ctrl+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          term.paste(text);
        }).catch(() => {});
        return false; // Prevent default
      }
      return true; // Let other keys pass through
    });

    // Connect to session
    nodeTerminalService.onData(terminal.session.id, (data) => term.write(data));
    nodeTerminalService.onStatusChange(terminal.session.id, (connected) => {
      setIsConnected(connected);
    });

    // Handle input
    term.onData((data) => {
      nodeTerminalService.sendData(terminal.session.id, data);
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = termRef.current;
          nodeTerminalService.resize(terminal.session.id, cols, rows);
        } catch (err) {
          // Ignore - terminal may not be ready
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Note: Theme is always dark for terminals, no need to watch for changes
    // This prevents white terminal backgrounds that hurt readability

    // Initial fit
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [terminal.session.id]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        searchAddonRef.current?.clearDecorations();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#0d1117] rounded-lg overflow-hidden border transition-all",
        isDragging ? "border-blue-500 opacity-50 scale-95" : "border-zinc-800"
      )}
      draggable
      onDragStart={onDragStart}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <DotsSixVertical 
            size={14} 
            className="text-zinc-600 cursor-grab active:cursor-grabbing" 
          />
          <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
          <span className="text-xs text-zinc-400 font-mono truncate max-w-[120px]">
            {terminal.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
            onClick={() => setShowSearch(!showSearch)}
            title="Search (Ctrl+F)"
          >
            <span className="text-xs">🔍</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-red-400"
            onClick={onClose}
            title="Close Terminal"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 border-b border-zinc-700">
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
            onChange={(e) => {
              if (e.target.value) {
                searchAddonRef.current?.findNext(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey
                  ? searchAddonRef.current?.findPrevious((e.target as HTMLInputElement).value)
                  : searchAddonRef.current?.findNext((e.target as HTMLInputElement).value);
              }
            }}
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setShowSearch(false);
              searchAddonRef.current?.clearDecorations();
            }}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-2 min-h-0" />
    </div>
  );
}

// ============================================================================
// Main Terminal Canvas Component
// ============================================================================

export function TerminalCanvas({ 
  nodeId, 
  rows = 2, 
  cols = 3, 
  className 
}: TerminalCanvasProps) {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const maxTerminals = rows * cols;

  // Session persistence: Restore sessions on mount
  useEffect(() => {
    const restoreSessions = async () => {
      try {
        const pendingSessions = nodeTerminalService.getPendingRestoredSessions();
        if (pendingSessions.length > 0) {
          console.log(`[TerminalCanvas] Restoring ${pendingSessions.length} sessions...`);
          const restoredTerminals: TerminalInstance[] = [];
          let maxNum = 0;

          for (const sessionData of pendingSessions) {
            try {
              // Create new session with same params
              const session = await nodeTerminalService.createSession(
                sessionData.nodeId || nodeId,
                {
                  shell: sessionData.shell || '/bin/zsh',
                  cols: sessionData.cols || 80,
                  rows: sessionData.rows || 24,
                }
              );

              if (session) {
                // Extract terminal number from old title
                const numMatch = sessionData.id.match(/term-(\d+)/);
                const num = numMatch ? parseInt(numMatch[1]) : terminalCounter + restoredTerminals.length;
                maxNum = Math.max(maxNum, num);

                restoredTerminals.push({
                  id: `term-${Date.now()}-${num}`,
                  session,
                  title: `Terminal ${num}`,
                  createdAt: new Date(),
                });
              }
            } catch (err) {
              console.error('[TerminalCanvas] Failed to restore session:', err);
            }
          }

          if (restoredTerminals.length > 0) {
            setTerminals(restoredTerminals);
            setTerminalCounter(maxNum + 1);
          }
        }
      } catch (err) {
        console.error('[TerminalCanvas] Error restoring sessions:', err);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSessions();
  }, [nodeId]);

  // Create new terminal session
  const createTerminal = useCallback(async (): Promise<TerminalInstance | null> => {
    try {
      setError(null);
      const session = await nodeTerminalService.createSession(nodeId, {
        shell: '/bin/zsh',
        cols: 80,
        rows: 24,
      });

      if (!session) {
        const errMsg = 'Failed to create terminal: no session returned';
        console.error(errMsg);
        setError(errMsg);
        return null;
      }

      const terminal: TerminalInstance = {
        id: `term-${Date.now()}-${terminalCounter}`,
        session,
        title: `Terminal ${terminalCounter}`,
        createdAt: new Date(),
      };

      setTerminalCounter(c => c + 1);
      return terminal;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to create terminal';
      console.error('Failed to create terminal:', error);
      setError(errMsg);
      return null;
    }
  }, [nodeId, terminalCounter]);

  // Add terminal
  const addTerminal = useCallback(async () => {
    if (terminals.length >= maxTerminals) {
      alert(`Maximum ${maxTerminals} terminals reached. Close one to add a new terminal.`);
      return;
    }

    const terminal = await createTerminal();
    if (!terminal) return;

    setTerminals(prev => [...prev, terminal]);
  }, [terminals.length, maxTerminals, createTerminal]);

  // Close terminal
  const closeTerminal = useCallback((index: number) => {
    const terminal = terminals[index];
    if (terminal) {
      nodeTerminalService.closeSession(terminal.session.id);
    }

    setTerminals(prev => prev.filter((_, i) => i !== index));
  }, [terminals]);

  // Close all terminals
  const closeAllTerminals = useCallback(() => {
    terminals.forEach(t => {
      nodeTerminalService.closeSession(t.session.id);
    });

    setTerminals([]);
    setTerminalCounter(1);
  }, [terminals]);

  // Handle drag start
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder terminals
    setTerminals(prev => {
      const newTerminals = [...prev];
      const [removed] = newTerminals.splice(draggedIndex, 1);
      newTerminals.splice(index, 0, removed);
      return newTerminals;
    });
    setDraggedIndex(index);
  }, [draggedIndex]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  // Keyboard navigation between terminals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Alt + Arrow keys to navigate between terminals
      if (e.altKey) {
        const currentFocus = document.activeElement;
        const terminalElements = document.querySelectorAll('[data-terminal-index]');
        const currentIndex = Array.from(terminalElements).findIndex(el => el.contains(currentFocus));

        if (e.key === 'ArrowRight' && currentIndex < terminals.length - 1) {
          e.preventDefault();
          const nextTerminal = terminalElements[currentIndex + 1] as HTMLElement;
          nextTerminal?.focus();
        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
          e.preventDefault();
          const prevTerminal = terminalElements[currentIndex - 1] as HTMLElement;
          prevTerminal?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [terminals.length]);

  return (
    <div className={cn("h-full flex flex-col bg-zinc-950", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <SquaresFour size={20} className="text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Terminal Canvas</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded",
            terminals.length >= maxTerminals 
              ? "bg-red-500/20 text-red-400" 
              : "bg-zinc-800 text-zinc-500"
          )}>
            {terminals.length}/{maxTerminals}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addTerminal}
            disabled={terminals.length >= maxTerminals}
            className="h-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            <Plus size={16} className="mr-1" />
            Add Terminal
          </Button>
          {error && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setError(null)}
              className="h-8 border-red-700 text-red-400 hover:bg-red-500/10"
            >
              Error: {error.substring(0, 30)}...
              <X size={14} className="ml-1" />
            </Button>
          )}
          {terminals.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={closeAllTerminals}
              className="h-8 border-zinc-700 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash size={16} className="mr-1" />
              Close All
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Grid */}
      {isRestoring ? (
        // Loading State
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <SquaresFour size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium mb-2">Restoring sessions...</p>
            <p className="text-zinc-600 text-sm">Reconnecting to previous terminals</p>
          </div>
        </div>
      ) : terminals.length === 0 ? (
        // Empty State
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Plus size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium mb-2">No active terminals</p>
            <p className="text-zinc-600 text-sm mb-4">Click "Add Terminal" to start a new session</p>
            <Button
              variant="outline"
              size="sm"
              onClick={addTerminal}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              <Plus size={16} className="mr-1" />
              Add Terminal
            </Button>
          </div>
        </div>
      ) : (
        // Grid with terminals
        <div 
          className="flex-1 p-4 overflow-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: 'minmax(250px, 1fr)',
            gap: '12px',
          }}
        >
          {terminals.map((terminal, index) => (
            <div 
              key={terminal.id}
              data-terminal-index={index}
              className="min-h-[250px] outline-none focus:ring-2 focus:ring-blue-500/50 rounded-lg"
              tabIndex={0}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDragEnd}
            >
              <CanvasTerminal
                terminal={terminal}
                index={index}
                onClose={() => closeTerminal(index)}
                onDragStart={() => handleDragStart(index)}
                isDragging={draggedIndex === index}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TerminalCanvas;

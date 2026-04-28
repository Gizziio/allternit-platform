'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { openInBrowser } from '@/lib/openInBrowser';
import { nodeTerminalService, TerminalSessionInfo } from './terminal.service';
import { GripVertical, X, Plus, Search, Trash2 } from 'lucide-react';

// Terminal is ALWAYS dark theme for readability
// The container/chrome follows platform theme, but terminal content is always dark
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

interface TerminalInstance {
  id: string;
  session: TerminalSessionInfo;
  title: string;
  createdAt: Date;
}

interface CanvasTerminalProps {
  terminal: TerminalInstance;
  index: number;
  onClose: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  isDragging: boolean;
  dragOverIndex: number | null;
}

function CanvasTerminal({
  terminal,
  index,
  onClose,
  onDragStart,
  onDrop,
  isDragging,
  dragOverIndex,
}: CanvasTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: terminalTheme,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      scrollback: 10000,
      allowProposedApi: true,
    });

    // Addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    
    term.loadAddon(new WebLinksAddon((event, uri) => {
      openInBrowser(uri);
    }));

    term.open(terminalRef.current);
    termRef.current = term;

    // Clipboard integration
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Ctrl+C - Copy selection
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.type === 'keydown') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {});
          return false;
        }
      }
      // Ctrl+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          term.paste(text);
        }).catch(() => {});
        return false;
      }
      // Ctrl+F - Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && e.type === 'keydown') {
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return false;
      }
      return true;
    });

    // Connect to session
    const dataUnsubscribe = nodeTerminalService.onData(terminal.session.id, (data) => {
      term.write(data);
    });

    const statusUnsubscribe = nodeTerminalService.onStatusChange(terminal.session.id, (connected) => {
      setIsConnected(connected);
    });

    // Handle input
    term.onData((data) => {
      nodeTerminalService.sendData(terminal.session.id, data);
    });

    // Initial fit with delay to ensure container is rendered
    const initialFitTimeout = setTimeout(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = termRef.current;
          nodeTerminalService.resize(terminal.session.id, cols, rows);
        } catch (err) {
          console.warn('[Terminal] Initial fit failed:', err);
        }
      }
    }, 100);

    // Resize handler
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = termRef.current;
          nodeTerminalService.resize(terminal.session.id, cols, rows);
        } catch (err) {
          console.warn('[Terminal] Resize failed:', err);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initialFitTimeout);
      window.removeEventListener('resize', handleResize);
      dataUnsubscribe();
      statusUnsubscribe();
      term.dispose();
    };
  }, [terminal.session.id]);

  // Handle search
  const handleSearch = (direction: 'next' | 'previous' = 'next') => {
    if (!termRef.current || !searchInputRef.current) return;
    const query = searchInputRef.current.value;
    if (!query) return;
    
    const searchAddon = termRef.current.loadAddon(new SearchAddon()) as unknown as SearchAddon;
    if (direction === 'next') {
      searchAddon.findNext(query);
    } else {
      searchAddon.findPrevious(query);
    }
  };

  const isDropTarget = dragOverIndex === index;

  return (
    <div
      className={`
        relative flex flex-col rounded-lg border overflow-hidden
        bg-[#0d1117] border-gray-700
        transition-all duration-200
        ${isDragging ? 'opacity-50' : 'opacity-100'}
        ${isDropTarget ? 'ring-2 ring-blue-500 border-blue-500' : ''}
      `}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, index)}
      data-terminal-index={index}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-500 cursor-grab active:cursor-grabbing" />
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-300">
            Terminal {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Search (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => onClose(terminal.id)}
            className="p-1.5 rounded hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-colors"
            title="Close terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Box */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e.shiftKey ? 'previous' : 'next');
              } else if (e.key === 'Escape') {
                setShowSearch(false);
              }
            }}
          />
          <button
            onClick={() => handleSearch('previous')}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
          >
            ↑
          </button>
          <button
            onClick={() => handleSearch('next')}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
          >
            ↓
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Terminal Content */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={terminalRef} className="absolute inset-0 p-2" />
      </div>
    </div>
  );
}

interface EmptySlotProps {
  index: number;
  onAdd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  dragOverIndex: number | null;
}

function EmptySlot({ index, onAdd, onDrop, dragOverIndex }: EmptySlotProps) {
  const isDropTarget = dragOverIndex === index;

  return (
    <div
      className={`
        flex flex-col items-center justify-center rounded-lg border-2 border-dashed
        min-h-[200px]
        transition-all duration-200
        ${isDropTarget 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
        }
      `}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, index)}
      data-terminal-index={index}
    >
      <button
        onClick={onAdd}
        className="flex flex-col items-center gap-2 p-4 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <Plus className="w-8 h-8" />
        <span className="text-sm">Add Terminal</span>
      </button>
    </div>
  );
}

interface TerminalCanvasProps {
  nodeId: string;
  rows?: number;
  cols?: number;
  className?: string;
}

export function TerminalCanvas({
  nodeId,
  rows = 2,
  cols = 3,
  className = '',
}: TerminalCanvasProps) {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const maxTerminals = rows * cols;

  // Load saved terminals from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`terminal-canvas-${nodeId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Restore terminal sessions (they'll reconnect automatically)
        if (parsed.terminals && Array.isArray(parsed.terminals)) {
          // Note: We can't fully restore sessions here since they need to be recreated
          // The service handles reconnection
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [nodeId]);

  // Save terminals to localStorage
  useEffect(() => {
    const data = {
      terminals: terminals.map(t => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt.toISOString(),
      })),
      timestamp: Date.now(),
    };
    localStorage.setItem(`terminal-canvas-${nodeId}`, JSON.stringify(data));
  }, [terminals, nodeId]);

  const addTerminal = useCallback(async () => {
    if (terminals.length >= maxTerminals) return;
    
    setIsLoading(true);
    try {
      const session = await nodeTerminalService.createSession(nodeId);
      const newTerminal: TerminalInstance = {
        id: `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        session,
        title: `Terminal ${terminals.length + 1}`,
        createdAt: new Date(),
      };
      setTerminals(prev => [...prev, newTerminal]);
    } catch (error) {
      console.error('[TerminalCanvas] Failed to create terminal:', error);
    } finally {
      setIsLoading(false);
    }
  }, [terminals.length, maxTerminals, nodeId]);

  const closeTerminal = useCallback((id: string) => {
    const terminal = terminals.find(t => t.id === id);
    if (terminal) {
      nodeTerminalService.closeSession(terminal.session.id);
    }
    setTerminals(prev => prev.filter(t => t.id !== id));
  }, [terminals]);

  const closeAllTerminals = useCallback(() => {
    terminals.forEach(t => {
      nodeTerminalService.closeSession(t.session.id);
    });
    setTerminals([]);
  }, [terminals]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image if needed
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    // Swap terminals
    setTerminals(prev => {
      const newTerminals = [...prev];
      const draggedTerminal = newTerminals[draggedIndex];
      const targetTerminal = newTerminals[dropIndex];
      
      if (draggedTerminal && targetTerminal) {
        // Swap positions
        newTerminals[draggedIndex] = targetTerminal;
        newTerminals[dropIndex] = draggedTerminal;
      } else if (draggedTerminal) {
        // Move to empty slot (if implemented)
        // For now, just reorder within existing terminals
      }
      
      return newTerminals;
    });
    
    setDraggedIndex(null);
  }, [draggedIndex]);

  const activeCount = terminals.length;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-200">Terminal Canvas</h2>
          <span className="px-2 py-0.5 text-sm bg-gray-800 text-gray-400 rounded-full">
            {activeCount}/{maxTerminals}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addTerminal}
            disabled={isLoading || activeCount >= maxTerminals}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Terminal
          </button>
          {activeCount > 0 && (
            <button
              onClick={closeAllTerminals}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Close All
            </button>
          )}
        </div>
      </div>

      {/* Terminal Grid */}
      <div 
        className="flex-1 p-4 overflow-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: '12px',
        }}
        onDragLeave={handleDragLeave}
      >
        {activeCount === 0 ? (
          // Empty state - show placeholder slots
          Array.from({ length: maxTerminals }).map((_, index) => (
            <EmptySlot
              key={`empty-${index}`}
              index={index}
              onAdd={addTerminal}
              onDrop={handleDrop}
              dragOverIndex={dragOverIndex}
            />
          ))
        ) : (
          // Show active terminals + empty slots for remaining
          <>
            {terminals.map((terminal, index) => (
              <CanvasTerminal
                key={terminal.id}
                terminal={terminal}
                index={index}
                onClose={closeTerminal}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                isDragging={draggedIndex === index}
                dragOverIndex={dragOverIndex}
              />
            ))}
            {Array.from({ length: maxTerminals - activeCount }).map((_, idx) => (
              <EmptySlot
                key={`empty-${idx}`}
                index={activeCount + idx}
                onAdd={addTerminal}
                onDrop={handleDrop}
                dragOverIndex={dragOverIndex}
              />
            ))}
          </>
        )}
      </div>

      {/* Help text */}
      <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-800 bg-gray-900/30">
        <span className="font-medium">Tips:</span> Drag terminals to rearrange • Ctrl+F to search • Ctrl+C/V for copy/paste
      </div>
    </div>
  );
}

export default TerminalCanvas;

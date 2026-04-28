"use client";

/**
 * Multi-Pane Terminal System - Premium Card Style with Full Features
 * 
 * Features:
 * - Session persistence & recovery
 * - Terminal profiles (Standard, Python, Node, Docker, SSH)
 * - File drag & drop
 * - Command history
 * - Notifications
 * - Better resize with dimensions
 * - Export logs
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { nodeTerminalService, type TerminalSession } from './terminal.service';
import { terminalPersistence, PersistedSession } from './terminal-persistence';
import { TERMINAL_PROFILES, TerminalProfileType, getProfileById } from './terminal-profiles';
import { Button } from '@/components/ui/button';
import {
  X,
  SplitHorizontal,
  SplitVertical,
  Plus,
  DotsSixVertical as GripVertical,
  MagnifyingGlass as Search,
  Copy,
  TextT as Type,
  CaretUp as ChevronUp,
  CaretDown as ChevronDown,
  Terminal as TerminalIcon,
  Globe,
  Download,
  ArrowCounterClockwise as RefreshCcw,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import 'xterm/css/xterm.css';
import { openInBrowser } from '@/lib/openInBrowser';

// Terminal theme
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

type SplitDirection = 'horizontal' | 'vertical';

interface PaneNode {
  id: string;
  type: 'terminal' | 'split';
  direction?: SplitDirection;
  children?: PaneNode[];
  session?: TerminalSession;
  size?: number;
  title?: string;
  profile?: TerminalProfileType;
}

interface TerminalCardProps {
  paneId: string;
  session: TerminalSession;
  title: string;
  profile: TerminalProfileType;
  onClose: () => void;
  onSplit: (direction: SplitDirection) => void;
  onRename: (newTitle: string) => void;
  onChangeProfile: (profile: TerminalProfileType) => void;
  isOnlyPane?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  onFileDrop?: (filePath: string) => void;
}

// ============================================================================
// Profile Selector Component
// ============================================================================

function ProfileSelector({ 
  currentProfile, 
  onSelect 
}: { 
  currentProfile: TerminalProfileType;
  onSelect: (profile: TerminalProfileType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const profiles: { id: TerminalProfileType; icon: React.ReactNode; color: string }[] = [
    { id: 'standard', icon: <TerminalIcon size={14} />, color: 'text-zinc-400' },
    { id: 'python', icon: <span className="text-xs font-bold">Py</span>, color: 'text-green-400' },
    { id: 'nodejs', icon: <span className="text-xs font-bold">Node</span>, color: 'text-yellow-400' },
    { id: 'docker', icon: <span className="text-xs font-bold">Docker</span>, color: 'text-blue-400' },
    { id: 'ssh', icon: <Globe size={14} />, color: 'text-purple-400' },
  ];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
        onClick={() => setIsOpen(!isOpen)}
      >
        {profiles.find(p => p.id === currentProfile)?.icon}
        <ChevronDown size={12} className="ml-1" />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[140px]">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => {
                onSelect(profile.id);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-zinc-800 transition-colors",
                currentProfile === profile.id ? "text-white bg-zinc-800" : "text-zinc-400"
              )}
            >
              <span className={profile.color}>{profile.icon}</span>
              <span>{TERMINAL_PROFILES[profile.id].name}</span>
            </button>
          ))}
        </div>
      )}
      
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

// ============================================================================
// Context Menu Component
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onClear: () => void;
  onRename: () => void;
  onExport: () => void;
}

function ContextMenu({ x, y, onClose, onCopy, onClear, onRename, onExport }: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    setTimeout(() => window.addEventListener('click', handleClick), 0);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[160px] py-1 bg-zinc-900/95 backdrop-blur-xl rounded-lg border border-zinc-700/50 shadow-2xl"
      style={{ left: x, top: y }}
    >
      <button onClick={onCopy} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
        <Copy size={14} /> Copy Selection
      </button>
      <button onClick={onClear} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
        <RefreshCcw size={14} /> Clear Terminal
      </button>
      <button onClick={onRename} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
        <Type size={14} /> Rename
      </button>
      <div className="my-1 border-t border-zinc-800" />
      <button onClick={onExport} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
        <Download size={14} /> Export Log
      </button>
    </div>
  );
}

// ============================================================================
// Terminal Card Component
// ============================================================================

function TerminalCard({ 
  paneId, session, title, profile,
  onClose, onSplit, onRename, onChangeProfile,
  isOnlyPane, isFocused, onFocus, onFileDrop
}: TerminalCardProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const outputBufferRef = useRef<string>('');
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
  const [fontSize, setFontSize] = useState(13);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showResizeOverlay, setShowResizeOverlay] = useState(false);
  const [dimensions, setDimensions] = useState({ cols: 80, rows: 24 });

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: terminalTheme,
      fontSize: fontSize,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontWeight: 400,
      scrollback: 10000,
      allowProposedApi: true,
    });

    termRef.current = term;

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

    // Collect output for persistence
    const originalWrite = term.write.bind(term);
    term.write = (data: string | Uint8Array, callback?: () => void) => {
      if (typeof data === 'string') {
        outputBufferRef.current += data;
        // Keep last 10k chars
        if (outputBufferRef.current.length > 10000) {
          outputBufferRef.current = outputBufferRef.current.slice(-10000);
        }
      }
      return originalWrite(data, callback);
    };

    // Save snapshot periodically
    const snapshotInterval = setInterval(() => {
      if (outputBufferRef.current) {
        terminalPersistence.saveSnapshot(session.id, outputBufferRef.current, dimensions.cols, dimensions.rows);
      }
    }, 5000);

    // Basic clipboard
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => true);

    // Connect to session
    nodeTerminalService.onData(session.id, (data) => term.write(data));
    nodeTerminalService.onStatusChange(session.id, (connected) => {
      setIsConnected(connected);
    });

    term.onData((data) => {
      nodeTerminalService.sendData(session.id, data);
    });

    // Initial fit
    const initialFit = setTimeout(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = termRef.current;
          setDimensions({ cols, rows });
          nodeTerminalService.resize(session.id, cols, rows);
        } catch (err) {
          console.warn('[TerminalCard] Initial fit error:', err);
        }
      }
    }, 100);

    return () => {
      clearTimeout(initialFit);
      clearInterval(snapshotInterval);
      // Save final snapshot
      if (outputBufferRef.current) {
        terminalPersistence.saveSnapshot(session.id, outputBufferRef.current, dimensions.cols, dimensions.rows);
      }
      term.dispose();
    };
  }, [session.id]);

  // Font size change
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = termRef.current;
        setDimensions({ cols, rows });
        nodeTerminalService.resize(session.id, cols, rows);
      }
    }
  }, [fontSize, session.id]);

  // Handle resize with overlay
  useEffect(() => {
    let overlayTimer: ReturnType<typeof setTimeout>;
    
    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = termRef.current;
          setDimensions({ cols, rows });
          setShowResizeOverlay(true);
          nodeTerminalService.resize(session.id, cols, rows);
          
          clearTimeout(overlayTimer);
          overlayTimer = setTimeout(() => setShowResizeOverlay(false), 1000);
        } catch (err) {}
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(overlayTimer);
    };
  }, [session.id]);

  // Close search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        searchAddonRef.current?.clearDecorations();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const path = (file as unknown as { path?: string }).path || file.name;
      if (onFileDrop) {
        onFileDrop(path);
      } else {
        // Type path into terminal
        termRef.current?.paste(`"${path}"`);
      }
    });
  };

  const handleCopySelection = () => {
    if (termRef.current) {
      const selection = termRef.current.getSelection();
      if (selection) navigator.clipboard.writeText(selection);
    }
    setContextMenu(null);
  };

  const handleClear = () => {
    termRef.current?.clear();
    outputBufferRef.current = '';
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = () => {
    setIsEditingTitle(true);
    setEditTitle(title);
    setContextMenu(null);
  };

  const saveRename = () => {
    if (editTitle.trim()) onRename(editTitle.trim());
    setIsEditingTitle(false);
  };

  const handleExport = () => {
    const blob = new Blob([outputBufferRef.current], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_log.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setContextMenu(null);
  };

  return (
    <div 
      ref={cardRef}
      onClick={onFocus}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col rounded-2xl overflow-hidden h-full relative",
        "bg-gradient-to-b from-zinc-900/90 to-[#0d1117]/95",
        "border transition-all duration-300",
        "backdrop-blur-sm",
        isDragOver && "border-blue-500 ring-2 ring-blue-500/30",
        isFocused 
          ? "border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.15),0_8px_32px_rgba(0,0,0,0.4)]" 
          : "border-zinc-800/60 shadow-[0_4px_20px_rgba(0,0,0,0.3)]",
        "hover:border-zinc-700/80",
        "group"
      )}
    >
      {/* Resize Overlay */}
      {showResizeOverlay && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-3 py-1.5 bg-zinc-900/90 border border-zinc-700 rounded-lg shadow-xl">
          <span className="text-xs font-mono text-zinc-300">{dimensions.cols} × {dimensions.rows}</span>
        </div>
      )}

      {/* Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-2xl flex items-center justify-center">
          <span className="text-sm font-medium text-blue-400">Drop file to paste path</span>
        </div>
      )}

      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2.5",
        isFocused ? "bg-zinc-900/90" : "bg-zinc-900/70"
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripVertical size={14} className="text-zinc-600 flex-shrink-0" />
          <div className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"
          )} />
          
          {isEditingTitle ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 w-full max-w-[120px]"
              autoFocus
            />
          ) : (
            <button onClick={handleRename} className="text-xs font-medium text-zinc-400 font-mono truncate hover:text-zinc-300 text-left">
              {title}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProfileSelector currentProfile={profile} onSelect={onChangeProfile} />
          
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-zinc-300" onClick={() => setFontSize(prev => Math.max(10, prev - 1))}>
            <span className="text-xs font-bold">A-</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-zinc-300" onClick={() => setFontSize(prev => Math.min(20, prev + 1))}>
            <span className="text-xs font-bold">A+</span>
          </Button>
          
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-blue-400" onClick={() => onSplit('horizontal')} title="Split Below">
            <SplitHorizontal size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-blue-400" onClick={() => onSplit('vertical')} title="Split Right">
            <SplitVertical size={14} />
          </Button>
          <Button variant="ghost" size="icon" className={cn("h-7 w-7", showSearch ? "text-blue-400 bg-blue-500/10" : "text-zinc-500 hover:text-zinc-300")} onClick={() => setShowSearch(!showSearch)}>
            <Search size={14} />
          </Button>
          {!isOnlyPane && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={onClose}>
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className={cn("overflow-hidden transition-all", showSearch ? "max-h-12" : "max-h-0")}>
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border-b border-zinc-800">
          <Search size={14} className="text-zinc-500" />
          <input type="text" placeholder="Search..." className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
            onChange={(e) => e.target.value && searchAddonRef.current?.findNext(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? searchAddonRef.current?.findPrevious((e.target as HTMLInputElement).value)
                          : searchAddonRef.current?.findNext((e.target as HTMLInputElement).value);
              }
            }}
          />
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500" onClick={() => searchAddonRef.current?.findPrevious((document.querySelector('input[placeholder="Search..."]') as HTMLInputElement)?.value || '')}>
            <ChevronUp size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500" onClick={() => searchAddonRef.current?.findNext((document.querySelector('input[placeholder="Search..."]') as HTMLInputElement)?.value || '')}>
            <ChevronDown size={14} />
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 relative overflow-hidden bg-[#0d1117]">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />
        <div ref={terminalRef} className="absolute inset-0 p-3" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-t border-zinc-800/50 text-[10px] text-zinc-600 font-mono">
        <span>{fontSize}px • {dimensions.cols}×{dimensions.rows}</span>
        <span className="flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500/50" : "bg-red-500/50")} />
          {profile}
        </span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}
          onCopy={handleCopySelection} onClear={handleClear} onRename={handleRename} onExport={handleExport} />
      )}
    </div>
  );
}

// ============================================================================
// Split Container
// ============================================================================

interface SplitContainerProps {
  direction: SplitDirection;
  children: [React.ReactNode, React.ReactNode];
  defaultSplit?: number;
}

function SplitContainer({ direction, children, defaultSplit = 50 }: SplitContainerProps) {
  const [split, setSplit] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let newSplit = direction === 'horizontal' 
      ? ((e.clientY - rect.top) / rect.height) * 100
      : ((e.clientX - rect.left) / rect.width) * 100;
    newSplit = Math.max(20, Math.min(80, newSplit));
    setSplit(newSplit);
  }, [isDragging, direction]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false), { once: true });
      document.body.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, direction]);

  const isHorizontal = direction === 'horizontal';
  const gap = 16;

  return (
    <div ref={containerRef} className={cn("flex h-full", isHorizontal ? "flex-col" : "flex-row")} style={{ gap }}>
      <div className="overflow-hidden" style={{ [isHorizontal ? 'height' : 'width']: `calc(${split}% - ${gap/2}px)` }}>
        {children[0]}
      </div>
      <div className={cn("relative flex items-center justify-center transition-colors rounded-full", isHorizontal ? "h-3 cursor-row-resize" : "w-3 cursor-col-resize")} onMouseDown={() => setIsDragging(true)}>
        <div className={cn("bg-zinc-700/50 rounded-full transition-all", isHorizontal ? "w-12 h-1" : "w-1 h-12", isDragging && "bg-blue-500 scale-110")} />
      </div>
      <div className="overflow-hidden" style={{ [isHorizontal ? 'height' : 'width']: `calc(${100 - split}% - ${gap/2}px)` }}>
        {children[1]}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface MultiPaneTerminalProps {
  nodeId: string;
  className?: string;
}

export function MultiPaneTerminal({ nodeId, className }: MultiPaneTerminalProps) {
  const [rootPane, setRootPane] = useState<PaneNode>({
    id: 'root', type: 'terminal', title: 'Terminal 1', profile: 'standard', session: undefined, size: 100,
  });
  const [paneCounter, setPaneCounter] = useState(2);
  const [isInitializing, setIsInitializing] = useState(true);
  const [focusedPane, setFocusedPane] = useState<string>('root');
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore sessions on mount
  useEffect(() => {
    const restore = async () => {
      const persisted = terminalPersistence.loadSessions();
      if (persisted.length > 0) {
        // Restore first session
        const first = persisted[0];
        try {
          const session = await nodeTerminalService.createSession(nodeId, {
            shell: first.shell, cols: first.cols || 80, rows: first.rows || 24,
          });
          if (session) {
            setRootPane(prev => ({ ...prev, session, title: first.title, profile: (first as any).profile || 'standard' }));
            // Restore snapshot if exists
            const snapshot = terminalPersistence.getSnapshot(first.id);
            if (snapshot) {
              setTimeout(() => {
                // Terminal will receive data via onData handler
              }, 500);
            }
          }
        } catch (e) {
          console.error('Failed to restore session:', e);
        }
      }
      setIsRestoring(false);
      setIsInitializing(false);
    };
    restore();
  }, [nodeId]);

  // Save sessions on change
  useEffect(() => {
    if (isInitializing) return;
    const persistData: PersistedSession[] = [{
      id: rootPane.id,
      nodeId,
      shell: '/bin/bash',
      cols: 80, rows: 24,
      title: rootPane.title || 'Terminal',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      profile: rootPane.profile,
    }];
    terminalPersistence.saveSessions(persistData);
  }, [rootPane, nodeId, isInitializing]);

  const createSession = async (paneId: string, title: string, profile: TerminalProfileType = 'standard'): Promise<TerminalSession> => {
    const profileConfig = getProfileById(profile);
    const session = await nodeTerminalService.createSession(nodeId, {
      shell: profileConfig.shell,
      cols: 80, rows: 24,
    });
    if (!session) throw new Error('Failed to create session');
    return session;
  };

  const splitPane = useCallback(async (targetId: string, direction: SplitDirection) => {
    const newId = `pane-${Date.now()}`;
    const newTitle = `Terminal ${paneCounter}`;
    const currentProfile = rootPane.profile || 'standard';
    setPaneCounter(c => c + 1);

    const replacePane = (node: PaneNode): PaneNode => {
      if (node.id === targetId && node.type === 'terminal') {
        return {
          id: `split-${targetId}`, type: 'split', direction,
          children: [
            { ...node, size: 50 },
            { id: newId, type: 'terminal', title: newTitle, profile: currentProfile, size: 50 },
          ],
        };
      }
      if (node.type === 'split' && node.children) {
        return { ...node, children: node.children.map(replacePane) };
      }
      return node;
    };

    const newSession = await createSession(newId, newTitle, currentProfile);
    setFocusedPane(newId);
    setRootPane(prev => {
      const updated = replacePane(prev);
      const injectSession = (node: PaneNode): PaneNode => {
        if (node.id === newId) return { ...node, session: newSession };
        if (node.type === 'split' && node.children) return { ...node, children: node.children.map(injectSession) };
        return node;
      };
      return injectSession(updated);
    });
  }, [nodeId, paneCounter, rootPane.profile]);

  const closePane = useCallback((targetId: string) => {
    const removePane = (node: PaneNode): PaneNode | null => {
      if (node.id === targetId) {
        if (node.session) {
          terminalPersistence.removeSession(node.session.id);
          nodeTerminalService.closeSession(node.session.id);
        }
        return null;
      }
      if (node.type === 'split' && node.children) {
        const newChildren = node.children.map(removePane).filter((n): n is PaneNode => n !== null);
        if (newChildren.length === 1) return { ...newChildren[0], size: node.size };
        return { ...node, children: newChildren };
      }
      return node;
    };
    setRootPane(prev => {
      const updated = removePane(prev) || prev;
      if (targetId === focusedPane) setFocusedPane('root');
      return updated;
    });
  }, [focusedPane]);

  const renamePane = useCallback((targetId: string, newTitle: string) => {
    const updateTitle = (node: PaneNode): PaneNode => {
      if (node.id === targetId) return { ...node, title: newTitle };
      if (node.type === 'split' && node.children) return { ...node, children: node.children.map(updateTitle) };
      return node;
    };
    setRootPane(prev => updateTitle(prev));
  }, []);

  const changeProfile = useCallback((targetId: string, newProfile: TerminalProfileType) => {
    const updateProfile = (node: PaneNode): PaneNode => {
      if (node.id === targetId) return { ...node, profile: newProfile };
      if (node.type === 'split' && node.children) return { ...node, children: node.children.map(updateProfile) };
      return node;
    };
    setRootPane(prev => updateProfile(prev));
  }, []);

  const countPanes = (node: PaneNode): number => {
    if (node.type === 'terminal') return 1;
    if (node.type === 'split' && node.children) return node.children.reduce((sum, child) => sum + countPanes(child), 0);
    return 0;
  };

  const renderPane = (node: PaneNode): React.ReactNode => {
    if (node.type === 'terminal') {
      if (!node.session) return (
        <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-zinc-500">{isRestoring ? 'Restoring session...' : 'Initializing...'}</span>
          </div>
        </div>
      );
      return (
        <TerminalCard
          paneId={node.id} session={node.session} title={node.title || 'Terminal'} profile={node.profile || 'standard'}
          onClose={() => closePane(node.id)} onSplit={(dir) => splitPane(node.id, dir)} onRename={(t) => renamePane(node.id, t)}
          onChangeProfile={(p) => changeProfile(node.id, p)} isOnlyPane={countPanes(rootPane) === 1}
          isFocused={focusedPane === node.id} onFocus={() => setFocusedPane(node.id)}
        />
      );
    }
    if (node.type === 'split' && node.children?.length === 2) {
      return <SplitContainer direction={node.direction!}>{renderPane(node.children[0])}{renderPane(node.children[1])}</SplitContainer>;
    }
    return null;
  };

  return (
    <div className={cn("h-full flex flex-col bg-zinc-950", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <TerminalIcon size={18} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Swarm ADE</h2>
            <p className="text-xs text-zinc-500">Multi-plex Terminal Environment</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <span className="text-xs text-zinc-500">Active Terminals</span>
            <span className="text-xs font-semibold text-blue-400">{countPanes(rootPane)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => splitPane(rootPane.id, 'horizontal')} className="h-8 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800">
            <Plus size={14} className="mr-1.5" /> New Terminal
          </Button>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 p-5 overflow-hidden">
        {isInitializing ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-zinc-800 border-t-blue-500 rounded-full animate-spin" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
              </div>
              <span className="text-sm text-zinc-500">{isRestoring ? 'Restoring sessions...' : 'Starting terminal session...'}</span>
            </div>
          </div>
        ) : (
          <div className="h-full">{renderPane(rootPane)}</div>
        )}
      </div>
    </div>
  );
}

export default MultiPaneTerminal;

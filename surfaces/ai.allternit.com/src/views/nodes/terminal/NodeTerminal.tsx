"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SerializeAddon } from 'xterm-addon-serialize';
import { nodeTerminalService, type TerminalSession, type TimeoutWarning, type TerminalSnapshotFrame } from './terminal.service';
import { TerminalFileBrowser, type FileEntry, type FileTransfer } from './TerminalFileBrowser';
import { Button } from '@/components/ui/button';
import {
  Folder,
  X,
  UploadSimple,
  DownloadSimple,
  CheckCircle,
  Warning,
  Sidebar,
  SidebarSimple as PanelLeftClose,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import 'xterm/css/xterm.css';

interface NodeTerminalProps {
  session: TerminalSession;
  onClose: () => void;
  className?: string;
  /**
   * Called when reconnection is needed (e.g., page refresh)
   * Return true if reconnection was handled, false to create new session
   */
  onReconnectionNeeded?: (sessionId: string, nodeId: string) => Promise<boolean>;
  /**
   * Enable file browser panel
   */
  enableFileBrowser?: boolean;
}

export function NodeTerminal({ 
  session, 
  onClose, 
  className = '', 
  onReconnectionNeeded,
  enableFileBrowser = true,
}: NodeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const awaitingAuthoritativeReplayRef = useRef(false);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Idle timeout warning state
  const [timeoutWarning, setTimeoutWarning] = useState<TimeoutWarning | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const timeoutWarningRef = useRef<TimeoutWarning | null>(null);
  
  // Track reconnection attempts
  const [reconnectionAttempt, setReconnectionAttempt] = useState(0);

  // File browser state
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [showTransfers, setShowTransfers] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#c9d1d9',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontSize: 13,
      fontFamily: 'var(--font-mono)',
      fontWeight: 400,
      fontWeightBold: 600,
      rows: session.rows,
      cols: session.cols,
      scrollback: 10000,
      allowProposedApi: true,
    });

    termRef.current = term;

    // Add addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    const serializeAddon = new SerializeAddon();
    serializeAddonRef.current = serializeAddon;
    term.loadAddon(serializeAddon);

    // Open terminal in container
    term.open(terminalRef.current);

    const restoredSnapshot = nodeTerminalService.getSnapshot(session.id);
    if (restoredSnapshot?.snapshot) {
      term.write(restoredSnapshot.snapshot);
      awaitingAuthoritativeReplayRef.current = true;
    }

    // Initial fit
    setTimeout(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        nodeTerminalService.resize(session.id, cols, rows);
      } catch (err) {
        console.warn('Fit addon error:', err);
      }
    }, 100);

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        nodeTerminalService.resize(session.id, cols, rows);
      } catch (err) {
        console.warn('Resize error:', err);
      }
    };

    window.addEventListener('resize', handleResize);

    // Register data handlers
    nodeTerminalService.onData(session.id, (data) => {
      if (awaitingAuthoritativeReplayRef.current) {
        term.reset();
        awaitingAuthoritativeReplayRef.current = false;
      }
      term.write(data);
    });

    nodeTerminalService.onSnapshot(session.id, (frame: TerminalSnapshotFrame) => {
      awaitingAuthoritativeReplayRef.current = false;
      term.reset();
      term.write(frame.snapshot);
      nodeTerminalService.saveSnapshot(session.id, frame.snapshot, frame.cols, frame.rows);
    });

    nodeTerminalService.onStatusChange(session.id, (connected) => {
      setIsConnected(connected);
      setIsReconnecting(nodeTerminalService.isReconnecting(session.id));
      
      if (!connected) {
        const attempt = nodeTerminalService.getReconnectionAttempt(session.id);
        setReconnectionAttempt(attempt);
        
        if (attempt === 0) {
          // No more reconnection attempts
          term.writeln('\r\n\x1b[1;31m[Disconnected]\x1b[0m');
        } else {
          term.writeln(`\r\n\x1b[1;33m[Reconnecting... attempt ${attempt}]\x1b[0m`);
        }
      } else {
        setReconnectionAttempt(0);
        term.writeln('\x1b[1;32m[Connected]\x1b[0m');
      }
    });

    // Register timeout warning handler
    nodeTerminalService.onTimeoutWarning(session.id, (warning) => {
      timeoutWarningRef.current = warning;
      setTimeoutWarning(warning);
      setShowTimeoutWarning(true);
      
      // Also write warning to terminal
      term.writeln(`\r\n\x1b[1;33m[Warning: ${warning.message}]\x1b[0m`);
      term.writeln('\x1b[1;33m[Click "Keep Alive" button to extend session]\x1b[0m');
    });

    // Handle user input
    term.onData((data) => {
      nodeTerminalService.sendData(session.id, data);
      
      // Hide timeout warning on activity
      if (timeoutWarningRef.current) {
        setShowTimeoutWarning(false);
        timeoutWarningRef.current = null;
      }
    });

    // Check initial connection status
    const connected = nodeTerminalService.isConnected(session.id);
    setIsConnected(connected);

    const persistSnapshot = () => {
      const currentTerm = termRef.current;
      const currentSerializeAddon = serializeAddonRef.current;
      if (!currentTerm || !currentSerializeAddon) {
        return;
      }
      const snapshot = currentSerializeAddon.serialize();
      nodeTerminalService.sendSnapshot(session.id, snapshot, currentTerm.cols, currentTerm.rows);
    };

    snapshotIntervalRef.current = setInterval(persistSnapshot, 5000);

    return () => {
      persistSnapshot();
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [session.id, session.cols, session.rows]);

  // Handle page visibility changes for reconnection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - check if we need to reconnect
        const isCurrentlyConnected = nodeTerminalService.isConnected(session.id);
        
        if (!isCurrentlyConnected) {
          console.log('[NodeTerminal] Page visible but disconnected, attempting reconnection');
          setIsReconnecting(true);
          
          // Try to reconnect
          nodeTerminalService.reconnectSession(session.id, session.nodeId).then((reconnectedSession) => {
            if (reconnectedSession) {
              console.log('[NodeTerminal] Reconnected successfully');
              setIsConnected(true);
              setIsReconnecting(false);
              setReconnectionAttempt(0);
              
              if (termRef.current) {
                termRef.current.writeln('\x1b[1;32m[Reconnected]\x1b[0m');
              }
            } else {
              console.log('[NodeTerminal] Reconnection failed');
              setIsReconnecting(false);
              
              // Call the parent's reconnection handler if provided
              if (onReconnectionNeeded) {
                onReconnectionNeeded(session.id, session.nodeId).then((handled) => {
                  if (!handled && termRef.current) {
                    termRef.current.writeln('\r\n\x1b[1;31m[Session expired - please create a new terminal]\x1b[0m');
                  }
                });
              }
            }
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session.id, session.nodeId, onReconnectionNeeded]);

  // Handle "Keep Alive" button click
  const handleKeepAlive = useCallback(() => {
    nodeTerminalService.sendKeepalive(session.id);
    setShowTimeoutWarning(false);
    setTimeoutWarning(null);
    timeoutWarningRef.current = null;
    
    if (termRef.current) {
      termRef.current.writeln('\r\n\x1b[1;32m[Session extended]\x1b[0m');
    }
  }, [session.id]);

  // Handle manual reconnect
  const handleManualReconnect = useCallback(() => {
    setIsReconnecting(true);
    setReconnectionAttempt(1);
    
    nodeTerminalService.reconnectSession(session.id, session.nodeId).then((reconnectedSession) => {
      if (reconnectedSession) {
        setIsConnected(true);
        setIsReconnecting(false);
        setReconnectionAttempt(0);
      } else {
        setIsReconnecting(false);
        setError('Failed to reconnect. The session may have expired.');
      }
    });
  }, [session.id, session.nodeId]);

  // Format remaining time for display
  const formatRemainingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget && !dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesUpload(Array.from(files));
    }
  }, [session.id]);

  // Handle file upload
  const handleFilesUpload = useCallback(async (files: File[]) => {
    const currentPath = '/tmp'; // Default upload path, could be made configurable
    
    for (const file of files) {
      const transferId = `${Date.now()}-${file.name}`;
      
      // Add to transfers
      setTransfers(prev => [...prev, {
        id: transferId,
        type: 'upload',
        filename: file.name,
        progress: 0,
        status: 'transferring',
        totalBytes: file.size,
        transferredBytes: 0,
      }]);
      
      setShowTransfers(true);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const fullPath = `${currentPath}/${file.name}`;
        
        const result = await nodeTerminalService.uploadFile(
          session.id, 
          fullPath, 
          uint8Array,
          (progress) => {
            setTransfers(prev => prev.map(t => 
              t.id === transferId 
                ? { ...t, progress, transferredBytes: (progress / 100) * file.size }
                : t
            ));
          }
        );

        if (result.success) {
          setTransfers(prev => prev.map(t => 
            t.id === transferId 
              ? { ...t, progress: 100, status: 'completed', transferredBytes: file.size }
              : t
          ));
          
          // Show in terminal
          if (termRef.current) {
            termRef.current.writeln(`\r\n\x1b[1;32m[Uploaded: ${file.name}]\x1b[0m`);
          }
        } else {
          setTransfers(prev => prev.map(t => 
            t.id === transferId 
              ? { ...t, status: 'error', error: result.error }
              : t
          ));
        }

        // Remove completed transfer after delay
        setTimeout(() => {
          setTransfers(prev => prev.filter(t => t.id !== transferId));
        }, 5000);
      } catch (err) {
        setTransfers(prev => prev.map(t => 
          t.id === transferId 
            ? { ...t, status: 'error', error: 'Upload failed' }
            : t
        ));
      }
    }
  }, [session.id]);

  // Handle file download from browser
  const handleFileSelect = useCallback(async (file: FileEntry) => {
    if (file.is_dir) return;

    const transferId = `${Date.now()}-${file.name}`;
    
    // Add to transfers
    setTransfers(prev => [...prev, {
      id: transferId,
      type: 'download',
      filename: file.name,
      progress: 0,
      status: 'transferring',
      totalBytes: file.size,
      transferredBytes: 0,
    }]);
    
    setShowTransfers(true);

    const success = await nodeTerminalService.downloadFile(session.id, file.path, file.name);

    if (success) {
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, progress: 100, status: 'completed', transferredBytes: file.size }
          : t
      ));
      
      // Remove after delay
      setTimeout(() => {
        setTransfers(prev => prev.filter(t => t.id !== transferId));
      }, 5000);
    } else {
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, status: 'error', error: 'Download failed' }
          : t
      ));
    }
  }, [session.id]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <div 
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected 
                ? 'bg-green-500' 
                : isReconnecting 
                  ? 'bg-yellow-500 animate-pulse' 
                  : 'bg-red-500'
            )} 
          />
          <span className="text-xs font-medium">
            {session.shell} on {session.nodeId.slice(0, 8)}...
          </span>
          {session.isReconnected && (
            <span className="text-xs text-blue-500">(reconnected)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {enableFileBrowser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileBrowser(!showFileBrowser)}
              className={cn(showFileBrowser && "bg-accent")}
            >
              {showFileBrowser ? (
                <PanelLeftClose size={16} />
              ) : (
                <Sidebar size={16} />
              )}
            </Button>
          )}
          {!isConnected && !isReconnecting && (
            <button
              onClick={handleManualReconnect}
              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Reconnect
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Timeout Warning Banner */}
      {showTimeoutWarning && timeoutWarning && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg 
              className="w-4 h-4 text-yellow-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <span className="text-sm text-yellow-700 dark:text-yellow-400">
              Session expires in {formatRemainingTime(timeoutWarning.remaining_seconds)}
            </span>
          </div>
          <button
            onClick={handleKeepAlive}
            className="text-xs px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors font-medium"
          >
            Keep Alive
          </button>
        </div>
      )}

      {/* Reconnection Status */}
      {isReconnecting && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-3 py-2 flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-700 dark:text-blue-400">
            Reconnecting... {reconnectionAttempt > 0 && `(attempt ${reconnectionAttempt})`}
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Terminal */}
        <div 
          ref={dropZoneRef}
          className={cn(
            "flex-1 relative bg-[#0d1117]",
            isDragging && "ring-2 ring-primary ring-inset"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div ref={terminalRef} className="absolute inset-0 p-2" />
          
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none">
              <div className="bg-background/90 px-6 py-4 rounded-lg shadow-lg text-center">
                <UploadSimple className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="font-medium">Drop files to upload</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90">
              <div className="text-center">
                <p className="text-destructive mb-2">{error}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setError(null);
                      handleManualReconnect();
                    }}
                    className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Disconnected overlay */}
          {!isConnected && !isReconnecting && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 pointer-events-none">
              <div className="text-center pointer-events-auto">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg 
                    className="w-6 h-6 text-red-500" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" 
                    />
                  </svg>
                </div>
                <p className="text-muted-foreground mb-3">Disconnected from terminal</p>
                <button
                  onClick={handleManualReconnect}
                  className="text-xs px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Reconnect Now
                </button>
              </div>
            </div>
          )}

          {/* Transfer notifications */}
          {transfers.length > 0 && (
            <div className="absolute bottom-4 right-4 w-80 space-y-2">
              {transfers.slice(0, 3).map((transfer) => (
                <div 
                  key={transfer.id}
                  className={cn(
                    "bg-background/95 border rounded-lg p-3 shadow-lg",
                    transfer.status === 'completed' && "border-green-500/50",
                    transfer.status === 'error' && "border-destructive/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {transfer.type === 'upload' ? (
                      <UploadSimple className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <DownloadSimple className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-sm truncate">{transfer.filename}</span>
                    {transfer.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {transfer.status === 'error' && (
                      <Warning className="h-4 w-4 text-destructive" />
                    )}
                    <button
                      onClick={() => setTransfers(prev => prev.filter(t => t.id !== transfer.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {transfer.status === 'transferring' && (
                    <div className="mt-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${transfer.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>{formatSize(transfer.transferredBytes)}</span>
                        <span>{formatSize(transfer.totalBytes)}</span>
                      </div>
                    </div>
                  )}
                  {transfer.status === 'error' && transfer.error && (
                    <p className="mt-1 text-xs text-destructive">{transfer.error}</p>
                  )}
                </div>
              ))}
              {transfers.length > 3 && (
                <div className="bg-background/95 border rounded-lg p-2 text-center text-xs text-muted-foreground">
                  +{transfers.length - 3} more transfers
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Browser */}
        {enableFileBrowser && showFileBrowser && (
          <div className="w-80 border-l bg-background">
            <TerminalFileBrowser
              sessionId={session.id}
              nodeId={session.nodeId}
              onFileSelect={handleFileSelect}
              className="h-full border-0 rounded-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default NodeTerminal;

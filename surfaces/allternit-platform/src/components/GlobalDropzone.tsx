'use client';

import React, { createContext, useContext, useCallback, useState, useRef, useEffect, type ReactNode, type DragEvent } from 'react';
import {
  UploadSimple,
  X,
  Chat,
  FolderOpen,
  Code,
} from '@phosphor-icons/react';
import { supportsTextExtraction, extractTextFromFile } from '@/lib/attachments/extract-text';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('GlobalDropzone');

// ============================================================================
// Types
// ============================================================================

export type DropTarget = 
  | 'chat'        // Chat input/composer
  | 'cowork'      // Cowork files view
  | 'code'        // Code explorer
  | 'agent'       // Agent runner/command palette
  | 'rail'        // Sidebar projects
  | 'global';     // Anywhere - uses current context

export interface GlobalDropzoneContextValue {
  isDragActive: boolean;
  isDragReject: boolean;
  dropTarget: DropTarget | null;
  registerDropHandler: (target: DropTarget, handler: DropHandler) => () => void;
  setCurrentContext: (context: DropTarget) => void;
}

export type DropHandler = (files: FileWithData[]) => void | Promise<void>;

export interface FileWithData {
  file: File;
  dataUrl: string;
  extractedText?: string;
}

// ============================================================================
// Context
// ============================================================================

const GlobalDropzoneContext = createContext<GlobalDropzoneContextValue | null>(null);

export function useGlobalDropzone() {
  const ctx = useContext(GlobalDropzoneContext);
  if (!ctx) {
    throw new Error('useGlobalDropzone must be used within GlobalDropzoneProvider');
  }
  return ctx;
}

// ============================================================================
// Provider Component
// ============================================================================

interface GlobalDropzoneProviderProps {
  children: ReactNode;
}

// Valid file types for drag-drop
const VALID_TYPES = [
  'image/',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/',
  'application/json',
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function GlobalDropzoneProvider({ children }: GlobalDropzoneProviderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [currentContext, setCurrentContext] = useState<DropTarget>('chat');
  const handlersRef = useRef<Map<DropTarget, DropHandler>>(new Map());
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register a drop handler for a specific target
  const registerDropHandler = useCallback((target: DropTarget, handler: DropHandler) => {
    handlersRef.current.set(target, handler);
    return () => {
      handlersRef.current.delete(target);
    };
  }, []);

  // Check if file is valid
  const isValidFile = useCallback((file: File): boolean => {
    if (file.size > MAX_SIZE) return false;
    return VALID_TYPES.some(type => file.type.startsWith(type) || file.name.endsWith('.docx'));
  }, []);

  // Process dropped files
  const processFiles = useCallback(async (files: FileList): Promise<FileWithData[]> => {
    const processedFiles: FileWithData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let extractedText: string | undefined;
      if (supportsTextExtraction(file)) {
        try {
          const extracted = await extractTextFromFile(file);
          extractedText = extracted?.text;
        } catch (err) {
          console.warn('Failed to extract text:', file.name);
        }
      }

      processedFiles.push({ file, dataUrl, extractedText });
    }

    return processedFiles;
  }, []);

  // Handle the actual drop
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    logger.debug('Drop event');
    
    dragCounterRef.current = 0;
    setIsDragActive(false);
    setIsDragReject(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      setDropTarget(null);
      return;
    }

    // Validate files
    const hasInvalidFiles = Array.from(files).some(f => !isValidFile(f));
    if (hasInvalidFiles) {
      logger.debug('Invalid files in drop');
      setDropTarget(null);
      return;
    }

    const processedFiles = await processFiles(files);
    
    // Determine target based on current context
    const target = currentContext || 'global';
    const handler = handlersRef.current.get(target) || handlersRef.current.get('global');
    
    logger.debug({ target, handlerFound: !!handler }, 'Routing to target');
    
    if (handler) {
      await handler(processedFiles);
    }

    setDropTarget(null);
  }, [currentContext, isValidFile, processFiles]);

  // Handle drag enter
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if files are being dragged (not just any drag)
    const types = e.dataTransfer?.types;
    const hasFiles = types?.includes('Files');
    
    if (!hasFiles) return;

    dragCounterRef.current += 1;
    logger.debug({ counter: dragCounterRef.current }, 'Drag enter');
    
    if (dragCounterRef.current === 1) {
      // Check if files are valid
      const files = e.dataTransfer?.items;
      let allValid = true;
      
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const item = files[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file && !isValidFile(file)) {
              allValid = false;
              break;
            }
          }
        }
      }
      
      setIsDragReject(!allValid);
      setIsDragActive(true);
      setDropTarget(currentContext);
    }
  }, [currentContext, isValidFile]);

  // Handle drag leave
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current -= 1;
    logger.debug({ counter: dragCounterRef.current }, 'Drag leave');
    
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
      setIsDragReject(false);
      setDropTarget(null);
    }
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Set up global drag event listeners
  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const contextValue: GlobalDropzoneContextValue = {
    isDragActive,
    isDragReject,
    dropTarget,
    registerDropHandler,
    setCurrentContext,
  };

  return (
    <GlobalDropzoneContext.Provider value={contextValue}>
      {children}
      
      {/* Dropzone overlay - only rendered when dragging */}
      {isDragActive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
          onDragEnter={(e: DragEvent<HTMLDivElement>) => handleDragEnter(e as unknown as DragEvent)}
          onDragLeave={(e: DragEvent<HTMLDivElement>) => handleDragLeave(e as unknown as DragEvent)}
          onDragOver={(e: DragEvent<HTMLDivElement>) => handleDragOver(e as unknown as DragEvent)}
          onDrop={(e: DragEvent<HTMLDivElement>) => handleDrop(e as unknown as DragEvent)}
        >
          <GlobalDropzoneOverlay 
            target={dropTarget} 
            isReject={isDragReject}
          />
        </div>
      )}
    </GlobalDropzoneContext.Provider>
  );
}

// ============================================================================
// Overlay Component
// ============================================================================

interface GlobalDropzoneOverlayProps {
  target: DropTarget | null;
  isReject: boolean;
}

function GlobalDropzoneOverlay({ target, isReject }: GlobalDropzoneOverlayProps) {
  const targetConfig = {
    chat: { icon: Chat, label: 'Drop to attach in chat', color: '#D4956A' },
    cowork: { icon: FolderOpen, label: 'Drop to upload to files', color: '#af52de' },
    code: { icon: Code, label: 'Drop to add to project', color: '#34c759' },
    agent: { icon: UploadSimple, label: 'Drop to use with agent', color: '#3b82f6' },
    rail: { icon: FolderOpen, label: 'Drop to quick upload', color: '#D4956A' },
    global: { icon: UploadSimple, label: 'Drop files anywhere', color: '#D4956A' },
  };

  const config = target ? targetConfig[target] : targetConfig.global;
  const Icon = isReject ? X : config.icon;
  const color = isReject ? '#ef4444' : config.color;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(43, 37, 32, 0.95)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        animation: 'dropzonePulse 0.2s ease',
        border: `3px dashed ${color}`,
        margin: 20,
        borderRadius: 24,
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes dropzonePulse {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 24,
          background: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={48} color={color} />
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: isReject ? '#ef4444' : '#faf6f1',
            margin: '0 0 8px',
          }}
        >
          {isReject ? 'File type not supported' : config.label}
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'rgba(245, 240, 232, 0.6)',
            margin: 0,
          }}
        >
          Images, PDFs, DOCX, code files (max 50MB)
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for components to register as drop targets
// ============================================================================

export function useDropTarget(target: DropTarget, handler: DropHandler) {
  const { registerDropHandler, setCurrentContext } = useGlobalDropzone();

  useEffect(() => {
    const unregister = registerDropHandler(target, handler);
    return unregister;
  }, [target, handler, registerDropHandler]);

  // Set this as current context when mounted
  useEffect(() => {
    setCurrentContext(target);
  }, [target, setCurrentContext]);
}

// ============================================================================
// Context Setter Component - for view-level context
// ============================================================================

interface DropzoneContextProps {
  context: DropTarget;
  children: ReactNode;
}

export function DropzoneContext({ context, children }: DropzoneContextProps) {
  const { setCurrentContext } = useGlobalDropzone();

  useEffect(() => {
    setCurrentContext(context);
  }, [context, setCurrentContext]);

  return <>{children}</>;
}

"use client";

import * as React from 'react';
const { useState, useEffect, useRef, useCallback, useMemo } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import type { AllternitProgram, CodePreviewState } from '../types/programs';
import { cn } from "@/lib/utils";

// Modular components
import { ProgramErrorBoundary } from '../components/ProgramErrorBoundary';
import { generateSafeHTML } from './code-preview/security';
import { ConsolePanel, type ConsoleMessage } from './code-preview/ConsolePanel';

interface CodePreviewProgramProps {
  program: AllternitProgram;
}

export const CodePreviewProgram: React.FC<CodePreviewProgramProps> = ({ program }) => {
  const store = useSidecarStore();
  const state = program.state as CodePreviewState;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // For hard reload

  const files = state?.files || [];
  const entryFile = state?.entryFile || 'index.html';
  const autoReload = state?.autoReload ?? true;

  const safeHTML = useMemo(() => generateSafeHTML(files, entryFile), [files, entryFile]);

  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'allternit-preview') return;

      if (event.data.type === 'console') {
        const newMessage: ConsoleMessage = {
          id: Math.random().toString(36).slice(2, 11),
          type: event.data.level,
          message: event.data.message,
          timestamp: event.data.timestamp || Date.now(),
        };
        setConsoleMessages(prev => [...prev, newMessage].slice(-100)); // Keep last 100
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files, entryFile, store]);

  const [prevSafeHTML, setPrevSafeHTML] = useState(safeHTML);

  if (safeHTML !== prevSafeHTML) {
    setPrevSafeHTML(safeHTML);
    if (autoReload) {
      setIframeKey(k => k + 1);
    }
  }

  const handleRefresh = useCallback(() => {
    setIframeKey(prev => prev + 1);
    setConsoleMessages([]);
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">💻</span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {entryFile}
            </h2>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">
              Preview Sandbox
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setShowConsole(!showConsole)}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-colors",
              showConsole 
                ? "bg-blue-500/10 text-blue-400 border border-solid border-blue-500/30" 
                : "text-zinc-500 hover:bg-zinc-800"
            )}
          >
            Console {consoleMessages.length > 0 && `(${consoleMessages.length})`}
          </button>
          
          <button type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            title="Reload Preview"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <ProgramErrorBoundary 
          programName="Code Preview"
          onReset={handleRefresh}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={safeHTML}
            className="flex-1 w-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Code Preview Sandbox"
          />
        </ProgramErrorBoundary>
      </div>

      {/* Console Drawer */}
      {showConsole && (
        <div className="h-1/3 min-h-[150px] shrink-0">
          <ConsolePanel 
            messages={consoleMessages} 
            onClear={() => setConsoleMessages([])} 
          />
        </div>
      )}
    </div>
  );
};

export default CodePreviewProgram;

'use client';

/**
 * Excalidraw Canvas
 *
 * Interactive whiteboard using @excalidraw/excalidraw.
 * Dynamically imported to avoid bundling when not used.
 *
 * Install to enable:
 *   pnpm add @excalidraw/excalidraw
 */

import React, { Suspense, lazy, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconPencil,
  IconDownload,
  IconUpload,
  IconLoader2,
  IconExclamationCircle,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────

type ExcalidrawElement = Record<string, unknown>;
type ExcalidrawAppState = Record<string, unknown>;
type ExcalidrawFiles = Record<string, unknown>;

interface ExcalidrawSceneData {
  elements?: readonly ExcalidrawElement[];
  appState?: ExcalidrawAppState;
  files?: ExcalidrawFiles;
  [key: string]: unknown;
}

export interface ExcalidrawCanvasProps {
  /** Initial drawing data (Excalidraw scene JSON) */
  initialData?: ExcalidrawSceneData;
  /** Callback when drawing changes */
  onChange?: (
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files?: ExcalidrawFiles
  ) => void;
  /** Callback when user requests export */
  onExport?: (data: ExcalidrawSceneData) => void;
  /** Read-only mode */
  readOnly?: boolean;
  className?: string;
  title?: string;
}

// ─── Dynamic Import ────────────────────────────────────────────────

const ExcalidrawLazy = lazy<React.ComponentType<Record<string, unknown>>>(async () => {
  try {
    const mod = await import('@excalidraw/excalidraw');
    return { default: mod.Excalidraw };
  } catch (err) {
    throw new Error('@excalidraw/excalidraw not installed');
  }
});

// ─── Main Component ────────────────────────────────────────────────

export function ExcalidrawCanvas({
  initialData,
  onChange,
  onExport,
  readOnly = false,
  className,
  title = 'Whiteboard',
}: ExcalidrawCanvasProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [sceneData, setSceneData] = useState<ExcalidrawSceneData | undefined>(initialData);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: ExcalidrawAppState,
      files?: ExcalidrawFiles
    ) => {
      setSceneData({ elements, appState, files });
      onChange?.(elements, appState, files);
    },
    [onChange]
  );

  const handleExport = useCallback(async () => {
    if (!sceneData || !onExport) return;
    setIsExporting(true);
    try {
      onExport(sceneData);
    } finally {
      setIsExporting(false);
    }
  }, [sceneData, onExport]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(String(event.target?.result));
          setSceneData(data);
        } catch {
          setLoadError('Invalid Excalidraw file');
        }
      };
      reader.readAsText(file);
    },
    []
  );

  return (
    <div
      className={cn(
        'flex h-[560px] flex-col overflow-hidden rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ui-border-muted)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <IconPencil className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="cursor-pointer rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]">
            <IconUpload className="h-3.5 w-3.5" />
            <input type="file" accept=".json,.excalidraw" className="hidden" onChange={handleFileUpload} />
          </label>
          {onExport && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {isExporting ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <IconDownload className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1">
        <Suspense fallback={<ExcalidrawLoading />}>
          <ExcalidrawLazy
            initialData={sceneData}
            onChange={handleChange}
            viewModeEnabled={readOnly}
            theme="dark"
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                export: { saveFileToDisk: true },
              },
            }}
          />
        </Suspense>

        {/* Error overlay */}
        <AnimatePresence>
          {loadError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <IconExclamationCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-[var(--text-secondary)]">{loadError}</p>
                <button
                  onClick={() => setLoadError(null)}
                  className="rounded-lg bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ExcalidrawLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        Loading whiteboard…
      </div>
    </div>
  );
}

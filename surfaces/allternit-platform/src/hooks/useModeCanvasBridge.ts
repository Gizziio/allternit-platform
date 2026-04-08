/**
 * useModeCanvasBridge.ts
 * 
 * Connects mode tab selection to canvas/renderer opening.
 * When a user selects a content mode (research, data, slides, etc),
 * this hook creates a blank artifact and opens it in the canvas.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAgentSurfaceModeStore, type AgentModeId, type AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { useSidecarStore } from '@/stores/sidecar-store';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';
import type { RendererType } from '@/views/canvas/CanvasRouter';

// Map mode IDs to artifact kinds and renderer types
const MODE_TO_ARTIFACT: Record<string, { 
  kind: ArtifactUIPart['kind']; 
  renderer: RendererType;
  defaultTitle: string;
  defaultContent: string;
}> = {
  // Content creation modes
  research: { 
    kind: 'document', 
    renderer: 'document', 
    defaultTitle: 'New Research Document',
    defaultContent: JSON.stringify([
      { type: 'heading', level: 1, content: ['New Research Document'] },
      { type: 'paragraph', content: ['Start typing your research here...'] },
    ]),
  },
  data: { 
    kind: 'sheet', 
    renderer: 'sheet', 
    defaultTitle: 'New Data Grid',
    defaultContent: '', // Will be populated with CSV structure
  },
  slides: { 
    kind: 'slides', 
    renderer: 'slides', 
    defaultTitle: 'New Presentation',
    defaultContent: JSON.stringify([
      { id: '1', type: 'title', title: 'New Presentation', subtitle: 'Click to edit' },
      { id: '2', type: 'content', title: 'Overview', content: ['Point 1', 'Point 2', 'Point 3'] },
    ]),
  },
  code: { 
    kind: 'html', 
    renderer: 'html', 
    defaultTitle: 'New Code File',
    defaultContent: '// Start coding here...',
  },
  assets: { 
    kind: 'image', 
    renderer: 'image', 
    defaultTitle: 'Asset Manager',
    defaultContent: '',
  },
  // Cowork modes
  plan: { 
    kind: 'document', 
    renderer: 'document', 
    defaultTitle: 'Project Plan',
    defaultContent: JSON.stringify([
      { type: 'heading', level: 1, content: ['Project Plan'] },
      { type: 'paragraph', content: ['Define your project milestones and tasks...'] },
    ]),
  },
  execute: { 
    kind: 'document', 
    renderer: 'document', 
    defaultTitle: 'Execution Log',
    defaultContent: JSON.stringify([
      { type: 'heading', level: 1, content: ['Execution Log'] },
      { type: 'paragraph', content: ['Track execution progress here...'] },
    ]),
  },
  review: { 
    kind: 'document', 
    renderer: 'document', 
    defaultTitle: 'Review Notes',
    defaultContent: JSON.stringify([
      { type: 'heading', level: 1, content: ['Review Notes'] },
      { type: 'paragraph', content: ['Document your review findings...'] },
    ]),
  },
  report: { 
    kind: 'document', 
    renderer: 'document', 
    defaultTitle: 'Progress Report',
    defaultContent: JSON.stringify([
      { type: 'heading', level: 1, content: ['Progress Report'] },
      { type: 'paragraph', content: ['Generate reports on project status...'] },
    ]),
  },
  automate: { 
    kind: 'html', 
    renderer: 'html', 
    defaultTitle: 'Automation Script',
    defaultContent: '# Automation workflow\n\nDefine automated tasks here...',
  },
  sync: { 
    kind: 'document', 
    renderer: 'document', 
    defaultTitle: 'Sync Status',
    defaultContent: JSON.stringify([
      { type: 'heading', level: 1, content: ['Synchronization Status'] },
      { type: 'paragraph', content: ['Track sync operations...'] },
    ]),
  },
};

// Track which modes should auto-open the canvas
const CANVAS_MODES = new Set<AgentModeId>([
  'research', 'data', 'slides', 'code', 'assets',
  'plan', 'execute', 'review', 'report', 'automate', 'sync'
]);

interface UseModeCanvasBridgeOptions {
  surface: AgentModeSurface;
  onOpenCanvas?: (artifact: ArtifactUIPart, renderer: RendererType) => void;
  autoOpen?: boolean;
}

/**
 * Hook to connect mode selection to canvas opening
 * 
 * Usage:
 * ```tsx
 * // In ChatRoot or CoworkRoot
 * useModeCanvasBridge({ surface: 'chat' });
 * ```
 */
export function useModeCanvasBridge({
  surface,
  onOpenCanvas,
  autoOpen = true,
}: UseModeCanvasBridgeOptions) {
  const { selectedModeBySurface } = useAgentSurfaceModeStore();
  const { setOpen, setActivePanel, setActiveArtifact } = useSidecarStore();
  
  const currentMode = selectedModeBySurface[surface];
  const lastModeRef = useRef<AgentModeId | null>(null);
  
  // Track processed mode+surface combinations to prevent loops
  const processedRef = useRef<Set<string>>(new Set());

  const openCanvasForMode = useCallback((modeId: AgentModeId) => {
    const config = MODE_TO_ARTIFACT[modeId];
    if (!config) return;

    // Create a blank artifact
    const artifact: ArtifactUIPart = {
      type: 'artifact',
      artifactId: `blank-${modeId}-${Date.now()}`,
      kind: config.kind,
      title: config.defaultTitle,
      content: config.defaultContent,
    };

    // Open sidecar
    setActiveArtifact(artifact.artifactId);
    setActivePanel('artifact');
    setOpen(true);

    // Call custom handler if provided
    onOpenCanvas?.(artifact, config.renderer);

    return { artifact, renderer: config.renderer };
  }, [onOpenCanvas, setActiveArtifact, setActivePanel, setOpen]);

  useEffect(() => {
    if (!autoOpen) return;
    if (!currentMode) return;
    if (!CANVAS_MODES.has(currentMode)) return;
    
    // Prevent duplicate processing
    const key = `${surface}-${currentMode}`;
    if (processedRef.current.has(key)) return;
    
    // Only process if mode actually changed
    if (lastModeRef.current === currentMode) return;
    
    // Mark as processed
    processedRef.current.add(key);
    lastModeRef.current = currentMode;
    
    // Small delay to allow UI to settle
    const timer = setTimeout(() => {
      openCanvasForMode(currentMode);
    }, 100);

    return () => clearTimeout(timer);
  }, [currentMode, surface, autoOpen, openCanvasForMode]);

  return {
    currentMode,
    openCanvasForMode,
    canOpenCanvas: currentMode ? CANVAS_MODES.has(currentMode) : false,
  };
}

/**
 * Get the renderer type for a given mode
 */
export function getRendererForMode(modeId: AgentModeId): RendererType | null {
  return MODE_TO_ARTIFACT[modeId]?.renderer || null;
}

/**
 * Check if a mode should open the canvas
 */
export function isCanvasMode(modeId: AgentModeId): boolean {
  return CANVAS_MODES.has(modeId);
}

export default useModeCanvasBridge;

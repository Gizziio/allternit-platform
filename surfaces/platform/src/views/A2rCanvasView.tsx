/**
 * A2rCanvasView.tsx
 * 
 * Main Canvas view for A2rchitech - "The Computer"
 * A split-pane surface that renders rich artifacts (documents, slides, sheets, code, media)
 * alongside the chat/conversation that generated them.
 * 
 * Mental Model: This is not just a viewer - it's the computer itself,
 * hosting specialized "programs" (renderers) for different content types.
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowsOut,
  ArrowsIn,
  Columns,
  Rows,
  MonitorPlay,
  Sparkle,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { Button } from '@/components/ui/button';
import { CanvasRouter } from './canvas/CanvasRouter';
import { CanvasToolbar } from './canvas/CanvasToolbar';
import { CreativeCockpit } from './canvas/components/CreativeCockpit';
import { A2rDriveSidebar } from './canvas/components/A2rDriveSidebar';
import { useCanvasStream } from './canvas/hooks/useCanvasStream';
import { useCanvasLayout } from './canvas/hooks/useCanvasLayout';
import type { ArtifactKind } from '@/lib/ai/ui-parts.types';
import type { RendererType } from './canvas/CanvasRouter';
import { cn } from '@/lib/utils';

interface A2rCanvasViewProps {
  /** Initial artifact to display */
  initialArtifactId?: string;
  /** Parent view context (chat, cowork, code, browser) */
  sourceView: 'chat' | 'cowork' | 'code' | 'browser';
  /** Session/chat ID for context */
  sessionId?: string;
  /** Enable MoA (Mixture of Agents) mode */
  moaEnabled?: boolean;
}

export function A2rCanvasView({
  initialArtifactId,
  sourceView,
  sessionId,
  moaEnabled = false,
}: A2rCanvasViewProps) {
  // Layout state
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [showChat, setShowChat] = useState(true);
  const [showDrive, setShowDrive] = useState(false);
  const [fullscreenCanvas, setFullscreenCanvas] = useState(false);
  
  // Canvas state
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(initialArtifactId || null);
  const [activeRenderer, setActiveRenderer] = useState<ArtifactKind | null>(null);
  
  // MoA state
  const [moaTasks, setMoaTasks] = useState<Array<{
    id: string;
    type: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    progress?: number;
    title: string;
  }>>([]);

  // Hooks
  const { 
    artifacts, 
    activeArtifact, 
    streamStatus, 
    handleArtifactSelect,
    handleStreamUpdate 
  } = useCanvasStream({
    sessionId,
    initialArtifactId,
  });

  const {
    panelSizes,
    setPanelSize,
    toggleLayout,
    saveLayout,
    loadLayout,
  } = useCanvasLayout({
    defaultChatSize: 30,
    defaultCanvasSize: 70,
  });

  // Load saved layout on mount
  useEffect(() => {
    const saved = loadLayout(sourceView);
    if (saved) {
      setLayoutMode(saved.layoutMode);
      setPanelSize('chat', saved.chatSize);
    }
  }, [sourceView, loadLayout, setPanelSize]);

  // Save layout on unmount
  useEffect(() => {
    return () => {
      saveLayout(sourceView, {
        layoutMode,
        chatSize: panelSizes.chat,
        canvasSize: panelSizes.canvas,
      });
    };
  }, [sourceView, layoutMode, panelSizes, saveLayout]);

  // Handle artifact selection from stream
  const handleArtifactStreamed = useCallback((artifactId: string, kind: ArtifactKind) => {
    setActiveArtifactId(artifactId);
    setActiveRenderer(kind);
    
    // Auto-expand canvas if hidden
    if (!showChat && layoutMode === 'horizontal') {
      setPanelSize('canvas', 100);
    }
  }, [showChat, layoutMode, setPanelSize]);

  // Handle MoA task updates (from parent or stream)
  const handleMoATaskUpdate = useCallback((tasks: Array<{
    id: string;
    type: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    progress?: number;
    title: string;
  }>) => {
    setMoaTasks(tasks);
  }, []);

  // Layout toggle handlers
  const handleToggleLayout = useCallback(() => {
    toggleLayout();
  }, [toggleLayout]);

  const handleToggleChat = useCallback(() => {
    setShowChat(prev => !prev);
    if (showChat) {
      setPanelSize('canvas', 100);
    } else {
      setPanelSize('chat', 30);
      setPanelSize('canvas', 70);
    }
  }, [showChat, setPanelSize]);

  const handleToggleDrive = useCallback(() => {
    setShowDrive(prev => !prev);
  }, []);

  const handleFullscreen = useCallback(() => {
    setFullscreenCanvas(prev => !prev);
  }, []);

  // Render toolbar
  const renderToolbar = useMemo(() => (
    <CanvasToolbar
      layoutMode={layoutMode}
      showChat={showChat}
      showDrive={showDrive}
      fullscreen={fullscreenCanvas}
      activeRenderer={activeRenderer}
      onToggleLayout={handleToggleLayout}
      onToggleChat={handleToggleChat}
      onToggleDrive={handleToggleDrive}
      onFullscreen={handleFullscreen}
      artifactCount={artifacts.length}
    />
  ), [
    layoutMode,
    showChat,
    showDrive,
    fullscreenCanvas,
    activeRenderer,
    handleToggleLayout,
    handleToggleChat,
    handleToggleDrive,
    handleFullscreen,
    artifacts.length,
  ]);

  // If fullscreen, render only canvas
  if (fullscreenCanvas && activeArtifact) {
    return (
      <GlassSurface className="h-full w-full flex flex-col">
        {/* Fullscreen toolbar */}
        <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullscreenCanvas(false)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <CaretLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {activeArtifact.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleDrive}
              className={cn(
                "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
                showDrive && "text-[var(--accent-primary)]"
              )}
            >
              <MonitorPlay size={16} />
            </Button>
          </div>
        </div>

        {/* Fullscreen canvas */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CanvasRouter
              artifact={activeArtifact}
              rendererType={activeRenderer as RendererType}
              sessionId={sessionId}
            />
          </div>
          
          {/* Drive sidebar overlay */}
          <AnimatePresence>
            {showDrive && (
              <motion.div
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-80 border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                <A2rDriveSidebar
                  sessionId={sessionId}
                  onSelectArtifact={handleArtifactSelect}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassSurface>
    );
  }

  // Normal split-pane layout
  return (
    <GlassSurface className="h-full w-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      {renderToolbar}

      {/* MoA Creative Cockpit (if tasks active) */}
      <AnimatePresence>
        {moaTasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
          >
            <CreativeCockpit tasks={moaTasks} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main split-pane area */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup
          direction={layoutMode === 'horizontal' ? 'horizontal' : 'vertical'}
          autoSaveId={`a2r-canvas-${sourceView}`}
        >
          {/* Chat/Conversation Panel */}
          {showChat && (
            <Panel
              defaultSize={panelSizes.chat}
              minSize={20}
              className="bg-[var(--bg-primary)] border-r border-[var(--border-subtle)]"
            >
              <div className="h-full flex flex-col">
                {/* Chat header */}
                <div className="h-10 border-b border-[var(--border-subtle)] flex items-center justify-between px-4">
                  <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    {sourceView === 'chat' && 'Chat'}
                    {sourceView === 'cowork' && 'Cowork'}
                    {sourceView === 'code' && 'Code'}
                    {sourceView === 'browser' && 'Browser'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleChat}
                    className="h-6 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <Columns className="w-3 h-3 mr-1" />
                    Hide
                  </Button>
                </div>
                
                {/* Chat content - embed parent view's chat component */}
                <div className="flex-1 overflow-hidden">
                  {/* This would embed the actual chat component from parent view */}
                  <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-sm">
                    [Chat Component Embedded from {sourceView}]
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* Resize handle */}
          {showChat && (
            <PanelResizeHandle className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--accent-primary)] transition-colors" />
          )}

          {/* Canvas Panel */}
          <Panel
            defaultSize={panelSizes.canvas}
            minSize={30}
            className="bg-[var(--bg-secondary)] overflow-hidden"
          >
            {activeArtifact ? (
              <CanvasRouter
                artifact={activeArtifact}
                rendererType={activeRenderer as RendererType}
                sessionId={sessionId}
                onMoATaskUpdate={handleMoATaskUpdate}
              />
            ) : (
              <EmptyCanvasState sourceView={sourceView} />
            )}
          </Panel>

          {/* Drive Panel (optional right rail) */}
          <AnimatePresence>
            {showDrive && (
              <>
                <PanelResizeHandle className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--accent-primary)] transition-colors" />
                <Panel
                  defaultSize={15}
                  minSize={10}
                  maxSize={25}
                  className="bg-[var(--bg-secondary)] border-l border-[var(--border-subtle)]"
                >
                  <A2rDriveSidebar
                    sessionId={sessionId}
                    onSelectArtifact={handleArtifactSelect}
                    onClose={handleToggleDrive}
                  />
                </Panel>
              </>
            )}
          </AnimatePresence>
        </PanelGroup>
      </div>
    </GlassSurface>
  );
}

// Empty state when no artifact is active
function EmptyCanvasState({ sourceView }: { sourceView: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
      <div className="max-w-md text-center space-y-4">
        <Sparkle className="w-12 h-12 mx-auto opacity-50" />
        <h3 className="text-lg font-medium text-[var(--text-primary)]">
          Canvas Ready
        </h3>
        <p className="text-sm">
          Start creating in {sourceView} and your artifacts will appear here.
          <br />
          Documents, code, slides, sheets, and media will render in full detail.
        </p>
        <div className="pt-4 flex items-center justify-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            Cmd+Shift+C to toggle
          </span>
          <span className="px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            Drag to resize
          </span>
        </div>
      </div>
    </div>
  );
}

export default A2rCanvasView;

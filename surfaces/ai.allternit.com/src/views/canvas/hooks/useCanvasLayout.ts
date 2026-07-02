/**
 * useCanvasLayout.ts
 * 
 * Hook for managing Allternit-Canvas layout state and persistence.
 * Handles panel sizes, layout mode, and localStorage persistence.
 */

import { useState, useCallback } from 'react';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('UseCanvasLayout');

interface LayoutState {
  layoutMode: 'horizontal' | 'vertical';
  chatSize: number;
  canvasSize: number;
}

interface UseCanvasLayoutOptions {
  defaultChatSize?: number;
  defaultCanvasSize?: number;
}

const LAYOUT_STORAGE_KEY = 'allternit-canvas-layout';

export function useCanvasLayout({
  defaultChatSize = 30,
  defaultCanvasSize = 70,
}: UseCanvasLayoutOptions) {
  // State
  const [panelSizes, setPanelSizes] = useState({
    chat: defaultChatSize,
    canvas: defaultCanvasSize,
  });

  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal');

  // Load layout from localStorage
  const loadLayout = useCallback((sourceView: string): LayoutState | null => {
    try {
      const stored = localStorage.getItem(`${LAYOUT_STORAGE_KEY}-${sourceView}`);
      if (stored) {
        const parsed = JSON.parse(stored) as LayoutState;
        return parsed;
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to load layout');
    }
    return null;
  }, []);

  // Save layout to localStorage
  const saveLayout = useCallback((sourceView: string, layout: Partial<LayoutState>) => {
    try {
      const stored = localStorage.getItem(`${LAYOUT_STORAGE_KEY}-${sourceView}`);
      const current = stored ? JSON.parse(stored) as LayoutState : null;
      
      const next: LayoutState = {
        layoutMode: layout.layoutMode || current?.layoutMode || 'horizontal',
        chatSize: layout.chatSize || current?.chatSize || defaultChatSize,
        canvasSize: layout.canvasSize || current?.canvasSize || defaultCanvasSize,
      };
      
      localStorage.setItem(`${LAYOUT_STORAGE_KEY}-${sourceView}`, JSON.stringify(next));
    } catch (error) {
      logger.error({ err: error }, 'Failed to save layout');
    }
  }, [defaultChatSize, defaultCanvasSize]);

  // Toggle layout mode
  const toggleLayout = useCallback(() => {
    setLayoutMode(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
  }, []);

  // Set panel size
  const setPanelSize = useCallback((panel: 'chat' | 'canvas', size: number) => {
    setPanelSizes(prev => ({
      ...prev,
      [panel]: Math.max(10, Math.min(90, size)), // Clamp between 10-90%
    }));
  }, []);

  // Handle panel resize
  const handlePanelResize = useCallback((panel: 'chat' | 'canvas', size: number) => {
    setPanelSize(panel, size);
  }, [setPanelSize]);

  // Reset layout to defaults
  const resetLayout = useCallback(() => {
    setPanelSizes({
      chat: defaultChatSize,
      canvas: defaultCanvasSize,
    });
    setLayoutMode('horizontal');
  }, [defaultChatSize, defaultCanvasSize]);

  return {
    // State
    panelSizes,
    layoutMode,
    
    // Actions
    setPanelSize,
    handlePanelResize,
    toggleLayout,
    saveLayout,
    loadLayout,
    resetLayout,
  };
}

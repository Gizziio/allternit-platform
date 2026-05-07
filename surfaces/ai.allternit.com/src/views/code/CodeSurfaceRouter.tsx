"use client";

import React from 'react';
import {
  useCodeModeStore,
  getActiveWorkspace,
  getWorkspaceLayoutMode,
} from './CodeModeStore';
import { CodeThreadView } from './CodeThreadView';
import { CodeCanvasView } from './CodeCanvasView';
import { CodeTldrawCanvas } from './CodeTldrawCanvas';

export function CodeSurfaceRouter() {
  const state = useCodeModeStore();
  const activeWorkspace = getActiveWorkspace(state);
  const layoutMode = getWorkspaceLayoutMode(activeWorkspace);

  if (layoutMode === 'canvas') {
    return <CodeCanvasView workspace={activeWorkspace} />;
  }

  if (layoutMode === 'tldraw') {
    return <CodeTldrawCanvas workspace={activeWorkspace} />;
  }

  return <CodeThreadView workspace={activeWorkspace} />;
}

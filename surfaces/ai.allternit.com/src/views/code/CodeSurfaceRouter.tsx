"use client";

import React from 'react';
import {
  useCodeModeStore,
  getActiveWorkspace,
  getWorkspaceLayoutMode,
} from './CodeModeStore';
import { CodeThreadView } from './CodeThreadView';
import { CodeCanvasView } from './CodeCanvasView';

export function CodeSurfaceRouter(): JSX.Element {
  const state = useCodeModeStore();
  const activeWorkspace = getActiveWorkspace(state);
  const layoutMode = getWorkspaceLayoutMode(activeWorkspace);

  if (layoutMode === 'canvas') {
    return <CodeCanvasView workspace={activeWorkspace} />;
  }

  return <CodeThreadView workspace={activeWorkspace} />;
}

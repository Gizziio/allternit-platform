"use client";

import React from 'react';
import { UnifiedTerminal } from '@/components/workspace/UnifiedTerminal';

interface CodeCanvasTileTerminalProps {
  terminalId: string;
  sessionId?: string;
  workspacePath?: string;
}

/**
 * Canvas terminal backed by the same production terminal surface used by the
 * Code side pane and console drawer. Keeping one implementation means canvas
 * terminals get the real session lifecycle, reconnect controls, multiple tabs,
 * input handling, resizing, and theme updates instead of a second partial
 * terminal client.
 */
export function CodeCanvasTileTerminal({
  terminalId,
  sessionId,
  workspacePath,
}: CodeCanvasTileTerminalProps) {
  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <UnifiedTerminal
        sessionId={`canvas:${terminalId}:${sessionId || 'workspace'}`}
        workingDir={workspacePath}
      />
    </div>
  );
}

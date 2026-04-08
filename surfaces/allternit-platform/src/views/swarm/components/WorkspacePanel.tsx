/**
 * WorkspacePanel - Draggable, collapsible side panel
 *
 * Features:
 * - Drag to resize (200-500px, auto-collapse < 100px)
 * - Double-click handle to collapse/expand
 * - Collapse trigger strip (always accessible when collapsed)
 * - Batch actions toolbar
 * - Task list display
 *
 * Based on demo-v5.html design
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS, STATUS } from '@/design/allternit.tokens';
import { SwarmAgent } from '../types';
import { useBatchSelection } from '../SwarmMonitor.store';

interface WorkspacePanelProps {
  agents: SwarmAgent[];
  modeColors: {
    accent: string;
    soft: string;
    border: string;
  };
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const COLLAPSE_THRESHOLD = 100;
const DEFAULT_WIDTH = 256;

export function WorkspacePanel({ agents, modeColors }: WorkspacePanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const {
    isBatchMode,
    selectedIds,
    toggleBatchMode,
    deselectAll,
    batchRestart,
    batchStop,
  } = useBatchSelection();

  // Mouse event handlers for resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return;
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isCollapsed, width]);

  const handleDoubleClick = useCallback(() => {
    if (isCollapsed) {
      // Expand
      setIsCollapsed(false);
      setWidth(DEFAULT_WIDTH);
    } else {
      // Collapse
      setIsCollapsed(true);
      setWidth(0);
    }
  }, [isCollapsed]);

  // Global mouse move/up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const diff = startX.current - e.clientX;
      let newWidth = startWidth.current + diff;

      // Auto-collapse if dragged too narrow
      if (newWidth < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setWidth(0);
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        return;
      }

      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Expand panel from collapsed state
  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
    setWidth(DEFAULT_WIDTH);
  }, []);

  // Batch action handlers
  const handleBatchRestart = useCallback(() => {
    batchRestart();
    deselectAll();
  }, [batchRestart, deselectAll]);

  const handleBatchStop = useCallback(() => {
    batchStop();
    deselectAll();
  }, [batchStop, deselectAll]);

  // Calculate selected count
  const selectedCount = selectedIds.size;

  return (
    <>
      {/* Main Panel */}
      <aside
        ref={panelRef}
        className="flex flex-col border-l relative shrink-0"
        style={{
          width: isCollapsed ? 0 : width,
          minWidth: isCollapsed ? 0 : MIN_WIDTH,
          maxWidth: MAX_WIDTH,
          background: '#121110',
          borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Resize Handle */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-20 transition-all ${
            isResizing ? 'bg-orange-500/30' : ''
          }`}
          style={{
            display: isCollapsed ? 'none' : 'block',
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize, double-click to collapse"
        >
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded transition-all"
            style={{
              background: isResizing ? modeColors.accent : '#5c5854',
              opacity: isResizing ? 1 : 0,
            }}
          />
        </div>

        {/* Panel Content (only visible when not collapsed) */}
        {!isCollapsed && (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <span className="text-xs font-medium" style={{ color: TEXT.primary }}>
                Workspace
              </span>
              <button
                onClick={() => {/* Show create task modal */}}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-white/5"
                style={{
                  background: `${modeColors.accent}20`,
                  color: modeColors.accent,
                  border: `1px solid ${modeColors.accent}40`,
                }}
              >
                <Plus size={10} weight="bold" />
                Task
              </button>
            </div>

            {/* Tasks List */}
            <div className="flex-1 overflow-auto p-3 min-w-[200px]">
              {/* Task items would go here */}
              <div className="text-xs" style={{ color: TEXT.tertiary }}>
                No tasks in workspace
              </div>
            </div>

            {/* Batch Actions (shown when batch mode is active) */}
            {isBatchMode && selectedCount > 0 && (
              <div
                className="p-3 border-t shrink-0"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: `${modeColors.accent}10`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: modeColors.accent }}>
                    {selectedCount} selected
                  </span>
                  <button
                    onClick={deselectAll}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: TEXT.tertiary }}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBatchRestart}
                    className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                    style={{
                      background: `${modeColors.accent}20`,
                      color: modeColors.accent,
                      border: `1px solid ${modeColors.accent}40`,
                    }}
                  >
                    Restart
                  </button>
                  <button
                    onClick={handleBatchStop}
                    className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                    style={{
                      background: '#ef44441a',
                      color: STATUS.error,
                      border: '1px solid rgba(239,68,68,0.4c)',
                    }}
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </aside>

      {/* Collapse Trigger (visible when panel is collapsed) */}
      {isCollapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-3 cursor-pointer z-10 flex items-center justify-center transition-all hover:w-4 shrink-0"
          onClick={handleExpand}
          title="Click to expand"
          style={{
            background: '#121110',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            className="text-lg"
            style={{ color: TEXT.tertiary }}
          >
            ‹
          </span>
        </div>
      )}
    </>
  );
}

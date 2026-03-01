"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRunnerStore } from "../runner/runner.store";
import { AgentRunnerPanel } from "../runner/AgentRunnerPanel";
import { GripHorizontal, Minimize2, X } from "lucide-react";

// Import the new invoke bar
import { AgentInvokeBar } from "../runner/AgentInvokeBar";

export function ShellOverlayLayer() {
  const { open, mode, toggle, close } = useRunnerStore();
  
  // Position and size state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; initialWidth: number; initialHeight: number } | null>(null);

  // Center window when opened
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      const defaultWidth = mode === "compact" ? 700 : 900;
      const defaultHeight = mode === "compact" ? 200 : 600;
      setSize({ width: defaultWidth, height: defaultHeight });
      setPosition({
        x: Math.max(20, (window.innerWidth - defaultWidth) / 2),
        y: Math.max(20, (window.innerHeight - defaultHeight) / 3)
      });
    }
  }, [open, mode]);

  // Mouse event handlers for drag/resize
  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newX = Math.max(10, Math.min(window.innerWidth - size.width - 10, dragRef.current.initialX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - size.height - 10, dragRef.current.initialY + dy));
        setPosition({ x: newX, y: newY });
      }
      if (isResizing && resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        const newWidth = Math.max(400, Math.min(window.innerWidth - position.x - 20, resizeRef.current.initialWidth + dx));
        const newHeight = Math.max(300, Math.min(window.innerHeight - position.y - 20, resizeRef.current.initialHeight + dy));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      dragRef.current = null;
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, open, size.width, size.height, position.x, position.y]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.overlay-close') || 
        (e.target as HTMLElement).closest('.overlay-resize') ||
        (e.target as HTMLElement).closest('.overlay-collapse') ||
        (e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('input') ||
        (e.target as HTMLElement).closest('textarea')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: size.width,
      initialHeight: size.height
    };
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={close}
      />
      
      {/* Floating Agent Runner Window */}
      <div
        className="absolute rounded-xl overflow-hidden shadow-2xl border bg-background flex flex-col pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          width: mode === "compact" ? 700 : size.width,
          height: mode === "compact" ? "auto" : size.height,
          minHeight: mode === "compact" ? 140 : 400,
          maxHeight: mode === "compact" ? 600 : window.innerHeight - 40,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Agent Runner</span>
            {mode === "compact" && <span className="text-xs text-muted-foreground">— Press Enter to run</span>}
          </div>
          
          <div className="flex items-center gap-1">
            {mode === "expanded" && (
              <button
                onClick={toggle}
                className="overlay-collapse p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Collapse"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={close}
              className="overlay-close p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={mode === "expanded" ? "flex-1 overflow-hidden" : "p-4"}>
          {mode === "compact" ? (
            <AgentInvokeBar onExpand={toggle} />
          ) : (
            <AgentRunnerPanel onCollapse={toggle} />
          )}
        </div>

        {/* Resize Handle (only in expanded mode) */}
        {mode === "expanded" && (
          <div
            className="overlay-resize absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1"
            onMouseDown={handleResizeStart}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground/50">
              <path d="M8 8L12 12M4 12L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

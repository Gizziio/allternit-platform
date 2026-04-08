"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePanels, useResponsiveLayout } from './useLayout';
import { PanelConfig } from './layout-context';
import {
  X,
  Sidebar,
  SidebarSimple,
  Rows,
  ArrowsOut,
  ArrowsIn,
  DotsSixVertical,
  DotsNine,
} from '@phosphor-icons/react';

// =============================================================================
// Types
// =============================================================================

export interface PanelContainerProps {
  position: 'left' | 'right' | 'bottom';
  panels?: PanelConfig[];
}

// =============================================================================
// PanelContainer Component
// =============================================================================

export function PanelContainer({ position, panels: panelConfigs = [] }: PanelContainerProps) {
  const { left, right, bottom, anyOpen } = usePanels();
  const { isMobile } = useResponsiveLayout();
  const containerRef = useRef<HTMLDivElement>(null);

  // Get the correct panel state based on position
  const panelState = position === 'left' ? left : position === 'right' ? right : bottom;
  const { isOpen, size, toggle, setOpen, setSize } = panelState;

  // Calculate dimensions based on position
  const isHorizontal = position === 'left' || position === 'right';
  
  // Convert percentage to pixels for resizing
  const getPixelSize = useCallback(() => {
    if (!containerRef.current?.parentElement) return 300;
    const parent = containerRef.current.parentElement;
    const parentSize = isHorizontal ? parent.clientWidth : parent.clientHeight;
    return (size / 100) * parentSize;
  }, [size, isHorizontal]);

  const [pixelSize, setPixelSize] = useState(getPixelSize());

  // Update pixel size when container resizes
  useEffect(() => {
    const updateSize = () => setPixelSize(getPixelSize());
    updateSize();
    
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current?.parentElement) {
      observer.observe(containerRef.current.parentElement);
    }
    
    return () => observer.disconnect();
  }, [getPixelSize]);

  // Don't render if not open or on mobile (mobile uses different patterns)
  if (!isOpen || isMobile) {
    return null;
  }

  // Default panels if none provided
  const panels = panelConfigs.length > 0 ? panelConfigs : [
    {
      id: `${position}-panel-1`,
      title: position === 'left' ? 'Explorer' : position === 'right' ? 'Inspector' : 'Terminal',
      content: <DefaultPanelContent position={position} />,
    },
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        'panel-container flex shrink-0',
        'bg-background/95 backdrop-blur-sm',
        'border-white/10',
        isHorizontal ? 'flex-row' : 'flex-col',
        position === 'left' && 'border-r',
        position === 'right' && 'border-l',
        position === 'bottom' && 'border-t'
      )}
      style={{
        [isHorizontal ? 'width' : 'height']: `${size}%`,
        minWidth: isHorizontal ? 200 : undefined,
        minHeight: !isHorizontal ? 150 : undefined,
        maxWidth: isHorizontal ? '50%' : undefined,
        maxHeight: !isHorizontal ? '60%' : undefined,
      }}
    >
      {/* Resize Handle */}
      <ResizeHandle 
        position={position} 
        onResize={(delta) => {
          const parent = containerRef.current?.parentElement;
          if (!parent) return;
          
          const parentSize = isHorizontal ? parent.clientWidth : parent.clientHeight;
          const currentPixelSize = (size / 100) * parentSize;
          
          // Adjust delta based on position
          let adjustedDelta = delta;
          if (position === 'left' || position === 'bottom') {
            adjustedDelta = -delta;
          }
          
          const newPixelSize = Math.max(150, Math.min(parentSize * 0.5, currentPixelSize + adjustedDelta));
          const newPercentage = (newPixelSize / parentSize) * 100;
          
          setSize(newPercentage);
        }}
        onDoubleClick={toggle}
      />

      {/* Panel Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {panels.map((panel, index) => (
          <Panel 
            key={panel.id} 
            config={panel} 
            isFirst={index === 0}
            isLast={index === panels.length - 1}
            onClose={() => setOpen(false)}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ResizeHandle Component
// =============================================================================

interface ResizeHandleProps {
  position: 'left' | 'right' | 'bottom';
  onResize: (delta: number) => void;
  onDoubleClick: () => void;
}

function ResizeHandle({ position, onResize, onDoubleClick }: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef(0);
  const isHorizontal = position === 'left' || position === 'right';

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = isHorizontal ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize, isHorizontal]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startPos.current = isHorizontal ? e.clientX : e.clientY;
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center',
        'hover:bg-accent/50 transition-colors',
        isResizing && 'bg-accent',
        isHorizontal ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize',
        position === 'left' && 'order-2',
        position === 'right' && 'order-1',
        position === 'bottom' && 'order-1'
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {isHorizontal ? (
        <DotsSixVertical className="w-3 h-3 text-muted-foreground/50" />
      ) : (
        <DotsNine className="w-3 h-3 text-muted-foreground/50" />
      )}
    </div>
  );
}

// =============================================================================
// Panel Component
// =============================================================================

interface PanelProps {
  config: PanelConfig;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
}

function Panel({ config, isFirst, isLast, onClose }: PanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div 
      className={cn(
        'flex-1 flex flex-col min-h-0',
        !isLast && 'border-b border-white/10'
      )}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-muted/30">
        <div className="flex items-center gap-2">
          {config.icon && (
            <span className="text-muted-foreground">
              {/* Icon would be rendered here */}
            </span>
          )}
          <span className="text-sm font-medium">{config.title}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded hover:bg-accent transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <ArrowsIn className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ArrowsOut className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-auto p-3">
        {config.content || <DefaultPanelContent position="left" />}
      </div>
    </div>
  );
}

// =============================================================================
// DefaultPanelContent Component
// =============================================================================

function DefaultPanelContent({ position }: { position: 'left' | 'right' | 'bottom' }) {
  const content = {
    left: {
      icon: Sidebar,
      title: 'Explorer Panel',
      description: 'This is the left panel. Use it for file explorers, project navigation, or other primary sidebar content.',
    },
    right: {
      icon: SidebarSimple,
      title: 'Inspector Panel',
      description: 'This is the right panel. Use it for property inspectors, details views, or secondary information.',
    },
    bottom: {
      icon: Rows,
      title: 'Bottom Panel',
      description: 'This is the bottom panel. Use it for terminals, logs, output consoles, or debug information.',
    },
  };

  const { icon: Icon, title, description } = content[position];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
      <Icon className="w-12 h-12 mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-sm max-w-xs">{description}</p>
    </div>
  );
}

// =============================================================================
// PanelToggleButton Component
// =============================================================================

export interface PanelToggleButtonProps {
  position: 'left' | 'right' | 'bottom';
  className?: string;
}

export function PanelToggleButton({ position, className }: PanelToggleButtonProps) {
  const { left, right, bottom } = usePanels();
  const panel = position === 'left' ? left : position === 'right' ? right : bottom;
  
  const icons = {
    left: Sidebar,
    right: SidebarSimple,
    bottom: Rows,
  };
  
  const Icon = icons[position];
  const label = position.charAt(0).toUpperCase() + position.slice(1);

  return (
    <button
      onClick={panel.toggle}
      className={cn(
        'p-2 rounded-md transition-colors',
        'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
        panel.isOpen && 'bg-accent text-foreground',
        className
      )}
      title={`Toggle ${label} Panel`}
      aria-label={`Toggle ${label} Panel`}
      aria-pressed={panel.isOpen}
    >
      <Icon size={20} />
    </button>
  );
}

// =============================================================================
// PanelGroup Component
// =============================================================================

export interface PanelGroupProps {
  children: React.ReactNode;
  direction: 'horizontal' | 'vertical';
  className?: string;
}

export function PanelGroup({ children, direction, className }: PanelGroupProps) {
  return (
    <div 
      className={cn(
        'flex h-full',
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
    >
      {children}
    </div>
  );
}

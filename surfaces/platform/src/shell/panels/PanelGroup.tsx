/**
 * PanelGroup Component
 * 
 * A wrapper around react-resizable-panels PanelGroup with A2R styling.
 * Provides horizontal or vertical panel layout with glass surface styling.
 * 
 * @module @allternit/platform/shell/panels
 */

import React from 'react';
import { PanelGroup as ResizablePanelGroup } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export interface PanelGroupProps {
  /** Direction of panel layout */
  direction: 'horizontal' | 'vertical';
  /** Child panels and resize handles */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Auto save panel layout to localStorage key */
  autoSaveId?: string;
}

/**
 * PanelGroup - Container for resizable panels
 * 
 * @example
 * ```tsx
 * <PanelGroup direction="horizontal">
 *   <WorkspacePanel id="left" title="Explorer" defaultSize={20}>
 *     <FileExplorer />
 *   </WorkspacePanel>
 *   <PanelResizeHandle direction="horizontal" />
 *   <Panel defaultSize={80}>
 *     <Editor />
 *   </Panel>
 * </PanelGroup>
 * ```
 */
export function PanelGroup({ 
  direction, 
  children, 
  className,
  autoSaveId,
}: PanelGroupProps) {
  return (
    <ResizablePanelGroup
      direction={direction}
      autoSaveId={autoSaveId}
      className={cn(
        'flex h-full w-full',
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className
      )}
    >
      {children}
    </ResizablePanelGroup>
  );
}

export default PanelGroup;

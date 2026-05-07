/**
 * Workspace Panels System
 *
 * A resizable, draggable panel system for the IDE-like workspace.
 * Built on top of react-resizable-panels with glass styling and animation support.
 *
 * @module @allternit/platform/shell/panels
 */

// Core panel components
export { PanelGroup } from './PanelGroup';
export { WorkspacePanel } from './Panel';
export { PanelHeader } from './PanelHeader';

// Re-export react-resizable-panels types for convenience
export type { PanelProps, PanelGroupProps as ResizablePanelGroupProps } from 'react-resizable-panels';

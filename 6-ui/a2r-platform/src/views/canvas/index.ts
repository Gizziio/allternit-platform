/**
 * Canvas Module Exports
 * 
 * Central export point for all A2r-Canvas components.
 */

// Main view
// Note: A2rCanvasView should be imported from its actual location
// export { A2rCanvasView } from './A2rCanvasView';

// Core components
export { CanvasRouter } from './CanvasRouter';
export { CanvasToolbar } from './CanvasToolbar';

// Renderers
export { DocumentRenderer } from './renderers/DocumentRenderer';
export { SlidesRenderer } from './renderers/SlidesRenderer';
export { SheetsRenderer } from './renderers/SheetsRenderer';
export { CodeRenderer } from './renderers/CodeRenderer';
export { ImageRenderer } from './renderers/ImageRenderer';
export { VideoRenderer } from './renderers/VideoRenderer';
export { AudioRenderer } from './renderers/AudioRenderer';
export { MermaidRenderer } from './renderers/MermaidRenderer';

// Feature components
export { CreativeCockpit } from './components/CreativeCockpit';
export { A2rDriveSidebar } from './components/A2rDriveSidebar';

// Hooks
export { useCanvasStream } from './hooks/useCanvasStream';
export { useCanvasLayout } from './hooks/useCanvasLayout';

// Types
export type { RendererType } from './CanvasRouter';
export type { AssetType } from './components/A2rDriveSidebar';

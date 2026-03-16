/**
 * A2rchitect Super-Agent OS - Programs Index
 * 
 * Re-exports all program implementations for the A2rOS system.
 */

export { ResearchDocProgram } from './ResearchDocProgram';
export { DataGridProgram } from './DataGridProgram';
export { PresentationProgram } from './PresentationProgram';
export { CodePreviewProgram } from './CodePreviewProgram';
export { AssetManagerProgram } from './AssetManagerProgram';
export { OrchestratorProgram } from './OrchestratorProgram';
export { WorkflowBuilderProgram } from './WorkflowBuilderProgram';
export { CitationManager } from './BrowserScreenshotCitations';
export {
  ImageStudioProgram,
  AudioStudioProgram,
  TelephonyProgram,
  BrowserProgram,
} from './OtherPrograms';

// Program registry for dynamic loading
export const PROGRAM_REGISTRY = {
  'research-doc': () => import('./ResearchDocProgram').then(m => m.ResearchDocProgram),
  'data-grid': () => import('./DataGridProgram').then(m => m.DataGridProgram),
  'presentation': () => import('./PresentationProgram').then(m => m.PresentationProgram),
  'code-preview': () => import('./CodePreviewProgram').then(m => m.CodePreviewProgram),
  'asset-manager': () => import('./AssetManagerProgram').then(m => m.AssetManagerProgram),
  'orchestrator': () => import('./OrchestratorProgram').then(m => m.OrchestratorProgram),
  'workflow-builder': () => import('./WorkflowBuilderProgram').then(m => m.WorkflowBuilderProgram),
} as const;

export type ProgramComponentType = keyof typeof PROGRAM_REGISTRY;

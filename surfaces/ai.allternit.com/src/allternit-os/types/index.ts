/**
 * allternit Super-Agent OS - Types Index
 * 
 * Central export point for all type definitions.
 */

export { type Agent, type AllternitProgram, type AllternitProgramState, type AllternitProgramStatus, type AllternitProgramType, type AllternitProgramUri, type AssetManagerItem, type AssetManagerState, type AudioStudioSegment, type AudioStudioState, type AudioStudioVoice, type CodePreviewFile, type CodePreviewState, type DataGridColumn, type DataGridRow, type DataGridState, type DataGridVisualization, type ImageStudioLayer, type ImageStudioState, type KernelProgramCommand, type KernelProgramEvent, type LaunchProgramRequest, type OrchestratorAgent, type OrchestratorState, type OrchestratorTaskGraph, type PresentationSlide, type PresentationState, type PresentationTheme, type ProgramEvent, type ResearchDocCitation, type ResearchDocEvidence, type ResearchDocSection, type ResearchDocState, type StreamingChunk, type TaskNode, type TelephonyCall, type TelephonyState, buildAllternitUri, parseAllternitUri } from './programs';

// Electron API types (side-effect: extends global Window)
import './electron';

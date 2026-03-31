/**
 * A2rchitect Super-Agent OS - Program Types
 * 
 * Core type system for the Utility Pane (A2rCanvas).
 */

// ============================================================================
// Program Type Definitions
// ============================================================================

export type A2rProgramType = 
  | 'research-doc'     // Deep research documents with citations
  | 'data-grid'        // Interactive data grids with visualization
  | 'presentation'     // Slide deck presentations
  | 'code-preview'     // Live code preview sandbox
  | 'asset-manager'    // Asset management for generated media
  | 'image-studio'     // Image editing with masking/inpainting
  | 'audio-studio'     // Audio/podcast generation
  | 'telephony'        // Phone call interface
  | 'browser'          // Embedded browser view
  | 'orchestrator'     // Mixture-of-Agents monitor
  | 'workflow-builder' // Visual workflow builder with A2R Rails integration
  | 'custom';          // Custom/external programs

export type A2rProgramStatus = 
  | 'loading'     // Initializing
  | 'active'      // Currently visible and running
  | 'background'  // Running but not visible
  | 'suspended'   // Paused but state preserved
  | 'error'       // Error state
  | 'closing';    // Being terminated

// ============================================================================
// Base Program Interface
// ============================================================================

export interface A2rProgram {
  /** Unique identifier for this program instance */
  id: string;
  
  /** Program type determines the renderer */
  type: A2rProgramType;
  
  /** Human-readable title */
  title: string;
  
  /** Current program state */
  status: A2rProgramStatus;
  
  /** Serialized state for persistence */
  state: unknown;
  
  /** ID of the chat/session that spawned it */
  sourceThreadId: string;
  
  /** Timestamp when program was launched */
  createdAt: number;
  
  /** Timestamp of last state update */
  updatedAt: number;
  
  /** Optional icon/emoji for the program */
  icon?: string;
  
  /** Whether this program can run in background */
  supportsBackground?: boolean;
  
  /** Z-index for overlay programs */
  zIndex?: number;
}

// ============================================================================
// Program-Specific State Types
// ============================================================================

// --- Research Doc (Deep Research) ---

export interface ResearchDocSection {
  id: string;
  type: 'hero' | 'heading' | 'paragraph' | 'columns' | 'evidence' | 'citation' | 'divider';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ResearchDocCitation {
  id: string;
  number: number;
  source: string;
  url: string;
  timestamp: string;
  snippet: string;
}

export interface ResearchDocEvidence {
  id: string;
  type: 'screenshot' | 'chart' | 'code' | 'quote';
  src: string;
  caption: string;
  sourceUrl?: string;
  timestamp?: string;
}

export interface ResearchDocState {
  topic: string;
  sections: ResearchDocSection[];
  citations: ResearchDocCitation[];
  evidence: ResearchDocEvidence[];
  tableOfContents: { id: string; title: string; level: number }[];
  isGenerating: boolean;
  generationProgress?: {
    currentStep: string;
    percentComplete: number;
  };
  streamingContent?: {
    currentSectionId: string | null;
    buffer: string;
  };
}

// --- Data Grid ---

export interface DataGridColumn {
  id: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'formula';
  width?: number;
  formula?: string;
}

export interface DataGridRow {
  id: string;
  cells: Record<string, unknown>;
  metadata?: {
    source?: string;
    confidence?: number;
    generatedAt?: string;
  };
}

export interface DataGridVisualization {
  id: string;
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'heatmap' | 'table';
  title: string;
  config: Record<string, unknown>;
  pythonCode?: string;
  status: 'pending' | 'rendering' | 'complete' | 'error';
  resultUrl?: string;
  errorMessage?: string;
}

export interface DataGridState {
  title: string;
  columns: DataGridColumn[];
  rows: DataGridRow[];
  visualizations: DataGridVisualization[];
  selectedRange?: { start: string; end: string };
  isGenerating: boolean;
  pythonEnvironment?: 'matplotlib' | 'plotly' | 'seaborn' | 'pandas';
  kernelSessionId?: string;
}

// --- Presentation ---

export interface PresentationSlide {
  id: string;
  type: 'title' | 'content' | 'split' | 'image' | 'code' | 'chart' | 'quote' | 'two-column';
  content: string;
  notes?: string;
  layout: 'default' | 'full-bleed' | 'split-left' | 'split-right';
  background?: string;
  transition?: 'none' | 'fade' | 'slide' | 'zoom';
  metadata?: {
    layout?: 'default' | 'full-bleed' | 'split-left' | 'split-right';
    imageUrl?: string;
    imagePrompt?: string;
    subtitle?: string;
    bullets?: string[];
    rightContent?: string;
    code?: string;
  };
}

export interface PresentationTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontHeading: string;
  fontBody: string;
}

export interface PresentationState {
  title: string;
  slides: PresentationSlide[];
  currentSlideIndex: number;
  theme: PresentationTheme;
  isPresenting: boolean;
  availableThemes: PresentationTheme[];
  isGenerating: boolean;
  generationProgress?: {
    currentSlide: number;
    totalSlides: number;
  };
}

// --- Code Preview ---

export interface CodePreviewFile {
  path: string;
  content: string;
  language: string;
  isEntryPoint?: boolean;
}

export interface CodePreviewState {
  files: CodePreviewFile[];
  entryFile: string;
  previewUrl?: string;
  consoleLogs: { type: 'log' | 'error' | 'warn'; message: string; timestamp: number }[];
  isBuilding: boolean;
  buildError?: string;
  autoReload: boolean;
  sandboxConfig: {
    allowScripts: boolean;
    allowSameOrigin: boolean;
    allowForms: boolean;
  };
}

// --- Asset Manager ---

export interface AssetManagerItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'folder';
  path: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
}

export interface AssetManagerState {
  currentPath: string;
  items: AssetManagerItem[];
  selectedItems: string[];
  viewMode: 'grid' | 'list' | 'gallery';
  sortBy: 'name' | 'date' | 'size' | 'type';
  sortDirection: 'asc' | 'desc';
  searchQuery: string;
  isUploading: boolean;
  uploadProgress?: number;
  watchFolder?: string;
}

// --- Image Studio ---

export interface ImageStudioLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvasData?: ImageData;
}

export interface ImageStudioState {
  imageUrl: string;
  originalImageUrl: string;
  layers: ImageStudioLayer[];
  activeLayerId: string;
  brushSize: number;
  brushColor: string;
  tool: 'brush' | 'eraser' | 'mask' | 'select';
  zoom: number;
  pan: { x: number; y: number };
  maskData?: ImageData;
  inpaintPrompt?: string;
  isProcessing: boolean;
  processingProgress?: number;
}

// --- Audio Studio ---

export interface AudioStudioVoice {
  id: string;
  name: string;
  provider: 'elevenlabs' | 'openai' | 'local';
  voiceId: string;
  previewUrl?: string;
}

export interface AudioStudioSegment {
  id: string;
  speaker: string;
  text: string;
  voiceId: string;
  generatedAudioUrl?: string;
  duration?: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
}

export interface AudioStudioState {
  title: string;
  script: AudioStudioSegment[];
  voices: AudioStudioVoice[];
  backgroundMusic?: string;
  isGenerating: boolean;
  currentSegmentIndex: number;
  finalAudioUrl?: string;
  settings: {
    pauseBetweenSegments: number;
    globalSpeed: number;
    normalizeAudio: boolean;
  };
}

// --- Telephony ---

export interface TelephonyCall {
  id: string;
  status: 'dialing' | 'ringing' | 'connected' | 'holding' | 'ended';
  direction: 'outbound' | 'inbound';
  phoneNumber: string;
  contactName?: string;
  startedAt?: number;
  endedAt?: number;
  transcript: { speaker: 'agent' | 'user' | 'other'; text: string; timestamp: number }[];
  recordingUrl?: string;
}

export interface TelephonyState {
  activeCall?: TelephonyCall;
  callHistory: TelephonyCall[];
  keypadOpen: boolean;
  microphoneMuted: boolean;
  speakerOn: boolean;
  isReady: boolean;
  provider: 'vapi' | 'twilio' | 'local';
}

// --- Orchestrator (MoA) ---

export interface OrchestratorAgent {
  id: string;
  name: string;
  role: 'planner' | 'researcher' | 'writer' | 'designer' | 'fact-checker' | 'synthesizer';
  status: 'idle' | 'working' | 'completed' | 'error';
  model: string;
  progress: number;
  currentTask?: string;
  output?: unknown;
  startTime?: number;
  endTime?: number;
  logs: string[];
  tokensUsed?: {
    input: number;
    output: number;
    cost: number;
  };
}

export interface OrchestratorTaskGraph {
  nodes: { id: string; name: string; dependencies: string[]; status: string; assignedAgent?: string }[];
  edges: { from: string; to: string }[];
}

export interface OrchestratorState {
  agents: OrchestratorAgent[];
  taskGraph: OrchestratorTaskGraph;
  overallProgress: number;
  isRunning: boolean;
  originalPrompt: string;
  finalOutput?: unknown;
  executionMode: 'sequential' | 'parallel' | 'dag';
  costEstimate?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
  };
}

// --- Agent (Generic Agent Type) ---

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'active' | 'busy' | 'offline';
  capabilities: string[];
  lastActive?: number;
  metadata?: Record<string, unknown>;
}

// --- Task Node (for DAG/Kanban) ---

export interface TaskNode {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  dependencies: string[];
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedDuration?: number;
  actualDuration?: number;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
}

// ============================================================================
// Program State Union Type
// ============================================================================

export type A2rProgramState =
  | ResearchDocState
  | DataGridState
  | PresentationState
  | CodePreviewState
  | AssetManagerState
  | ImageStudioState
  | AudioStudioState
  | TelephonyState
  | OrchestratorState
  | Record<string, unknown>; // Custom programs

// ============================================================================
// Launch & Event Types
// ============================================================================

export interface LaunchProgramRequest<T = unknown> {
  type: A2rProgramType;
  title: string;
  initialState?: T;
  sourceThreadId: string;
  icon?: string;
  launchOptions?: {
    focus?: boolean;
    replaceExisting?: boolean;
    background?: boolean;
  };
}

export interface ProgramEvent {
  type: 
    | 'program.launched'
    | 'program.activated'
    | 'program.suspended'
    | 'program.resumed'
    | 'program.terminated'
    | 'program.error'
    | 'program.state-changed'
    | 'program.message';
  programId: string;
  timestamp: number;
  payload?: unknown;
}

// ============================================================================
// Kernel Bridge Types
// ============================================================================

export interface KernelProgramCommand {
  command: 'launch' | 'update' | 'terminate' | 'execute' | 'query';
  programId?: string;
  programType?: A2rProgramType;
  payload?: unknown;
}

export interface KernelProgramEvent {
  event: 'state-update' | 'stream-chunk' | 'complete' | 'error';
  programId: string;
  payload: unknown;
  timestamp: number;
}

export interface StreamingChunk {
  sectionId: string;
  content: string;
  isComplete: boolean;
}

// ============================================================================
// URI Scheme for Programs
// ============================================================================

export interface A2rProgramUri {
  scheme: 'a2r';
  program: A2rProgramType;
  id?: string;
  params: Record<string, string>;
}

export function parseA2rUri(uri: string): A2rProgramUri | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'a2r:') return null;
    
    const program = url.hostname as A2rProgramType;
    const params: Record<string, string> = {};
    
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return {
      scheme: 'a2r',
      program,
      id: params.id,
      params,
    };
  } catch {
    return null;
  }
}

export function buildA2rUri(program: A2rProgramType, params: Record<string, string> = {}): string {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `a2r://${program}${queryString ? `?${queryString}` : ''}`;
}

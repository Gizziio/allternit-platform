/**
 * Rust Stream Adapter - Extended Contract
 * 
 * Adds support for structured AI Elements rendering beyond standard AI SDK types.
 */

import type { TextUIPart, ToolUIPart, DynamicToolUIPart, FileUIPart as AIFileUIPart, SourceDocumentUIPart } from "ai";
import type {
  McpAppUIPart as BaseMcpAppUIPart,
  ReasoningTrace,
} from "./rust-stream-adapter";

// Re-export base types
export type {
  RustEventType,
  RustStreamEvent,
  MessageRole,
  ChatMessage,
  ReasoningTrace,
} from "./rust-stream-adapter";
export { useRustStreamAdapter, getTextFromParts, partsToText } from "./rust-stream-adapter";

// ============================================================================
// Extended UI Part Types (Non-AI-SDK)
// ============================================================================

/**
 * Reasoning part - AI's internal thought process
 */
export interface ReasoningUIPart {
  type: "reasoning";
  reasoningId: string;
  text: string;
  content?: string;
  isOpen?: boolean;
  metadata?: Record<string, unknown>;
  trace?: ReasoningTrace;
}

/**
 * Code block part - Syntax highlighted code
 */
export interface CodeUIPart {
  type: "code";
  language: string;
  code: string;
  filename?: string;
}

/**
 * Terminal output part - Command execution results
 */
export interface TerminalUIPart {
  type: "terminal";
  command: string;
  output: string;
  exitCode?: number;
  status: "running" | "completed" | "error";
}

/**
 * Error part - Structured error with stack trace
 */
export interface ErrorUIPart {
  type: "error";
  message: string;
  stackTrace?: string;
  kind: "compilation" | "runtime" | "validation" | "unknown";
}

/**
 * Test results part - Unit test output
 */
export interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  error?: string;
  durationMs: number;
}

export interface TestResultsUIPart {
  type: "test-results";
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  tests: TestResult[];
}

/**
 * Plan part - Execution plan steps
 */
export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in-progress" | "complete" | "error";
}

export interface PlanUIPart {
  type: "plan";
  planId: string;
  title: string;
  steps: PlanStep[];
}

/**
 * Checkpoint part - Save/restore point
 */
export interface CheckpointUIPart {
  type: "checkpoint";
  checkpointId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audio part - TTS output
 */
export interface AudioUIPart {
  type: "audio";
  audioUrl: string;
  duration?: number;
  voice?: string;
}

/**
 * File operation part
 */
export interface FileOperationUIPart {
  type: "file-operation";
  operation: "create" | "modify" | "delete";
  path: string;
  content?: string;
  diff?: string;
}

/**
 * Artifact part - Generated assets (images, diagrams, documents)
 */
export interface ArtifactUIPart {
  type: "artifact";
  artifactId: string;
  kind: "image" | "svg" | "mermaid" | "jsx" | "html" | "document" | "code";
  url?: string;
  content?: string;  // For inline SVG, mermaid, documents, etc
  title: string;
  language?: string; // For code kind
}

/**
 * Citation part - Inline reference to source
 */
export interface CitationUIPart {
  type: "citation";
  citationId: string;
  sourceId: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Confirmation request part - User approval needed
 */
export interface ConfirmationUIPart {
  type: "confirmation";
  confirmationId: string;
  title: string;
  description: string;
  actions: Array<{
    id: string;
    label: string;
    style: "primary" | "secondary" | "danger";
  }>;
}

/**
 * Queue part - Processing queue display
 */
export interface QueueItem {
  id: string;
  label: string;
  status: "pending" | "processing" | "complete" | "error";
}

export interface QueueUIPart {
  type: "queue";
  queueId: string;
  items: QueueItem[];
}

/**
 * Task part - Background task
 */
export interface TaskUIPart {
  type: "task";
  taskId: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "complete" | "error";
  progress?: number;
}

/**
 * Commit part - Git commit
 */
export interface CommitUIPart {
  type: "commit";
  commitId: string;
  hash: string;
  message: string;
  author?: string;
  timestamp?: Date;
}

/**
 * Sandbox part - Sandboxed preview
 */
export interface SandboxUIPart {
  type: "sandbox";
  sandboxId: string;
  title?: string;
  html?: string;
  url?: string;
}

/**
 * Web preview part - Web page preview
 */
export interface WebPreviewUIPart {
  type: "web-preview";
  previewId: string;
  url: string;
  title?: string;
}

export type McpAppUIPart = BaseMcpAppUIPart;

/**
 * Canvas part - Visual canvas
 */
export interface CanvasUIPart {
  type: "canvas";
  canvasId: string;
  title?: string;
  data?: unknown;
}

/**
 * File tree part - File structure
 */
export interface FileTreeUIPart {
  type: "file-tree";
  treeId: string;
  root: FileTreeNode;
}

export interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  content?: string;
}

/**
 * Chain of thought part - Step-by-step reasoning
 */
export interface ChainOfThoughtUIPart {
  type: "chain-of-thought";
  thoughtId: string;
  steps: string[];
}

/**
 * Context part - Context information display
 */
export interface ContextUIPart {
  type: "context";
  contextId: string;
  content?: string;
  tokens?: {
    input?: number;
    output?: number;
  };
}

/**
 * Image part - Image display
 */
export interface ImageUIPart {
  type: "image";
  imageId: string;
  url: string;
  alt?: string;
  title?: string;
}

/**
 * Agent part - Agent information card
 */
export interface AgentUIPart {
  type: "agent";
  agentId: string;
  name: string;
  description?: string;
  instructions?: string;
}

/**
 * Model selector part - Interactive model selection
 */
export interface ModelSelectorUIPart {
  type: "model-selector";
  selectorId: string;
  selected: string;
  options?: string[];
}

/**
 * Open in chat part - External chat links
 */
export interface OpenInUIPart {
  type: "open-in";
  openInId: string;
  text: string;
}

/**
 * Environment variables part - Env var editor
 */
export interface EnvironmentVariablesUIPart {
  type: "environment-variables";
  envId: string;
  variables: Record<string, string>;
  onChange?: (vars: Record<string, string>) => void;
}

/**
 * Package info part - Package information
 */
export interface PackageInfoUIPart {
  type: "package-info";
  packageId: string;
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
}

/**
 * Schema display part - JSON schema visualization
 */
export interface SchemaUIPart {
  type: "schema";
  schemaId: string;
  schema: unknown;
}

/**
 * Stack trace part - Error stack trace
 */
export interface StackTraceUIPart {
  type: "stack-trace";
  traceId: string;
  message: string;
  errorType?: string;
  frames?: Array<{
    file: string;
    line: number;
    column: number;
    function?: string;
  }>;
}

/**
 * Snippet part - Code snippet with copy
 */
export interface SnippetUIPart {
  type: "snippet";
  snippetId: string;
  code: string;
  language?: string;
}

/**
 * OpenUI part - Generative UI block
 */
export interface OpenUIPart {
  type: "openui";
  stream: string;
  title?: string;
}

/**
 * JSX Preview part - Inline React component preview
 */
export interface JSXPreviewUIPart {
  type: "jsx-preview";
  previewId: string;
  jsx: string;
  title?: string;
}

/**
 * Email draft part - AI-composed email with send actions
 */
export interface EmailDraftUIPart {
  type: "email-draft";
  emailId: string;
  to: string;
  from?: string;
  cc?: string;
  subject: string;
  body: string;
}

/**
 * SMS draft part - AI-composed text message
 */
export interface SMSMessage {
  role: "sender" | "recipient";
  text: string;
}

export interface SMSDraftUIPart {
  type: "sms-draft";
  smsId: string;
  to: string;
  messages: SMSMessage[];
}

/**
 * Recipe part - Structured recipe card
 */
export interface RecipeIngredient {
  name: string;
  amount: string;
  unit?: string;
}

export interface RecipeStep {
  description: string;
  durationMinutes?: number;
}

export interface RecipeUIPart {
  type: "recipe";
  recipeId: string;
  name: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  imageUrl?: string;
}

/**
 * Image search part - Image search result grid
 */
export interface ImageSearchResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  source?: string;
}

export interface ImageSearchUIPart {
  type: "image-search";
  searchId: string;
  query: string;
  results: ImageSearchResult[];
}

/**
 * App recommendations part - Curated app install cards
 */
export interface AppRecommendation {
  name: string;
  description: string;
  iconUrl?: string;
  category?: string;
  rating?: number;
  installUrl?: string;
  badge?: string;
}

export interface AppRecommendationsUIPart {
  type: "app-recommendations";
  recommendationsId: string;
  title?: string;
  apps: AppRecommendation[];
}

/**
 * Model comparison part - Side-by-side model feature table
 */
export interface ModelComparisonModel {
  id: string;
  name: string;
  provider?: string;
  badge?: string;
  highlighted?: boolean;
}

export interface ModelComparisonFeature {
  name: string;
  description?: string;
  values: Record<string, boolean | string | null>;
}

export interface ModelComparisonUIPart {
  type: "model-comparison";
  comparisonId: string;
  title?: string;
  models: ModelComparisonModel[];
  features: ModelComparisonFeature[];
  variant?: "default" | "compact" | "hover";
}

/**
 * Mock chat part - Simulated conversation in a specific AI style
 */
export interface MockChatMessage {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
}

export interface MockChatUIPart {
  type: "mock-chat";
  chatId: string;
  style?: "claude" | "gpt" | "grok" | "gemini";
  messages: MockChatMessage[];
}

/**
 * Levee wizard part - Multi-step adaptive interview/form
 */
export interface LeveeWizardStepOption {
  id: string;
  label: string;
  description?: string;
}

export interface LeveeWizardStep {
  id: string;
  title: string;
  description?: string;
  type: "text" | "choice" | "multi-choice" | "rating" | "confirm";
  options?: LeveeWizardStepOption[];
  placeholder?: string;
}

export interface LeveeWizardUIPart {
  type: "levee-wizard";
  wizardId: string;
  title?: string;
  subtitle?: string;
  steps: LeveeWizardStep[];
}

// ============================================================================
// Extended Union Type
// ============================================================================

export type ExtendedUIPart =
  | TextUIPart
  | ToolUIPart
  | DynamicToolUIPart
  | AIFileUIPart
  | SourceDocumentUIPart
  | ReasoningUIPart
  | CodeUIPart
  | TerminalUIPart
  | ErrorUIPart
  | TestResultsUIPart
  | PlanUIPart
  | CheckpointUIPart
  | AudioUIPart
  | FileOperationUIPart
  | ArtifactUIPart
  | McpAppUIPart
  | CitationUIPart
  | ConfirmationUIPart
  | QueueUIPart
  | TaskUIPart
  | CommitUIPart
  | SandboxUIPart
  | WebPreviewUIPart
  | CanvasUIPart
  | FileTreeUIPart
  // New types
  | ChainOfThoughtUIPart
  | ContextUIPart
  | ImageUIPart
  | AgentUIPart
  | ModelSelectorUIPart
  | OpenInUIPart
  | EnvironmentVariablesUIPart
  | PackageInfoUIPart
  | SchemaUIPart
  | StackTraceUIPart
  | SnippetUIPart
  | OpenUIPart
  // Showcase tool parts
  | JSXPreviewUIPart
  | EmailDraftUIPart
  | SMSDraftUIPart
  | RecipeUIPart
  | ImageSearchUIPart
  | AppRecommendationsUIPart
  | ModelComparisonUIPart
  | MockChatUIPart
  | LeveeWizardUIPart;

// ============================================================================
// Extended Rust Event Types
// ============================================================================

export type ExtendedRustEventType = 
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "tool_result"
  | "tool_error"
  | "mcp_app"
  | "source"
  | "finish"
  // Extended events
  | "reasoning_start"
  | "reasoning_delta"
  | "reasoning_end"
  | "code_block"
  | "terminal_output"
  | "error"
  | "test_results"
  | "plan"
  | "plan_update"
  | "checkpoint"
  | "audio"
  | "file"
  | "artifact"
  | "citation"
  | "confirmation_request"
  | "confirmation_response";

export interface ExtendedRustStreamEvent {
  type: ExtendedRustEventType;
  // Common fields
  messageId?: string;
  
  // Text/thinking deltas (existing)
  delta?: {
    type: "text_delta" | "thinking_delta";
    text?: string;
    thinking?: string;
  };
  
  // Tool use (existing)
  content_block?: {
    type: "tool_use";
    id: string;
    name: string;
    input?: Record<string, unknown>;
  };
  toolCallId?: string;
  result?: unknown;
  error?: string;
  
  // Source (existing)
  sourceId?: string;
  url?: string;
  title?: string;
  
  // Reasoning (new)
  reasoningId?: string;
  
  // Code block (new)
  language?: string;
  code?: string;
  filename?: string;
  
  // Terminal (new)
  command?: string;
  output?: string;
  exitCode?: number;
  status?: "running" | "completed" | "error";
  
  // Error (new)
  stackTrace?: string;
  errorKind?: "compilation" | "runtime" | "validation" | "unknown";
  
  // Test results (new)
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  tests?: TestResult[];
  
  // Plan (new)
  planId?: string;
  steps?: PlanStep[];
  
  // Checkpoint (new)
  checkpointId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  
  // Audio (new)
  audioUrl?: string;
  duration?: number;
  voice?: string;
  
  // File (new)
  operation?: "create" | "modify" | "delete";
  path?: string;
  content?: string;
  diff?: string;
  
  // Artifact (new)
  artifactId?: string;
  artifactKind?: "image" | "svg" | "mermaid" | "jsx" | "html";
  
  // Citation (new)
  citationId?: string;
  startIndex?: number;
  endIndex?: number;
  
  // Confirmation (new)
  confirmationId?: string;
  actions?: Array<{
    id: string;
    label: string;
    style: "primary" | "secondary" | "danger";
  }>;
}

// ============================================================================
// Type Guards for Extended Parts
// ============================================================================

export function isReasoningPart(part: ExtendedUIPart): part is ReasoningUIPart {
  return part.type === "reasoning";
}

export function isCodePart(part: ExtendedUIPart): part is CodeUIPart {
  return part.type === "code";
}

export function isTerminalPart(part: ExtendedUIPart): part is TerminalUIPart {
  return part.type === "terminal";
}

export function isErrorPart(part: ExtendedUIPart): part is ErrorUIPart {
  return part.type === "error";
}

export function isTestResultsPart(part: ExtendedUIPart): part is TestResultsUIPart {
  return part.type === "test-results";
}

export function isPlanPart(part: ExtendedUIPart): part is PlanUIPart {
  return part.type === "plan";
}

export function isCheckpointPart(part: ExtendedUIPart): part is CheckpointUIPart {
  return part.type === "checkpoint";
}

export function isAudioPart(part: ExtendedUIPart): part is AudioUIPart {
  return part.type === "audio";
}

export function isArtifactPart(part: ExtendedUIPart): part is ArtifactUIPart {
  return part.type === "artifact";
}

export function isCitationPart(part: ExtendedUIPart): part is CitationUIPart {
  return part.type === "citation";
}

export function isConfirmationPart(part: ExtendedUIPart): part is ConfirmationUIPart {
  return part.type === "confirmation";
}

// ============================================================================
// Smart Content Parser (Client-Side Fallback)
// ============================================================================

/**
 * Parses raw text for structured content as fallback when backend doesn't
 * send structured events. This provides progressive enhancement.
 */
export function parseStructuredContent(text: string): ExtendedUIPart[] {
  const parts: ExtendedUIPart[] = [];

  // Use a more sophisticated parsing strategy that handles open tags
  // Priority order for elements
  const patterns = [
    {
      type: "openui",
      // OpenUI Lang blocks: [v:tag ...]
      // We look for a block starting with [v: and attempt to find the full stream.
      // Since it's streaming, we'll take everything from [v: to the end or last ]
      regex: /\[v:([\s\S]*?)(?:\]\s*$|\](?=\n|$)|$)/g,
      parse: (match: RegExpExecArray): OpenUIPart => {
        const stream = match[0];
        // Try to extract a title from the first tag: [v:card title="My Dashboard"
        const titleMatch = stream.match(/title="([^"]*)"/);
        const title = titleMatch ? titleMatch[1] : "Interactive UI";
        return {
          type: "openui",
          stream,
          title,
        };
      },
    },
    {
      type: "document",
      // <document title="…">content</document> — long-form AI-created documents
      regex: /<document(?:\s+title="([^"]*)")?>([\s\S]*?)(?:<\/document>|$)/g,
      parse: (match: RegExpExecArray): ArtifactUIPart => ({
        type: "artifact",
        artifactId: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: "document",
        title: match[1]?.trim() || "Document",
        content: match[2].trim(),
      }),
    },
    {
      type: "artifact-fence",
      // Visual code fences (mermaid/html/jsx/tsx/svg) → artifact cards
      // Optional title comment: ```mermaid title="My Diagram"
      regex: /```(mermaid|html|jsx|tsx|svg)(?:\s+title="([^"]*)")?\n([\s\S]*?)(?:```|$)/g,
      parse: (match: RegExpExecArray): ArtifactUIPart => {
        const lang = match[1];
        const kind = lang === "tsx" ? "jsx" : lang as ArtifactUIPart["kind"];
        const title = match[2]?.trim() ||
          (kind === "mermaid" ? "Diagram" :
           kind === "html"    ? "HTML Preview" :
           kind === "jsx"     ? "React Component" :
           kind === "svg"     ? "SVG Graphic" : "Artifact");
        return {
          type: "artifact",
          artifactId: `artifact-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind,
          title,
          content: match[3].trim(),
        };
      },
    },
    {
      type: "structured-json",
      // JSON fences with typed structured parts — placed before the generic code pattern.
      // Two trigger forms:
      //   ```json type="email-draft"   (explicit annotation)
      //   ```json\n{ "type": "email-draft", ...  (auto-detect from type field)
      regex: /```json(?:\s+type="([^"]*)")?\n([\s\S]*?)(?:```|$)/g,
      parse: (match: RegExpExecArray): ExtendedUIPart => {
        const annotatedType = match[1];
        const jsonStr = match[2].trim();
        const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return { type: "code", language: "json", code: jsonStr };
        }

        const partType = annotatedType ?? (typeof parsed.type === "string" ? parsed.type : null);
        if (!partType) return { type: "code", language: "json", code: jsonStr };

        switch (partType) {
          case "email-draft":
            return {
              type: "email-draft",
              emailId: id(),
              to: String(parsed.to ?? ""),
              from: typeof parsed.from === "string" ? parsed.from : undefined,
              cc: typeof parsed.cc === "string" ? parsed.cc : undefined,
              subject: String(parsed.subject ?? ""),
              body: String(parsed.body ?? ""),
            };
          case "sms-draft":
            return {
              type: "sms-draft",
              smsId: id(),
              to: String(parsed.to ?? ""),
              messages: Array.isArray(parsed.messages) ? (parsed.messages as SMSMessage[]) : [],
            };
          case "recipe":
            return {
              type: "recipe",
              recipeId: id(),
              name: String(parsed.name ?? "Recipe"),
              description: typeof parsed.description === "string" ? parsed.description : undefined,
              servings: typeof parsed.servings === "number" ? parsed.servings : undefined,
              prepTimeMinutes: typeof parsed.prepTimeMinutes === "number" ? parsed.prepTimeMinutes : undefined,
              cookTimeMinutes: typeof parsed.cookTimeMinutes === "number" ? parsed.cookTimeMinutes : undefined,
              ingredients: Array.isArray(parsed.ingredients) ? (parsed.ingredients as RecipeIngredient[]) : [],
              steps: Array.isArray(parsed.steps) ? (parsed.steps as RecipeStep[]) : [],
              imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : undefined,
            };
          case "image-search":
            return {
              type: "image-search",
              searchId: id(),
              query: String(parsed.query ?? ""),
              results: Array.isArray(parsed.results) ? (parsed.results as ImageSearchResult[]) : [],
            };
          case "app-recommendations":
            return {
              type: "app-recommendations",
              recommendationsId: id(),
              title: typeof parsed.title === "string" ? parsed.title : undefined,
              apps: Array.isArray(parsed.apps) ? (parsed.apps as AppRecommendation[]) : [],
            };
          case "model-comparison":
            return {
              type: "model-comparison",
              comparisonId: id(),
              title: typeof parsed.title === "string" ? parsed.title : undefined,
              models: Array.isArray(parsed.models) ? (parsed.models as ModelComparisonModel[]) : [],
              features: Array.isArray(parsed.features) ? (parsed.features as ModelComparisonFeature[]) : [],
              variant: (parsed.variant as ModelComparisonUIPart["variant"]) ?? "default",
            };
          case "mock-chat":
            return {
              type: "mock-chat",
              chatId: id(),
              style: (parsed.style as MockChatUIPart["style"]) ?? "claude",
              messages: Array.isArray(parsed.messages) ? (parsed.messages as MockChatMessage[]) : [],
            };
          case "levee-wizard":
            return {
              type: "levee-wizard",
              wizardId: id(),
              title: typeof parsed.title === "string" ? parsed.title : undefined,
              subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : undefined,
              steps: Array.isArray(parsed.steps) ? (parsed.steps as LeveeWizardStep[]) : [],
            };
          case "jsx-preview":
            return {
              type: "jsx-preview",
              previewId: id(),
              jsx: String(parsed.jsx ?? ""),
              title: typeof parsed.title === "string" ? parsed.title : undefined,
            };
          case "plan":
            return {
              type: "plan",
              planId: id(),
              title: String(parsed.title ?? "Plan"),
              steps: Array.isArray(parsed.steps) ? (parsed.steps as PlanStep[]) : [],
            };
          case "test-results":
            return {
              type: "test-results",
              summary: (parsed.summary as TestResultsUIPart["summary"]) ?? { total: 0, passed: 0, failed: 0, skipped: 0 },
              tests: Array.isArray(parsed.tests) ? (parsed.tests as TestResult[]) : [],
            };
          case "checkpoint":
            return {
              type: "checkpoint",
              checkpointId: id(),
              description: String(parsed.description ?? ""),
            };
          case "commit":
            return {
              type: "commit",
              commitId: id(),
              hash: String(parsed.hash ?? ""),
              message: String(parsed.message ?? ""),
              author: typeof parsed.author === "string" ? parsed.author : undefined,
            };
          case "task":
            return {
              type: "task",
              taskId: id(),
              title: String(parsed.title ?? ""),
              description: typeof parsed.description === "string" ? parsed.description : undefined,
              status: (parsed.status as TaskUIPart["status"]) ?? "pending",
            };
          case "queue":
            return {
              type: "queue",
              queueId: id(),
              items: Array.isArray(parsed.items) ? (parsed.items as QueueItem[]) : [],
            };
          case "environment-variables":
            return {
              type: "environment-variables",
              envId: id(),
              variables: (typeof parsed.variables === "object" && parsed.variables !== null
                ? parsed.variables
                : {}) as Record<string, string>,
            };
          case "chain-of-thought":
            return {
              type: "chain-of-thought",
              thoughtId: id(),
              steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
            };
          case "snippet":
            return {
              type: "snippet",
              snippetId: id(),
              code: String(parsed.code ?? ""),
              language: typeof parsed.language === "string" ? parsed.language : undefined,
            };
          case "stack-trace":
            return {
              type: "stack-trace",
              traceId: id(),
              message: String(parsed.message ?? ""),
              errorType: typeof parsed.errorType === "string" ? parsed.errorType : undefined,
              frames: Array.isArray(parsed.frames) ? (parsed.frames as StackTraceUIPart["frames"]) : undefined,
            };
          case "package-info":
            return {
              type: "package-info",
              packageId: id(),
              name: String(parsed.name ?? ""),
              version: typeof parsed.version === "string" ? parsed.version : undefined,
              dependencies: (typeof parsed.dependencies === "object" && parsed.dependencies !== null
                ? parsed.dependencies
                : undefined) as Record<string, string> | undefined,
            };
          case "schema":
            return {
              type: "schema",
              schemaId: id(),
              schema: parsed.schema ?? parsed,
            };
          case "context":
            return {
              type: "context",
              contextId: id(),
              content: typeof parsed.content === "string" ? parsed.content : undefined,
              tokens: typeof parsed.tokens === "object" ? (parsed.tokens as ContextUIPart["tokens"]) : undefined,
            };
          case "agent":
            return {
              type: "agent",
              agentId: id(),
              name: String(parsed.name ?? ""),
              description: typeof parsed.description === "string" ? parsed.description : undefined,
            };
          default:
            // Unknown type — render as code so it stays visible
            return { type: "code", language: "json", code: jsonStr };
        }
      },
    },
    {
      type: "code",
      // Standard code blocks (non-visual languages) → inline code
      // Handle both closed and open code blocks
      regex: /```(\w+)?\n([\s\S]*?)(?:```|$)/g,
      parse: (match: RegExpExecArray): CodeUIPart => ({
        type: "code",
        language: match[1] || "text",
        code: match[2].trim(),
      }),
    },
    {
      type: "reasoning",
      // Handle both closed and open thinking blocks, supporting <think>, <thinking>, <thought>
      regex: /<(?:thinking|think|thought)>([\s\S]*?)(?:<\/(?:thinking|think|thought)>|$)/g,
      parse: (match: RegExpExecArray): ReasoningUIPart => ({
        type: "reasoning",
        reasoningId: `reasoning-${Date.now()}-${Math.random()}`,
        text: match[1].trim(),
        content: match[1].trim(),
        isOpen: true,
      }),
    },
    {
      type: "terminal",
      // Terminal/command: $ command\noutput
      regex: /\$\s*(.+?)\n([\s\S]*?)(?=\n\$|\n\n|$)/g,
      parse: (match: RegExpExecArray): TerminalUIPart => ({
        type: "terminal",
        command: match[1].trim(),
        output: match[2].trim(),
        status: "completed",
      }),
    },
  ];
  
  // Find all matches with their positions
  const matches: Array<{ start: number; end: number; part: ExtendedUIPart }> = [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        part: pattern.parse(match),
      });
    }
    pattern.regex.lastIndex = 0;  // Reset regex
  }
  
  // Sort by position
  matches.sort((a, b) => a.start - b.start);
  
  // Merge overlapping matches (prefer earlier patterns)
  const merged: typeof matches = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (!last || match.start >= last.end) {
      merged.push(match);
    }
  }
  
  // Build parts list with text interspersed
  let lastEnd = 0;
  for (const match of merged) {
    // Add text before this match
    if (match.start > lastEnd) {
      const textContent = text.slice(lastEnd, match.start).trim();
      if (textContent) {
        parts.push({ type: "text", text: textContent });
      }
    }
    parts.push(match.part);
    lastEnd = match.end;
  }
  
  // Add remaining text
  if (lastEnd < text.length) {
    const textContent = text.slice(lastEnd).trim();
    if (textContent) {
      parts.push({ type: "text", text: textContent });
    }
  }
  
  // If no structured parts found, return single text part
  if (parts.length === 0 && text.trim()) {
    parts.push({ type: "text", text: text.trim() });
  }
  
  return parts;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts plain text from extended parts for copying/searching
 */
export function extendedPartsToText(parts: ExtendedUIPart[]): string {
  return parts
    .map(part => {
      switch (part.type) {
        case "text":
          return part.text;
        case "reasoning":
          return `[Thinking: ${part.content ?? part.text}]`;
        case "code":
          return part.filename 
            ? `\`\`\`${part.language}\n// ${part.filename}\n${part.code}\n\`\`\``
            : `\`\`\`${part.language}\n${part.code}\n\`\`\``;
        case "terminal":
          return `$ ${part.command}\n${part.output}`;
        case "error":
          return part.stackTrace 
            ? `Error: ${part.message}\n${part.stackTrace}`
            : `Error: ${part.message}`;
        case "test-results":
          return `Tests: ${part.summary.passed}/${part.summary.total} passed`;
        case "plan":
          return `Plan: ${part.title}\n${part.steps.map(s => `- [${s.status}] ${s.description}`).join("\n")}`;
        case "checkpoint":
          return `[Checkpoint: ${part.description}]`;
        case "audio":
          return `[Audio: ${part.duration}s]`;
        case "file-operation":
          return `[File ${part.operation}: ${part.path}]`;
        case "artifact":
          return `[${part.kind}: ${part.title}]`;
        case "citation":
          return `[Source: ${part.sourceId}]`;
        case "confirmation":
          return `[Action Required: ${part.title}]`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Filters parts by type
 */
export function filterPartsByType<T extends ExtendedUIPart["type"]>(
  parts: ExtendedUIPart[],
  type: T
): Extract<ExtendedUIPart, { type: T }>[] {
  return parts.filter((p): p is Extract<ExtendedUIPart, { type: T }> => p.type === type);
}

/**
 * Gets the last part of a specific type
 */
export function getLastPartOfType<T extends ExtendedUIPart["type"]>(
  parts: ExtendedUIPart[],
  type: T
): Extract<ExtendedUIPart, { type: T }> | undefined {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].type === type) {
      return parts[i] as Extract<ExtendedUIPart, { type: T }>;
    }
  }
  return undefined;
}

/**
 * AI Types for Allternit
 * Extended for full AI SDK Elements support
 */

import { z } from "zod";

// StreamWriter for data streaming (matches AI SDK's DataStreamWriter)
export interface StreamWriter {
  writeData: (data: unknown) => void;
  writeMessageAnnotation: (annotation: unknown) => void;
  // Required for compatibility with AI SDK patterns
  write: (chunk: unknown) => void;
  merge: (chunk: unknown) => void;
}

// Tool name type (legacy alias for compatibility)
export type ToolName = UiToolName;

// Chat tools configuration - key mapping for all tools
export type ChatTools = {
  webSearch: unknown;
  generateImage: unknown;
  deepResearch: unknown;
  codeExecution: unknown;
  createTextDocument: unknown;
  createCodeDocument: unknown;
  createSheetDocument: unknown;
  editTextDocument: unknown;
  editCodeDocument: unknown;
  editSheetDocument: unknown;
  notebookIngest: unknown;
  notebookQuery: unknown;
  notebookSummarize: unknown;
};

// Tool name schema for validation
export const toolNameSchema = z.enum([
  "webSearch",
  "generateImage",
  "deepResearch",
  "codeExecution",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
  "notebookIngest",
  "notebookQuery",
  "notebookSummarize",
]);

// Attachment type for file uploads
export interface Attachment {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size?: number;
}

// UI Tool names
export type UiToolName = 
  | "webSearch" 
  | "generateImage" 
  | "deepResearch"
  | "codeExecution"
  | "createTextDocument"
  | "createCodeDocument"
  | "createSheetDocument"
  | "editTextDocument"
  | "editCodeDocument"
  | "editSheetDocument"
  | "readDocument"
  | "retrieveUrl"
  | "getWeather"
  | "notebookIngest"
  | "notebookQuery"
  | "notebookSummarize"
  | null;

// Message parts for structured content - ALL PARTS WIRED
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; reasoning: string }
  | { type: "file"; file: Attachment }
  | { type: "source"; source: { id: string; url: string; title: string } }
  | { type: "code"; code: string; language?: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "audio"; url: string }
  | { 
      type: `tool-${string}`; 
      toolCallId: string; 
      toolName: string; 
      state: "loading" | "result" | "error"; 
      input?: unknown; 
      output?: unknown; 
      errorText?: string;
    }
  | { type: `data-${string}`; dataType: string; blob: unknown };

// Chat message - supports both simple text and structured parts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string | MessagePart[];
  parts?: MessagePart[];
  metadata?: {
    parentMessageId?: string;
    createdAt?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  experimental_attachments?: Attachment[];
}

// Model runtime types
export type ModelRuntimeType = "api" | "cli" | "local";

// Model data
export interface ModelData {
  id: string;
  name: string;
  provider: string;
  description?: string;
  logo?: string; // SVG path or URL
  runtimeType: ModelRuntimeType;
  // For API models: the actual model ID to send to the provider
  // For CLI models: the CLI command to execute
  modelId?: string;
  command?: string;
  args?: string[];
  features?: {
    vision?: boolean;
    fileUpload?: boolean;
    webSearch?: boolean;
    reasoning?: boolean;
    codeExecution?: boolean;
  };
}

// File UI part
export interface FileUIPart {
  type: "file";
  url: string;
  mediaType: string;
  filename?: string;
}

// Tool invocation
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  error?: string;
  state: "loading" | "result" | "error";
}

// Artifact for code/documents
export interface ArtifactData {
  id: string;
  kind: "code" | "document" | "image" | "sheet";
  title: string;
  content: string;
  language?: string;
}

// Source for citations
export interface SourceData {
  id: string;
  url: string;
  title: string;
  snippet?: string;
}

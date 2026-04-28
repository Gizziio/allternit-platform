/**
 * AI Elements Component Registry
 * 
 * Central registry for all 48 OFFICIAL AI Elements components from
 * elements.ai-sdk.dev/components
 * 
 * Official Categories:
 * - chatbot (18): Attachments, Chain of Thought, Checkpoint, Confirmation, Context, 
 *   Conversation, Inline Citation, Message, Model Selector, Plan, Prompt Input, 
 *   Queue, Reasoning, Shimmer, Sources, Suggestion, Task, Tool
 * - code (15): Agent, Artifact, Code Block, Commit, Environment Variables, File Tree,
 *   JSX Preview, Package Info, Sandbox, Schema Display, Snippet, Stack Trace,
 *   Terminal, Test Results, Web Preview
 * - voice (6): Audio Player, Mic Selector, Persona, Speech Input, Transcription, Voice Selector
 * - workflow (7): Canvas, Connection, Controls, Edge, Node, Panel, Toolbar
 * - utilities (2): Image, Open In Chat
 */

import type { ComponentType } from "react";

// ============================================================================
// Component Categories (Official from elements.ai-sdk.dev)
// ============================================================================

export type ComponentCategory =
  | "chatbot"
  | "code"
  | "voice"
  | "workflow"
  | "utilities";

// ============================================================================
// Demo Data Factory Type
// ============================================================================

export type DemoDataFactory = () => Record<string, unknown>;

// ============================================================================
// Registry Entry Type
// ============================================================================

export interface AIElementEntry {
  id: string;
  title: string;
  category: ComponentCategory;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  demoFactory: DemoDataFactory;
  isInteractive: boolean;
}

// ============================================================================
// Import ALL 48 Official AI Elements Components
// ============================================================================

// Chatbot (18)
import { Attachments } from "./attachments";
import { ChainOfThought } from "./chain-of-thought";
import { Checkpoint } from "./checkpoint";
import { Confirmation } from "./confirmation";
import { Context } from "./context";
import { Conversation } from "./conversation";
import { InlineCitation } from "./inline-citation";
import { Message } from "./message";
import { ModelSelector } from "./model-selector";
import { Plan } from "./plan";
import { PromptInput } from "./prompt-input";
import { Queue } from "./queue";
import { Reasoning } from "./reasoning";
import { Shimmer } from "./shimmer";
import { Sources } from "./sources";
import { Suggestion } from "./suggestion";
import { Task } from "./task";
import { Tool } from "./tool";

// Code (15)
import { AgentCard } from "./agent";
import { Artifact } from "./artifact";
import { CodeBlock } from "./code-block";
import { Commit } from "./commit";
import { EnvironmentVariables } from "./environment-variables";
import { FileTree } from "./file-tree";
import { JSXPreview } from "./jsx-preview";
import { PackageInfo } from "./package-info";
import { Sandbox } from "./sandbox";
import { SchemaDisplay } from "./schema-display";
import { Snippet } from "./snippet";
import { StackTrace } from "./stack-trace";
import { Terminal } from "./terminal";
import { TestResults } from "./test-results";
import { WebPreview } from "./web-preview";

// Voice (6)
import { AudioPlayer } from "./audio-player";
import { MicSelector } from "./mic-selector";
import { Persona } from "./persona";
import { SpeechInput } from "./speech-input";
import { Transcription } from "./transcription";
import { VoiceSelector } from "./voice-selector";

// Workflow (7)
import { Canvas } from "./canvas";
import { Connection } from "./connection";
import { Controls } from "./controls";
// Edge exports an object with Animated and Temporary components
import { Edge as EdgeExports } from "./edge";
import { Node } from "./node";
import { Panel } from "./panel";
import { Toolbar } from "./toolbar";

// Utilities (2)
import { Image } from "./image";
import { OpenIn } from "./open-in-chat";

// ============================================================================
// FULL Official Catalog Registry (48 Components)
// ============================================================================

export const AI_ELEMENTS_REGISTRY: AIElementEntry[] = [
  // ========================================================================
  // CHATBOT (18 components)
  // ========================================================================
  {
    id: "attachments",
    title: "Attachments",
    category: "chatbot",
    description: "File attachment display and management",
    component: Attachments,
    demoFactory: () => ({ children: null }),
    isInteractive: false,
  },
  {
    id: "chain-of-thought",
    title: "Chain of Thought",
    category: "chatbot",
    description: "Multi-step reasoning visualization",
    component: ChainOfThought,
    demoFactory: () => ({ steps: [{ id: "1", content: "Analyzing the problem..." }] }),
    isInteractive: true,
  },
  {
    id: "checkpoint",
    title: "Checkpoint",
    category: "chatbot",
    description: "Checkpoint/save state indicator",
    component: Checkpoint,
    demoFactory: () => ({ status: "saved" }),
    isInteractive: false,
  },
  {
    id: "confirmation",
    title: "Confirmation",
    category: "chatbot",
    description: "User confirmation dialog for actions",
    component: Confirmation,
    demoFactory: () => ({ title: "Confirm Action", onConfirm: () => {}, onCancel: () => {} }),
    isInteractive: true,
  },
  {
    id: "context",
    title: "Context",
    category: "chatbot",
    description: "Context window display for RAG/sources",
    component: Context,
    demoFactory: () => ({ usedTokens: 1500, maxTokens: 4096, modelId: "gpt-4" }),
    isInteractive: false,
  },
  {
    id: "conversation",
    title: "Conversation",
    category: "chatbot",
    description: "Container for chat messages with scroll and empty states",
    component: Conversation,
    demoFactory: () => ({ children: null }),
    isInteractive: false,
  },
  {
    id: "inline-citation",
    title: "Inline Citation",
    category: "chatbot",
    description: "Inline source citation reference",
    component: InlineCitation,
    demoFactory: () => ({ number: 1 }),
    isInteractive: false,
  },
  {
    id: "message",
    title: "Message",
    category: "chatbot",
    description: "Individual chat message component",
    component: Message,
    demoFactory: () => ({ role: "assistant", children: "Hello, I'm an AI assistant. How can I help you today?" }),
    isInteractive: false,
  },
  {
    id: "model-selector",
    title: "Model Selector",
    category: "chatbot",
    description: "AI model selection dropdown",
    component: ModelSelector,
    demoFactory: () => ({ models: [{ id: "gpt-4", name: "GPT-4" }] }),
    isInteractive: true,
  },
  {
    id: "plan",
    title: "Plan",
    category: "chatbot",
    description: "Multi-step plan visualization",
    component: Plan,
    demoFactory: () => ({ steps: [{ id: "1", title: "Step 1", status: "completed" }] }),
    isInteractive: false,
  },
  {
    id: "prompt-input",
    title: "Prompt Input",
    category: "chatbot",
    description: "Input area with attachments and submit",
    component: PromptInput,
    demoFactory: () => ({ onSubmit: () => {} }),
    isInteractive: true,
  },
  {
    id: "queue",
    title: "Queue",
    category: "chatbot",
    description: "Task queue visualization",
    component: Queue,
    demoFactory: () => ({ children: null }),
    isInteractive: false,
  },
  {
    id: "reasoning",
    title: "Reasoning",
    category: "chatbot",
    description: "Expandable reasoning/thinking section",
    component: Reasoning,
    demoFactory: () => ({ children: "Thinking step by step..." }),
    isInteractive: true,
  },
  {
    id: "shimmer",
    title: "Shimmer",
    category: "chatbot",
    description: "Loading placeholder animation",
    component: Shimmer,
    demoFactory: () => ({}),
    isInteractive: false,
  },
  {
    id: "sources",
    title: "Sources",
    category: "chatbot",
    description: "Source citations and references",
    component: Sources,
    demoFactory: () => ({ sources: [{ id: "1", title: "Example Source" }] }),
    isInteractive: false,
  },
  {
    id: "suggestion",
    title: "Suggestion",
    category: "chatbot",
    description: "Suggestion chips for quick actions",
    component: Suggestion,
    demoFactory: () => ({ suggestion: "Explain this code", onClick: () => {} }),
    isInteractive: true,
  },
  {
    id: "task",
    title: "Task",
    category: "chatbot",
    description: "Individual task display",
    component: Task,
    demoFactory: () => ({ defaultOpen: true, children: null }),
    isInteractive: false,
  },
  {
    id: "tool",
    title: "Tool",
    category: "chatbot",
    description: "Tool invocation display with input/output",
    component: Tool,
    demoFactory: () => ({ defaultOpen: true }),
    isInteractive: true,
  },

  // ========================================================================
  // CODE (15 components)
  // ========================================================================
  {
    id: "agent",
    title: "Agent",
    category: "code",
    description: "Agent information and configuration card",
    component: AgentCard,
    demoFactory: () => ({ children: null }),
    isInteractive: false,
  },
  {
    id: "artifact",
    title: "Artifact",
    category: "code",
    description: "Generated artifact display container",
    component: Artifact,
    demoFactory: () => ({ children: null }),
    isInteractive: false,
  },
  {
    id: "code-block",
    title: "Code Block",
    category: "code",
    description: "Syntax-highlighted code display",
    component: CodeBlock,
    demoFactory: () => ({ code: "console.log('hello');", language: "javascript" }),
    isInteractive: false,
  },
  {
    id: "commit",
    title: "Commit",
    category: "code",
    description: "Git commit visualization",
    component: Commit,
    demoFactory: () => ({ hash: "abc123", message: "Demo commit" }),
    isInteractive: false,
  },
  {
    id: "environment-variables",
    title: "Environment Variables",
    category: "code",
    description: "Environment variable editor/display",
    component: EnvironmentVariables,
    demoFactory: () => ({ children: null }),
    isInteractive: true,
  },
  {
    id: "file-tree",
    title: "File Tree",
    category: "code",
    description: "File system tree visualization",
    component: FileTree,
    demoFactory: () => ({ children: null }),
    isInteractive: true,
  },
  {
    id: "jsx-preview",
    title: "JSX Preview",
    category: "code",
    description: "Live JSX component preview",
    component: JSXPreview,
    demoFactory: () => ({ code: "<div>Hello World</div>" }),
    isInteractive: false,
  },
  {
    id: "package-info",
    title: "Package Info",
    category: "code",
    description: "Package dependency information",
    component: PackageInfo,
    demoFactory: () => ({ name: "react", version: "^18.0.0" }),
    isInteractive: false,
  },
  {
    id: "sandbox",
    title: "Sandbox",
    category: "code",
    description: "Isolated code execution environment",
    component: Sandbox,
    demoFactory: () => ({ children: null }),
    isInteractive: true,
  },
  {
    id: "schema-display",
    title: "Schema Display",
    category: "code",
    description: "JSON schema visualization",
    component: SchemaDisplay,
    demoFactory: () => ({ method: "POST", path: "/api/example", description: "Example API endpoint" }),
    isInteractive: false,
  },
  {
    id: "snippet",
    title: "Snippet",
    category: "code",
    description: "Code snippet with copy action",
    component: Snippet,
    demoFactory: () => ({ code: "npm install ai" }),
    isInteractive: true,
  },
  {
    id: "stack-trace",
    title: "Stack Trace",
    category: "code",
    description: "Error stack trace display",
    component: StackTrace,
    demoFactory: () => ({ trace: "Error: Something went wrong\n  at line 1" }),
    isInteractive: false,
  },
  {
    id: "terminal",
    title: "Terminal",
    category: "code",
    description: "Terminal output display",
    component: Terminal,
    demoFactory: () => ({ output: "$ ls -la\ntotal 0" }),
    isInteractive: false,
  },
  {
    id: "test-results",
    title: "Test Results",
    category: "code",
    description: "Test execution results display",
    component: TestResults,
    demoFactory: () => ({ passed: 5, failed: 0, skipped: 0 }),
    isInteractive: false,
  },
  {
    id: "web-preview",
    title: "Web Preview",
    category: "code",
    description: "Live web preview panel",
    component: WebPreview,
    demoFactory: () => ({ url: "https://example.com" }),
    isInteractive: false,
  },

  // ========================================================================
  // VOICE (6 components)
  // ========================================================================
  {
    id: "audio-player",
    title: "Audio Player",
    category: "voice",
    description: "Audio playback component",
    component: AudioPlayer,
    demoFactory: () => ({ children: null }),
    isInteractive: true,
  },
  {
    id: "mic-selector",
    title: "Mic Selector",
    category: "voice",
    description: "Microphone device selector",
    component: MicSelector,
    demoFactory: () => ({ devices: [{ id: "1", label: "Default Mic" }] }),
    isInteractive: true,
  },
  {
    id: "persona",
    title: "Persona",
    category: "voice",
    description: "Voice persona configuration",
    component: Persona,
    demoFactory: () => ({ name: "Professional", tone: "formal" }),
    isInteractive: false,
  },
  {
    id: "speech-input",
    title: "Speech Input",
    category: "voice",
    description: "Voice recording input",
    component: SpeechInput,
    demoFactory: () => ({ onTranscriptionChange: () => {} }),
    isInteractive: true,
  },
  {
    id: "transcription",
    title: "Transcription",
    category: "voice",
    description: "Transcription result display",
    component: Transcription,
    demoFactory: () => ({ 
      segments: [{ text: "This is a transcription of speech.", start: 0, end: 3 }]
    }),
    isInteractive: false,
  },
  {
    id: "voice-selector",
    title: "Voice Selector",
    category: "voice",
    description: "Voice personality selector",
    component: VoiceSelector,
    demoFactory: () => ({ voices: [{ id: "1", name: "Default Voice" }] }),
    isInteractive: true,
  },

  // ========================================================================
  // WORKFLOW (7 components)
  // ========================================================================
  {
    id: "canvas",
    title: "Canvas",
    category: "workflow",
    description: "Visual workflow canvas",
    component: Canvas,
    demoFactory: () => ({ nodes: [], edges: [] }),
    isInteractive: true,
  },
  {
    id: "connection",
    title: "Connection",
    category: "workflow",
    description: "Workflow connection/node link",
    component: Connection,
    demoFactory: () => ({ from: "node-1", to: "node-2" }),
    isInteractive: false,
  },
  {
    id: "controls",
    title: "Controls",
    category: "workflow",
    description: "Canvas controls (zoom, fit, etc)",
    component: Controls,
    demoFactory: () => ({ onZoomIn: () => {}, onZoomOut: () => {} }),
    isInteractive: true,
  },
  {
    id: "edge",
    title: "Edge",
    category: "workflow",
    description: "Graph edge component",
    component: EdgeExports.Animated,
    demoFactory: () => ({ id: "edge-1", source: "node-1", target: "node-2" }),
    isInteractive: false,
  },
  {
    id: "node",
    title: "Node",
    category: "workflow",
    description: "Workflow node component",
    component: Node,
    demoFactory: () => ({ handles: { target: true, source: true }, children: "Demo Node" }),
    isInteractive: true,
  },
  {
    id: "panel",
    title: "Panel",
    category: "workflow",
    description: "Resizable panel container",
    component: Panel,
    demoFactory: () => ({ title: "Demo Panel" }),
    isInteractive: false,
  },
  {
    id: "toolbar",
    title: "Toolbar",
    category: "workflow",
    description: "Action toolbar container",
    component: Toolbar,
    demoFactory: () => ({}),
    isInteractive: true,
  },

  // ========================================================================
  // UTILITIES (2 components)
  // ========================================================================
  {
    id: "image",
    title: "Image",
    category: "utilities",
    description: "Image display with loading state",
    component: Image,
    demoFactory: () => ({ base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", mediaType: "image/png", alt: "Demo" }),
    isInteractive: false,
  },
  {
    id: "open-in-chat",
    title: "Open In Chat",
    category: "utilities",
    description: "Share to chat action",
    component: OpenIn,
    demoFactory: () => ({}),
    isInteractive: true,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getComponentById(id: string): AIElementEntry | undefined {
  return AI_ELEMENTS_REGISTRY.find((entry) => entry.id === id);
}

export function getComponentsByCategory(category: ComponentCategory): AIElementEntry[] {
  return AI_ELEMENTS_REGISTRY.filter((entry) => entry.category === category);
}

export function getAllCategories(): ComponentCategory[] {
  return [...new Set(AI_ELEMENTS_REGISTRY.map((e) => e.category))];
}

export function getCoverageStats(): {
  total: number;
  byCategory: Record<ComponentCategory, number>;
} {
  const byCategory = {} as Record<ComponentCategory, number>;
  
  for (const entry of AI_ELEMENTS_REGISTRY) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }
  
  return {
    total: AI_ELEMENTS_REGISTRY.length,
    byCategory,
  };
}

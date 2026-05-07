/**
 * Kernel Adapter for ChatJS Integration
 * 
 * Bridges ChatJS's expected AI SDK patterns with allternit kernel.
 */

import { env } from "../env";
import type { ChatMessage, ModelData } from "./types";

// Kernel configuration types
export interface KernelConfig {
  id: string;
  name: string;
  brain_type: "cli" | "api" | "local";
  model?: string;
  endpoint?: string;
  api_key_env?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  requirements: Array<{
    kind: "binary" | "env_var" | "dependency";
    name: string;
    package_manager?: string;
  }>;
  sandbox?: {
    workspace_only: boolean;
    network_enabled: boolean;
    tool_allowlist?: string[];
  };
}

// Kernel event types
export type KernelEvent =
  | { type: "session.created"; payload: { session_id: string } }
  | { type: "session.status"; payload: { status: string } }
  | { type: "chat.delta"; payload: { text: string } }
  | { type: "chat.message.completed"; payload: { text: string } }
  | { type: "terminal.delta"; payload: { data: string; stream: string } }
  | { type: "tool.call"; payload: { tool_id: string; call_id: string; args: string } }
  | { type: "tool.result"; payload: { tool_id: string; call_id: string; result: string } }
  | { type: "artifact.created"; payload: { id: string; kind: string; content: string } }
  | { type: "error"; payload: { message: string } }
  | { type: string; payload: any };

// Model configuration builder
export function buildKernelConfig(modelId: string): KernelConfig {
  switch (modelId) {
    case "claude-code":
    case "claude-3-5-sonnet":
      return {
        id: "claude-code",
        name: "Claude Code CLI",
        brain_type: "cli",
        model: "claude-3-5-sonnet",
        api_key_env: "ANTHROPIC_API_KEY",
        command: "claude",
        args: ["--output-format", "stream-json"],
        requirements: [{ kind: "binary", name: "claude" }],
      };
    case "codex":
    default:
      return {
        id: "codex",
        name: "Codex CLI",
        brain_type: "cli",
        model: "codex",
        api_key_env: "OPENAI_API_KEY",
        command: "codex",
        args: [],
        requirements: [{ kind: "binary", name: "codex" }],
      };
  }
}

// Create kernel session
export async function createKernelSession(
  modelId: string
): Promise<{ id: string; config: KernelConfig }> {
  const config = buildKernelConfig(modelId);
  
  const response = await fetch(`${env.NEXT_PUBLIC_KERNEL_URL}/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, profile_id: modelId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create kernel session: ${error}`);
  }

  const data = await response.json();
  return { id: data.id, config };
}

// Send input to kernel session
export async function sendKernelInput(
  sessionId: string,
  input: string
): Promise<void> {
  const response = await fetch(
    `${env.NEXT_PUBLIC_KERNEL_URL}/v1/sessions/${sessionId}/input`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input + "\n"),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send input: ${error}`);
  }
}

// Create event source for kernel session
export function createKernelEventSource(
  sessionId: string
): EventSource {
  return new EventSource(
    `${env.NEXT_PUBLIC_KERNEL_URL}/v1/sessions/${sessionId}/events`
  );
}

// Stream processor for kernel events
export interface StreamHandlers {
  onTextDelta?: (text: string) => void;
  onToolCall?: (toolCallId: string, toolName: string, args: unknown) => void;
  onToolResult?: (toolCallId: string, result: unknown) => void;
  onArtifact?: (artifactId: string, kind: string, content: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export function processKernelStream(
  eventSource: EventSource,
  handlers: StreamHandlers
): () => void {
  const { onTextDelta, onToolCall, onToolResult, onArtifact, onError, onComplete } = handlers;

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as KernelEvent;

      switch (data.type) {
        case "chat.delta":
          onTextDelta?.(data.payload.text);
          break;

        case "tool.call": {
          let parsedArgs: unknown = {};
          if (data.payload.args) {
            try {
              parsedArgs = JSON.parse(data.payload.args);
            } catch {
              parsedArgs = { raw: data.payload.args };
            }
          }
          onToolCall?.(data.payload.call_id, data.payload.tool_id, parsedArgs);
          break;
        }

        case "tool.result":
          onToolResult?.(data.payload.call_id, data.payload.result);
          break;

        case "artifact.created":
          onArtifact?.(data.payload.id, data.payload.kind, data.payload.content);
          break;

        case "error":
          onError?.(data.payload.message);
          break;

        case "chat.message.completed":
        case "session.status":
          if (
            data.type === "chat.message.completed" ||
            data.payload.status === "exited" ||
            data.payload.status === "terminated"
          ) {
            onComplete?.();
            eventSource.close();
          }
          break;
      }
    } catch (err) {
      console.error("Error processing kernel event:", err);
    }
  };

  eventSource.onerror = () => {
    onError?.("Event stream error");
    onComplete?.();
    eventSource.close();
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

// Convert kernel messages to ChatJS format
export function convertKernelToChatJSMessage(
  kernelMessage: any
): ChatMessage {
  return {
    id: kernelMessage.id || `msg-${Date.now()}`,
    role: kernelMessage.role || "assistant",
    content: kernelMessage.content || "",
    metadata: {
      createdAt: kernelMessage.createdAt || new Date().toISOString(),
      usage: kernelMessage.usage,
    },
  };
}

// Get available models
export function getAvailableModels(): ModelData[] {
  return [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      description: "Most capable multimodal model",
      runtimeType: "api",
      features: { vision: true, fileUpload: true, webSearch: true },
    },
    {
      id: "claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      provider: "anthropic",
      description: "Excellent for coding and analysis",
      runtimeType: "api",
      features: { vision: true, fileUpload: true, webSearch: false },
    },
    {
      id: "codex",
      name: "Codex CLI",
      provider: "allternit-kernel",
      description: "Local CLI agent via kernel",
      runtimeType: "cli",
      features: { vision: false, fileUpload: false, webSearch: false },
    },
    {
      id: "claude-code",
      name: "Claude Code",
      provider: "allternit-kernel",
      description: "Claude Code CLI via kernel",
      runtimeType: "cli",
      features: { vision: false, fileUpload: false, webSearch: false },
    },
  ];
}

// Chat completion with kernel
export async function streamChatCompletion(
  messages: ChatMessage[],
  modelId: string,
  handlers: StreamHandlers
): Promise<{ sessionId: string; abort: () => void }> {
  // Create session
  const { id: sessionId } = await createKernelSession(modelId);

  // Send messages as input
  const lastMessage = messages[messages.length - 1];
  const input = typeof lastMessage.content === "string"
    ? lastMessage.content
    : lastMessage.content.map(c => c.type === "text" ? c.text : "").join("");

  await sendKernelInput(sessionId, input);

  // Create event source
  const eventSource = createKernelEventSource(sessionId);

  // Process stream
  const cleanup = processKernelStream(eventSource, handlers);

  return {
    sessionId,
    abort: () => {
      cleanup();
      eventSource.close();
    },
  };
}

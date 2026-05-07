import type { LanguageModelUsage } from "ai";
import type { AppModelId } from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import { systemPrompt } from "@/lib/ai/prompts";
import type { ChatMessage, StreamWriter, ToolName, MessagePart } from "@/lib/ai/types";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { createModuleLogger } from "@/lib/logger";
import { generateUUID } from "@/lib/utils";

const log = createModuleLogger("eval-agent");

// No-op StreamWriter for evals - tools can write but nothing happens
function createNoOpStreamWriter(): StreamWriter {
  return {
    writeData: () => {
      // Intentional no-op for evaluation context
    },
    writeMessageAnnotation: () => {
      // Intentional no-op for evaluation context
    },
    write: () => {
      // Intentional no-op for evaluation context
    },
    merge: () => {
      // Intentional no-op for evaluation context
    },
  };
}

export type EvalAgentResult = {
  finalText: string;
  assistantMessage: ChatMessage;
  usage: LanguageModelUsage | undefined;
  toolResults: Array<{
    toolName: string;
    type: string;
    state?: string;
  }>;
  followupSuggestions: string[];
};

// Type guard for tool part types
function isToolPartType(type: string): type is `tool-${string}` {
  return type.startsWith("tool-");
}

// Extract text content from stream chunks
async function consumeStreamToText(
  stream: ReadableStream<unknown>
): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (typeof value === "string") {
        text += value;
      } else if (value && typeof value === "object") {
        // Handle different chunk types
        const chunk = value as Record<string, unknown>;
        if (typeof chunk.text === "string") {
          text += chunk.text;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  return text;
}

// Extract tool calls from stream steps
function extractToolResults(steps: unknown[]): Array<{
  toolName: string;
  type: string;
  state?: string;
}> {
  const toolResults: Array<{ toolName: string; type: string; state?: string }> = [];
  
  for (const step of steps) {
    if (typeof step !== "object" || step === null) continue;
    
    const stepObj = step as Record<string, unknown>;
    
    // Process tool results
    if (Array.isArray(stepObj.toolResults)) {
      for (const toolResult of stepObj.toolResults) {
        if (typeof toolResult === "object" && toolResult !== null) {
          const tr = toolResult as Record<string, unknown>;
          const toolName = typeof tr.toolName === "string" ? tr.toolName : "unknown";
          
          toolResults.push({
            toolName,
            type: `tool-${toolName}`,
            state: "result",
          });
        }
      }
    }
    
    // Also process tool calls to capture input-available state
    if (Array.isArray(stepObj.toolCalls)) {
      for (const toolCall of stepObj.toolCalls) {
        if (typeof toolCall === "object" && toolCall !== null) {
          const tc = toolCall as Record<string, unknown>;
          const toolName = typeof tc.toolName === "string" ? tc.toolName : "unknown";
          
          // Only add if not already present
          if (!toolResults.find(tr => tr.toolName === toolName && tr.state === "result")) {
            toolResults.push({
              toolName,
              type: `tool-${toolName}`,
              state: "loading",
            });
          }
        }
      }
    }
  }
  
  return toolResults;
}

// Build message parts from stream result
function buildMessageParts(
  textContent: string,
  steps: unknown[]
): MessagePart[] {
  const parts: MessagePart[] = [];
  
  // Add text part if we have content
  if (textContent.trim()) {
    parts.push({
      type: "text",
      text: textContent,
    });
  }
  
  // Extract tool parts from steps
  for (const step of steps) {
    if (typeof step !== "object" || step === null) continue;
    
    const stepObj = step as Record<string, unknown>;
    
    // Process tool results
    if (Array.isArray(stepObj.toolResults)) {
      for (const toolResult of stepObj.toolResults) {
        if (typeof toolResult === "object" && toolResult !== null) {
          const tr = toolResult as Record<string, unknown>;
          const toolName = typeof tr.toolName === "string" ? tr.toolName : "unknown";
          const toolCallId = typeof tr.toolCallId === "string" ? tr.toolCallId : generateUUID();
          
          parts.push({
            type: `tool-${toolName}`,
            toolCallId,
            toolName,
            state: "result",
            output: tr.result,
          } as MessagePart);
        }
      }
    }
  }
  
  return parts;
}

export async function evalAgent({
  userMessage,
  previousMessages,
  selectedModelId,
  explicitlyRequestedTool,
  userId,
  activeTools,
  abortSignal,
}: {
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  explicitlyRequestedTool: keyof import("./types").ChatTools | null;
  userId: string;
  activeTools: string[];
  abortSignal?: AbortSignal;
}): Promise<EvalAgentResult> {
  const messageId = generateUUID();
  const costAccumulator = new CostAccumulator();
  const streamWriter = createNoOpStreamWriter();
  
  const explicitlyRequestedTools = determineExplicitlyRequestedTools(
    explicitlyRequestedTool
  );

  try {
    // Create the chat agent
    const { result } = await createCoreChatAgent({
      system: systemPrompt(),
      userMessage,
      previousMessages,
      selectedModelId,
      explicitlyRequestedTools,
      userId,
      budgetAllowedTools: explicitlyRequestedTools 
        ? explicitlyRequestedTools.filter((t): t is ToolName => t !== null)
        : [],
      abortSignal,
      messageId,
      dataStream: streamWriter,
      costAccumulator,
    });

    // Consume the stream to get text output
    const finalText = await consumeStreamToText(result.textStream);
    
    // Get steps for tool extraction
    const steps = await result.steps;
    const toolResults = extractToolResults(steps);
    const parts = buildMessageParts(finalText, steps);

    // Build the assistant message
    const assistantMessage: ChatMessage = {
      id: messageId,
      role: "assistant",
      content: parts,
      metadata: {
        createdAt: new Date().toISOString(),
        parentMessageId: userMessage.id,
      },
    };

    // Get usage info from cost accumulator
    const usage: LanguageModelUsage = {
      inputTokens: costAccumulator.inputTokens,
      outputTokens: costAccumulator.outputTokens,
      totalTokens: costAccumulator.inputTokens + costAccumulator.outputTokens,
      // Add required inputTokenDetails
      inputTokenDetails: {
        noCacheTokens: costAccumulator.inputTokens,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      // Add required outputTokenDetails
      outputTokenDetails: {
        textTokens: costAccumulator.outputTokens,
        reasoningTokens: undefined,
      },
    };

    return {
      finalText,
      assistantMessage,
      usage,
      toolResults,
      followupSuggestions: [], // Follow-up suggestions not generated in eval mode
    };
  } catch (error) {
    log.error(`Eval agent execution failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return error result
    return {
      finalText: `Error: ${error instanceof Error ? error.message : String(error)}`,
      assistantMessage: {
        id: messageId,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        parts: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        }],
        metadata: {
          createdAt: new Date().toISOString(),
          parentMessageId: userMessage.id,
        },
      },
      usage: undefined,
      toolResults: [],
      followupSuggestions: [],
    };
  }
}

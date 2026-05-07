/**
 * Agent Tools Index
 * 
 * Registry and execution handlers for all native agent tools.
 * Each tool has a definition (for LLM visibility) and an execution handler.
 * 
 * @module agent-tools
 */

import {
  executeAskUserTool,
  ASK_USER_TOOL_DEFINITION,
} from "./ask-user.tool";
import {
  READ_FILE_DEFINITION,
  WRITE_FILE_DEFINITION,
  SEARCH_CODE_DEFINITION,
  LIST_DIRECTORY_DEFINITION,
  DELETE_FILE_DEFINITION,
  executeReadFile,
  executeWriteFile,
  executeSearchCode,
  executeListDirectory,
  executeDeleteFile,
} from "./file-tools";
import {
  HTTP_REQUEST_DEFINITION,
  FETCH_JSON_DEFINITION,
  WEBHOOK_DEFINITION,
  executeHttpRequest,
  executeFetchJson,
  executeSendWebhook,
} from "./api-tools";
import {
  GIT_STATUS_DEFINITION,
  GIT_LOG_DEFINITION,
  GIT_DIFF_DEFINITION,
  GIT_BRANCH_DEFINITION,
  GIT_SHOW_DEFINITION,
  executeGitStatus,
  executeGitLog,
  executeGitDiff,
  executeGitBranch,
  executeGitShow,
} from "./git-tools";
import {
  RUN_TESTS_DEFINITION,
  CHECK_COVERAGE_DEFINITION,
  LINT_CHECK_DEFINITION,
  TYPE_CHECK_DEFINITION,
  executeRunTests,
  executeCheckCoverage,
  executeLintCheck,
  executeTypeCheck,
} from "./test-tools";

import { designExtractorTool } from "./design-extractor.tool";
import { videoUseTool } from "./video-use.tool";
import { metadataGenTool } from "./metadata-gen.tool";
import { marketingSkillsTool } from "./marketing-skills.tool";
import { designInspirationTool } from "./design-inspiration.tool";
import { penpotSyncTool } from "./penpot-sync.tool";
import { socialCardTool } from "./social-card.tool";
import { skillGraphTool } from "./skill-graph.tool";

// ============================================================================
// Tool Definitions
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolExecutionContext {
  sessionId: string;
  toolCallId: string;
  abortSignal?: AbortSignal;
}

export type ToolExecutionHandler = (
  context: ToolExecutionContext,
  parameters: Record<string, unknown>
) => Promise<{ result: unknown; error?: string }>;

// ============================================================================
// Tool Registry
// ============================================================================

const toolDefinitions = new Map<string, ToolDefinition>();
const toolHandlers = new Map<string, ToolExecutionHandler>();

/**
 * Register a tool with the system
 */
export function registerTool(
  definition: ToolDefinition,
  handler: ToolExecutionHandler
): void {
  if (toolDefinitions.has(definition.name)) {
    throw new Error(`Tool "${definition.name}" is already registered`);
  }
  toolDefinitions.set(definition.name, definition);
  toolHandlers.set(definition.name, handler);
}

/**
 * Get a tool's definition (for LLM)
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return toolDefinitions.get(name);
}

/**
 * Get all registered tool definitions
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  return Array.from(toolDefinitions.values());
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(name: string): boolean {
  return toolHandlers.has(name);
}

/**
 * Unregister a tool from the system
 */
export function unregisterTool(name: string): boolean {
  const existed = toolDefinitions.has(name);
  toolDefinitions.delete(name);
  toolHandlers.delete(name);
  return existed;
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  context: ToolExecutionContext,
  parameters: Record<string, unknown>
): Promise<{ result: unknown; error?: string }> {
  const handler = toolHandlers.get(toolName);
  
  if (!handler) {
    return {
      result: null,
      error: `Tool "${toolName}" is not registered`,
    };
  }

  try {
    return await handler(context, parameters);
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

// ============================================================================
// Built-in Tool Registration
// ============================================================================

// Ask User Tool
registerTool(
  ASK_USER_TOOL_DEFINITION as ToolDefinition,
  async (context, parameters) => {
    return executeAskUserTool(
      context.sessionId,
      context.toolCallId,
      parameters
    );
  }
);

// File System Tools
registerTool(READ_FILE_DEFINITION, executeReadFile);
registerTool(WRITE_FILE_DEFINITION, executeWriteFile);
registerTool(SEARCH_CODE_DEFINITION, executeSearchCode);
registerTool(LIST_DIRECTORY_DEFINITION, executeListDirectory);
registerTool(DELETE_FILE_DEFINITION, executeDeleteFile);

// API Tools
registerTool(HTTP_REQUEST_DEFINITION, executeHttpRequest);
registerTool(FETCH_JSON_DEFINITION, executeFetchJson);
registerTool(WEBHOOK_DEFINITION, executeSendWebhook);

// Git Tools
registerTool(GIT_STATUS_DEFINITION, executeGitStatus);
registerTool(GIT_LOG_DEFINITION, executeGitLog);
registerTool(GIT_DIFF_DEFINITION, executeGitDiff);
registerTool(GIT_BRANCH_DEFINITION, executeGitBranch);
registerTool(GIT_SHOW_DEFINITION, executeGitShow);

// Test Tools
registerTool(RUN_TESTS_DEFINITION, executeRunTests);
registerTool(CHECK_COVERAGE_DEFINITION, executeCheckCoverage);
registerTool(LINT_CHECK_DEFINITION, executeLintCheck);
registerTool(TYPE_CHECK_DEFINITION, executeTypeCheck);

// Design & Marketing Tools
registerTool(designExtractorTool as any, designExtractorTool.execute as any);
registerTool(videoUseTool as any, videoUseTool.execute as any);
registerTool(metadataGenTool as any, metadataGenTool.execute as any);
registerTool(marketingSkillsTool as any, marketingSkillsTool.execute as any);
registerTool(designInspirationTool as any, designInspirationTool.execute as any);
registerTool(penpotSyncTool as any, penpotSyncTool.execute as any);
registerTool(socialCardTool as any, socialCardTool.execute as any);
registerTool(skillGraphTool as any, skillGraphTool.execute as any);

// ============================================================================
// Re-exports
// ============================================================================

export { ASK_USER_TOOL_DEFINITION, type AskUserToolActions, type AskUserToolState, type PendingQuestion, type QuestionConfig, type QuestionOption, type QuestionResponse, type QuestionType, type ValidationRule, executeAskUserTool, formatQuestionForDisplay, useAskUserToolStore, validateAnswer } from './ask-user.tool';
export {
  READ_FILE_DEFINITION,
  WRITE_FILE_DEFINITION,
  SEARCH_CODE_DEFINITION,
  LIST_DIRECTORY_DEFINITION,
  DELETE_FILE_DEFINITION,
  executeReadFile,
  executeWriteFile,
  executeSearchCode,
  executeListDirectory,
  executeDeleteFile,
  type SearchResult,
  type FileEntry,
  FilesApiClientError,
} from "./file-tools";
export { FETCH_JSON_DEFINITION, HTTP_REQUEST_DEFINITION, type HttpResponse, WEBHOOK_DEFINITION, executeFetchJson, executeHttpRequest, executeSendWebhook } from './api-tools';
export { GIT_BRANCH_DEFINITION, GIT_DIFF_DEFINITION, GIT_LOG_DEFINITION, GIT_SHOW_DEFINITION, GIT_STATUS_DEFINITION, type GitBranch, type GitCommit, type GitDiff, type GitStatus, executeGitBranch, executeGitDiff, executeGitLog, executeGitShow, executeGitStatus } from './git-tools';
export { CHECK_COVERAGE_DEFINITION, type CoverageReport, LINT_CHECK_DEFINITION, type LintResult, RUN_TESTS_DEFINITION, TYPE_CHECK_DEFINITION, type TestResult, type TypeCheckResult, executeCheckCoverage, executeLintCheck, executeRunTests, executeTypeCheck } from './test-tools';

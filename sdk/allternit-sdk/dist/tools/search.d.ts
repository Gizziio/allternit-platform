import type { ToolDefinition } from './types.js';
import type { ToolRegistry } from './registry.js';
import { type WebToolOptions } from './web.js';
import { type McpServerAttachment, type McpServerConfig } from './mcp.js';
import { type TextEditorOptions } from './text-editor.js';
import { type BashRunner } from './bash.js';
import { type CodeExecutionRunner } from './code-execution.js';
import { type MemoryToolOptions } from './memory.js';
import { type PdfToolOptions } from './pdf.js';
export interface NativeToolBeltOptions extends WebToolOptions, TextEditorOptions, MemoryToolOptions, PdfToolOptions {
    bashRunner?: BashRunner;
    codeExecutionRunner?: CodeExecutionRunner;
    /** Override the default ~/.allternit/mcp-servers.json path. */
    mcpDirectoryPath?: string;
}
/**
 * tool_search Tool Definition
 */
export declare const TOOL_SEARCH_DEFINITION: ToolDefinition;
/**
 * tool_activate Tool Definition
 */
export declare const TOOL_ACTIVATE_DEFINITION: ToolDefinition;
export declare class NativeToolBelt {
    private registry;
    /** Resolves once the initial ~/.allternit/mcp-servers.json directory load finishes. */
    readonly mcpDirectoryLoaded: Promise<void>;
    constructor(registry: ToolRegistry, options?: NativeToolBeltOptions);
    attachMcpServer(server: McpServerAttachment): Promise<string[]>;
    attachMcpServer(config: McpServerConfig): Promise<string[]>;
    getRegistry(): ToolRegistry;
}

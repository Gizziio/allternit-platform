import type { ToolDefinition } from './types.js';
import type { ToolRegistry } from './registry.js';
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
    constructor(registry: ToolRegistry);
    getRegistry(): ToolRegistry;
}

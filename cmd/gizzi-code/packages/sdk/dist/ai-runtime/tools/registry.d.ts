import { EventEmitter } from 'events';
import type { ToolDefinition, DeferredToolDefinition, ToolRegistrySnapshot, ToolPolicy } from './types.js';
export declare class ToolRegistry extends EventEmitter {
    private tools;
    private deferredTools;
    private activeTools;
    private discoveredTools;
    private policies;
    constructor();
    /**
     * Global registration (Startup)
     */
    registerTool(tool: ToolDefinition): void;
    registerDeferredTool(tool: DeferredToolDefinition): void;
    /**
     * Session-scoped Activation
     */
    activateTool(toolId: string): void;
    getActiveTools(): ToolDefinition[];
    setPolicy(toolName: string, policy: ToolPolicy): void;
    getPolicy(toolName: string): ToolPolicy;
    /**
     * Snapshot for Persistence
     */
    snapshot(): ToolRegistrySnapshot;
    rehydrate(snapshot: ToolRegistrySnapshot): void;
    /**
     * Tool Search (Native Primitive)
     */
    search(query: string): DeferredToolDefinition[];
}
//# sourceMappingURL=registry.d.ts.map
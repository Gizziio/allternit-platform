import { ToolRegistry } from '../tools/registry.js';
import { NativeToolBelt } from '../tools/search.js';
/**
 * RunState - Manages the tool belt and session context for a single run
 */
export declare class RunState {
    toolRegistry: ToolRegistry;
    toolBelt: NativeToolBelt;
    constructor();
    /**
     * Returns active tool schemas for provider injection
     */
    getActiveToolSchemas(): any[];
    /**
     * Handle internal tools (search/activate) or route to capability
     */
    handleToolCall(name: string, args: any, context: any): Promise<any>;
    private emitLifecycleEvent;
}

import { ToolRegistry } from '../tools/registry.js';
import { NativeToolBelt } from '../tools/search.js';
/**
 * RunState - Manages the tool belt and session context for a single run
 */
export class RunState {
    toolRegistry;
    toolBelt;
    constructor() {
        this.toolRegistry = new ToolRegistry();
        this.toolBelt = new NativeToolBelt(this.toolRegistry);
    }
    /**
     * Returns active tool schemas for provider injection
     */
    getActiveToolSchemas() {
        return this.toolRegistry.getActiveTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema
        }));
    }
    /**
     * Handle internal tools (search/activate) or route to capability
     */
    async handleToolCall(name, args, context) {
        const tool = this.toolRegistry.getActiveTools().find(t => t.name === name);
        if (!tool)
            return null;
        // 1. Pre-execution hook
        if (tool.preExecute) {
            const { proceed, reason } = await tool.preExecute(args, context);
            if (!proceed) {
                this.emitLifecycleEvent('tool.failed', { toolName: name, callId: context.callId, error: reason || 'Pre-execution hook blocked tool' });
                return { error: reason || 'Execution blocked by policy' };
            }
        }
        this.emitLifecycleEvent('tool.called', { toolName: name, callId: context.callId, input: args });
        try {
            // 2. Execution
            let result;
            if (tool.execute) {
                result = await tool.execute(args, context);
            }
            else {
                return null; // Not handled here (e.g. by provider or specific capability)
            }
            // 3. Post-execution hook
            if (tool.postExecute) {
                result = await tool.postExecute(args, result, context);
            }
            this.emitLifecycleEvent('tool.completed', { toolName: name, callId: context.callId, output: result });
            return result;
        }
        catch (error) {
            this.emitLifecycleEvent('tool.failed', { toolName: name, callId: context.callId, error: String(error) });
            throw error;
        }
    }
    emitLifecycleEvent(type, data) {
        this.toolRegistry.emit('event', { type, ...data });
    }
}

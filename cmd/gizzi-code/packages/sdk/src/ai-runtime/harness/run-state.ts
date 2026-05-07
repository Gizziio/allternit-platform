import { ToolRegistry } from '../tools/registry.js';
import { NativeToolBelt } from '../tools/search.js';
import type { ToolDefinition } from '../tools/types.js';

/**
 * RunState - Manages the tool belt and session context for a single run
 */
export class RunState {
  public toolRegistry: ToolRegistry;
  public toolBelt: NativeToolBelt;

  constructor() {
    this.toolRegistry = new ToolRegistry();
    this.toolBelt = new NativeToolBelt(this.toolRegistry);
  }

  /**
   * Returns active tool schemas for provider injection
   */
  public getActiveToolSchemas(): any[] {
    return this.toolRegistry.getActiveTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    }));
  }

  /**
   * Handle internal tools (search/activate) or route to capability
   */
  public async handleToolCall(name: string, args: any, context: any): Promise<any> {
    const tools = this.toolRegistry.getActiveTools();
    const tool = tools.find(t => t.name === name);
    
    if (tool?.execute) {
      this.emitLifecycleEvent('tool.called', { toolName: name, callId: context.callId, input: args });
      try {
        const result = await tool.execute(args, context);
        this.emitLifecycleEvent('tool.completed', { toolName: name, callId: context.callId, output: result });
        return result;
      } catch (error) {
        this.emitLifecycleEvent('tool.failed', { toolName: name, callId: context.callId, error: String(error) });
        throw error;
      }
    }
    
    return null; // Not an internal tool
  }

  private emitLifecycleEvent(type: string, data: any) {
    this.toolRegistry.emit('event', { type, ...data });
  }
}

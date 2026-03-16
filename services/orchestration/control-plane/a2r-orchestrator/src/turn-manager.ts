import { AgentTurn, OrchestrationContext, ToolCall, ToolResult } from './types.js';
import { ExecutionEngine, ToolExecutor } from '@a2r/engine';

export class TurnManager {
  private toolExecutor: ToolExecutor;

  constructor(private engine: ExecutionEngine) {
    this.toolExecutor = new ToolExecutor(this.engine);
  }

  async buildSystemPrompt(context: OrchestrationContext): Promise<string> {
    return 'You are an A2R agent with role: ' + context.role + '. ' +
           'You have access to the following tools: shell, ls, desktop_control. ' +
           'Use desktop_control for any native application interaction.';
  }

  async executeTurn(context: OrchestrationContext): Promise<AgentTurn> {
    const systemPrompt = await this.buildSystemPrompt(context);
    
    // In a real implementation, this would call the LLM
    // For this implementation, we simulate a turn that might call desktop_control
    
    return {
      role: 'assistant',
      content: 'I will help you with that.',
      toolCalls: [] 
    };
  }

  async handleToolCall(call: ToolCall, context: OrchestrationContext): Promise<ToolResult> {
    console.log(`[TurnManager] Executing tool: ${call.name}`);
    
    const result = await this.toolExecutor.execute({
      tool: call.name,
      arguments: call.arguments,
      context: {
        sessionId: context.sessionId
      }
    });

    return {
      callId: call.id,
      output: result.output,
      error: result.error
    };
  }

  pruneHistory(history: AgentTurn[], maxTurns: number = 10): AgentTurn[] {
    if (history.length <= maxTurns) return history;
    return history.slice(-maxTurns);
  }
}

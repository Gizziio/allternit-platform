import { OrchestrationContext, AgentTurn } from './types.js';
import { TurnManager } from './turn-manager.js';
import { ExecutionEngine } from '@allternit/engine';
import { CDPBridge } from '../../allternit-browser/src/cdp-bridge.js';
import { SkillGenerator } from '../../../2-governance/allternit-governor/src/skill-generator.js';

export class AgentOrchestrator {
  private turnManager: TurnManager;
  private cdpBridge: CDPBridge | null = null;
  private skillGenerator: SkillGenerator;

  constructor(private engine: ExecutionEngine) {
    this.turnManager = new TurnManager(this.engine);
    this.skillGenerator = new SkillGenerator();
  }

  async run(context: OrchestrationContext): Promise<AgentTurn[]> {
    console.log('[Orchestrator] Starting run for session: ' + context.sessionId + ' Mode: ' + (context.mode || 'standard'));
    
    let currentHistory = [...context.history];
    let turnCount = 0;
    const maxTurns = context.maxTurns || 5;

    while (turnCount < maxTurns) {
      turnCount++;
      const turn = await this.turnManager.executeTurn({
        ...context,
        history: currentHistory
      });

      currentHistory.push(turn);
      if (!turn.toolCalls || turn.toolCalls.length === 0) break;

      const toolResults = [];
      for (const call of turn.toolCalls) {
        // Trigger Vision Mode if desktop_control or browser tools are used
        if (call.name === 'desktop_control' || call.name.includes('browser')) {
           console.log(`[Orchestrator] ${call.name} detected. Activating specialized sensors...`);
        }

        const result = await this.turnManager.handleToolCall(call, context);
        toolResults.push(result);
      }

      // Add tool results to history for the next turn
      currentHistory.push({
        role: 'tool',
        content: JSON.stringify(toolResults)
      } as any);
    }

    return currentHistory;
  }
}

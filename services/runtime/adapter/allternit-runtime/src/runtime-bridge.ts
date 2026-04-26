import { NativeBridge } from '../bridges/allternit-native-bridge/index.js'; // Assumes compiled bindings
import { OrchestrationContext } from '@allternit/orchestrator';

export class AllternitRuntimeBridge {
  private native: any;

  constructor() {
    try {
      this.native = new NativeBridge();
    } catch (e) {
      console.warn('[RuntimeBridge] Native bridge not found, falling back to JS implementation');
    }
  }

  async processCommand(input: string, context: OrchestrationContext) {
    // Handling a:// and @ triggers
    if (input.startsWith('a://browser')) {
      context.mode = 'vision';
      console.log('[RuntimeBridge] Switching to VISION mode');
    } else if (input.includes('capture:network')) {
      context.mode = 'network';
      console.log('[RuntimeBridge] Switching to NETWORK mode');
    }

    if (this.native) {
      const policyResponse = await this.native.evaluate_policy(JSON.stringify({
        intent: input,
        context: context.sessionId
      }));
      const decision = JSON.parse(policyResponse);
      if (decision.decision !== 'allow') {
        throw new Error('Policy Violation: ' + decision.reason);
      }
    }

    return context;
  }
}

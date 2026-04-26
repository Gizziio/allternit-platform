export type PolicyDecision = 'allow' | 'deny' | 'ask';

export interface PolicyContext {
  agentId: string;
  tool: string;
  arguments: any;
  securityLevel: 'deny' | 'allowlist' | 'full';
}

export interface AllternitReceipt {
  id: string;
  timestamp: number;
  agentId: string;
  tool: string;
  decision: PolicyDecision;
  reason?: string;
}

export class PolicyEngine {
  private receipts: AllternitReceipt[] = [];

  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    const { tool, securityLevel } = context;

    if (securityLevel === 'deny') {
      return 'deny';
    }

    if (securityLevel === 'full') {
      return 'allow';
    }

    // Default allowlist logic for first-party tools
    if (tool === 'fs.read' || tool === 'fs.list') {
      return 'allow';
    }

    if (tool === 'shell' || tool === 'bash') {
      return 'ask';
    }

    return 'deny';
  }

  generateReceipt(context: PolicyContext, decision: PolicyDecision, reason?: string): AllternitReceipt {
    const receipt: AllternitReceipt = {
      id: Math.random().toString(36).substring(2),
      timestamp: Date.now(),
      agentId: context.agentId,
      tool: context.tool,
      decision,
      reason
    };
    this.receipts.push(receipt);
    return receipt;
  }

  getReceipts(): AllternitReceipt[] {
    return this.receipts;
  }
}

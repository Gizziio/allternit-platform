// 2-governance/stubs/policy.stub.ts
import type { PolicyEngine, PolicyRule, WorkItem, Receipt, PolicyDecision } from '../contracts/policy';

export class StubPolicyEngine implements PolicyEngine {
  async evaluate(request: any, context: any): Promise<PolicyDecision> {
    console.log('[STUB] Evaluating policy for request:', request);
    
    // For now, allow everything with a mock decision
    return {
      allowed: true,
      reason: 'Stub policy allows all operations',
      requiredApprovals: [],
      restrictions: []
    };
  }

  async createWorkItem(item: WorkItem): Promise<WorkItem> {
    console.log('[STUB] Creating work item:', item.title);
    
    return {
      ...item,
      id: 'stub-' + Date.now().toString(),
      status: 'pending',
      createdAt: new Date(),
      metadata: { ...item.metadata, stubbed: true }
    };
  }

  async approveWorkItem(itemId: string, approver: string): Promise<boolean> {
    console.log(`[STUB] Approving work item: ${itemId} by ${approver}`);
    return true; // Mock success
  }

  async getReceipt(operationId: string): Promise<Receipt | null> {
    console.log(`[STUB] Getting receipt for operation: ${operationId}`);
    
    return {
      id: operationId,
      operation: 'mock-operation',
      actor: 'stub-actor',
      timestamp: new Date(),
      inputs: {},
      outputs: {},
      policyApplied: [],
      decision: 'approved',
      evidence: ['stub-evidence']
    };
  }

  async logReceipt(receipt: Receipt): Promise<void> {
    console.log('[STUB] Logging receipt:', receipt.id);
  }
}

// 2-governance/stubs/wih.stub.ts
export class StubWihManager {
  async createWihItem(item: any): Promise<any> {
    console.log('[STUB] Creating WIH item:', item);
    return { ...item, id: 'wih-' + Date.now(), status: 'created' };
  }

  async getWihItem(id: string): Promise<any | null> {
    console.log(`[STUB] Getting WIH item: ${id}`);
    return { id, status: 'active', stubbed: true };
  }

  async updateWihItem(id: string, updates: any): Promise<boolean> {
    console.log(`[STUB] Updating WIH item: ${id}`, updates);
    return true;
  }

  async listWihItems(filter?: any): Promise<any[]> {
    console.log('[STUB] Listing WIH items with filter:', filter);
    return [{ id: 'mock-item-1', title: 'Mock WIH Item', status: 'active' }];
  }
}
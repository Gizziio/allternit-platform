// 3-adapters/stubs/runtime.stub.ts
import type { RuntimeBridge, ToolExecutionRequest, ToolExecutionResult, Session, SessionContext, AuditLogEntry, AuditLogFilter } from '../contracts/runtime';

export class StubRuntimeBridge implements RuntimeBridge {
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    console.log(`[STUB] Executing tool: ${request.toolId}`, request.parameters);
    
    return {
      executionId: request.id,
      toolId: request.toolId,
      input: request.parameters,
      output: { result: '[MOCK] Tool executed successfully' },
      stdout: '[MOCK] Tool output',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 100,
      resourcesUsed: {
        cpuTimeMs: 50,
        memoryPeakKb: 1024,
        networkBytes: 0,
        filesystemOps: 0
      },
      timestamp: Date.now()
    };
  }

  async executeFileOperation(request: FileOperationRequest): Promise<FileOperationResult> {
    console.log(`[STUB] File operation: ${request.operation} ${request.path}`);
    
    return {
      success: true,
      content: request.content || '[MOCK] File operation successful',
      stats: { size: 1024, modified: new Date() }
    };
  }

  async createSession(context: SessionContext): Promise<Session> {
    console.log('[STUB] Creating session with context:', context);
    
    return {
      id: 'session-' + Date.now().toString(),
      userId: context.userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
      context: context
    };
  }

  async getSession(sessionId: string): Promise<Session | null> {
    console.log(`[STUB] Getting session: ${sessionId}`);
    
    return {
      id: sessionId,
      userId: 'stub-user',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
      context: {}
    };
  }

  async listSessions(): Promise<Session[]> {
    console.log('[STUB] Listing sessions');
    return [
      {
        id: 'session-1',
        userId: 'user-1',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        status: 'active',
        context: {}
      }
    ];
  }

  async auditLog(entry: AuditLogEntry): Promise<void> {
    console.log('[STUB] Auditing:', entry.operation, 'by', entry.actor);
  }

  async getAuditLogs(filter?: AuditLogFilter): Promise<AuditLogEntry[]> {
    console.log('[STUB] Getting audit logs with filter:', filter);
    return [
      {
        id: 'audit-1',
        timestamp: new Date(),
        operation: 'stub-operation',
        actor: 'stub-actor',
        target: 'stub-target',
        inputs: {},
        outputs: {},
        decision: 'approved',
        policyApplied: ['stub-policy'],
        session: 'session-1'
      }
    ];
  }
}

// 3-adapters/stubs/gateway.stub.ts
export class StubGatewayAdapter {
  async connectToGateway(options: any): Promise<any> {
    console.log('[STUB] Connecting to gateway with options:', options);
    return { connected: true, gatewayId: 'stub-gateway' };
  }

  async sendRequest(request: any): Promise<any> {
    console.log('[STUB] Sending request to gateway:', request);
    return { success: true, response: '[MOCK] Gateway response' };
  }

  async subscribeToEvents(callback: (event: any) => void): Promise<() => void> {
    console.log('[STUB] Subscribing to gateway events');
    // Mock event subscription
    return () => console.log('[STUB] Unsubscribed from events');
  }
}
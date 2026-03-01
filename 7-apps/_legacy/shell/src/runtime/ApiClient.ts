import {
  AssistantIdentity,
  Suggestion,
  AgentSpec,
  Skill,
  SkillPackage,
  PublisherKey,
  PublisherKeyRegistrationRequest,
  PublisherKeyRevokeRequest,
  ToolGatewayDefinition,
  ToolExecutePayload,
  ToolExecutionResult,
  KernelJournalEvent,
  WorkflowDefinition,
  WorkflowExecution,
  ArtifactQueryResponse,
  TemplateIndex,
} from '../../../shared/contracts';

// Import the gateway client to ensure all requests go through the gateway
import gatewayClient from '../services/gateway-client';

export class ApiClient {
  async getAssistant(): Promise<AssistantIdentity> {
    return gatewayClient.makeRequest('get-assistant', { method: 'GET' });
  }

  async updateAssistant(identity: AssistantIdentity): Promise<AssistantIdentity> {
    return gatewayClient.makeRequest('update-assistant', {
      method: 'PUT',
      body: identity
    });
  }

  async getSuggestions(): Promise<Suggestion[]> {
    return gatewayClient.makeRequest('get-suggestions', { method: 'GET' });
  }

  async listAgentTemplates(): Promise<AgentSpec[]> {
    return gatewayClient.makeRequest('list-agent-templates', { method: 'GET' });
  }

  async createAgentTemplate(spec: AgentSpec): Promise<AgentSpec> {
    return gatewayClient.makeRequest('create-agent-template', {
      method: 'POST',
      body: spec
    });
  }

  async listTools(): Promise<any[]> {
    return gatewayClient.makeRequest('list-tools', { method: 'GET' });
  }

  async createTool(tool: ToolGatewayDefinition): Promise<ToolGatewayDefinition> {
    return gatewayClient.makeRequest('create-tool', {
      method: 'POST',
      body: tool
    });
  }

  async executeTool(toolId: string, payload: ToolExecutePayload): Promise<ToolExecutionResult> {
    return gatewayClient.makeRequest('execute-tool', {
      method: 'POST',
      pathParams: { tool_id: toolId },
      body: payload
    });
  }

  async listSkillsRegistry(): Promise<Skill[]> {
    return gatewayClient.makeRequest('list-skills-registry', { method: 'GET' });
  }

  async createSkill(skill: Skill): Promise<{ id: string }> {
    return gatewayClient.makeRequest('create-skill', {
      method: 'POST',
      body: skill
    });
  }

  async listPublisherKeys(publisherId?: string): Promise<PublisherKey[]> {
    const queryParams: Record<string, string | number> = {};
    if (publisherId) {
      queryParams.publisher_id = publisherId;
    }
    return gatewayClient.makeRequest('list-publisher-keys', {
      method: 'GET',
      queryParams
    });
  }

  async registerPublisherKey(payload: PublisherKeyRegistrationRequest): Promise<PublisherKey> {
    return gatewayClient.makeRequest('register-publisher-key', {
      method: 'POST',
      body: payload
    });
  }

  async revokePublisherKey(
    publisherId: string,
    payload: PublisherKeyRevokeRequest
  ): Promise<PublisherKey> {
    return gatewayClient.makeRequest('revoke-publisher-key', {
      method: 'POST',
      pathParams: { publisher_id: publisherId },
      body: payload
    });
  }

  async listSkills(): Promise<SkillPackage[]> {
    return gatewayClient.makeRequest('list-marketplace-skills', { method: 'GET' });
  }

  async installSkill(id: string): Promise<{ id: string; status: string }> {
    return gatewayClient.makeRequest('install-skill', {
      method: 'POST',
      pathParams: { skill_id: id }
    });
  }

  async listWorkflows(): Promise<WorkflowDefinition[]> {
    return gatewayClient.makeRequest('list-workflows', { method: 'GET' });
  }

  async createWorkflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    return gatewayClient.makeRequest('create-workflow', {
      method: 'POST',
      body: workflow
    });
  }

  async executeWorkflow(
    workflowId: string,
    payload: { session_id?: string; tenant_id?: string; input?: Record<string, unknown> }
  ): Promise<WorkflowExecution> {
    return gatewayClient.makeRequest('execute-workflow', {
      method: 'POST',
      pathParams: { workflow_id: workflowId },
      body: payload
    });
  }

  async listArtifacts(limit?: number, offset?: number): Promise<ArtifactQueryResponse> {
    const queryParams: Record<string, string | number> = {};
    if (limit !== undefined) queryParams.limit = limit;
    if (offset !== undefined) queryParams.offset = offset;
    return gatewayClient.makeRequest('list-artifacts', {
      method: 'GET',
      queryParams
    });
  }

  async listTemplatesIndex(): Promise<TemplateIndex> {
    return gatewayClient.makeRequest('list-templates-index', { method: 'GET' });
  }

  async listJournalEvents(kind?: string, after?: number): Promise<KernelJournalEvent[]> {
    const queryParams: Record<string, string | number> = {};
    if (kind) queryParams.kind = kind;
    if (after !== undefined) queryParams.after = after;
    return gatewayClient.makeRequest('list-journal-events', {
      method: 'GET',
      queryParams
    });
  }

  async recompileCapsule(capsuleId: string, capsuleType: string): Promise<any> {
    return gatewayClient.makeRequest('recompile-capsule', {
      method: 'POST',
      pathParams: { capsule_id: capsuleId },
      body: { capsule_type: capsuleType }
    });
  }

  // Brain chat - sends message to active brain session and returns response stream
  async chat(message: string, _sessionId?: string): Promise<string> {
    // Note: Actual brain chat is handled via BrainContext events
    // This is a fallback that routes through kernel's intent dispatch
    try {
      const result = await gatewayClient.makeRequest('dispatch-intent', {
        method: 'POST',
        body: {
          intent_text: message,
          execution_mode: 'auto'
        }
      });

      return result.capsule?.title || result.response || `Processed: ${message}`;
    } catch (err) {
      console.error('Chat API error:', err);
      return `I received: "${message}". Enable a brain runtime for full AI responses.`;
    }
  }

  // Get frameworks from kernel
  async getFrameworks(): Promise<any[]> {
    return gatewayClient.makeRequest('get-frameworks', { method: 'GET' });
  }

  // Get journal stream from kernel
  async getJournalStream(): Promise<KernelJournalEvent[]> {
    return gatewayClient.makeRequest('get-journal-stream', { method: 'GET' });
  }

  // Send input to brain session
  async sendBrainInput(sessionId: string, input: string): Promise<void> {
    await gatewayClient.makeRequest('send-brain-input', {
      method: 'POST',
      pathParams: { session_id: sessionId },
      body: { input }
    });
  }

  // Dispatch intent to kernel
  async dispatchIntent(intentText: string): Promise<any> {
    return gatewayClient.makeRequest('dispatch-intent', {
      method: 'POST',
      body: { intent_text: intentText }
    });
  }

  // Dispatch action to kernel
  async dispatchAction(payload: {
    action_id: string;
    capsule_id: string;
    view_id: string;
    context: any;
  }): Promise<any> {
    return gatewayClient.makeRequest('dispatch-action', {
      method: 'POST',
      body: payload
    });
  }
}

export const api = new ApiClient();

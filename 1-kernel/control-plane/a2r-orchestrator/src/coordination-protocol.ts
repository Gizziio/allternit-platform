/**
 * Multi-Agent Coordination Protocol
 * 
 * Implements agent-to-agent communication and coordination mechanisms
 * for distributed task execution.
 */

export interface AgentMessage {
  id: string;
  senderId: string;
  recipientId?: string; // If undefined, message is broadcast
  type: 'request' | 'response' | 'notification' | 'coordination';
  content: string;
  timestamp: number;
  correlationId?: string; // For linking related messages
  metadata?: Record<string, any>;
}

export interface CoordinationRequest {
  taskId: string;
  requestingAgentId: string;
  targetAgentId?: string; // If undefined, request is broadcast
  action: string;
  parameters: any;
  priority: number;
}

export interface CoordinationResponse {
  requestId: string;
  respondingAgentId: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface SharedState {
  id: string;
  key: string;
  value: any;
  version: number;
  lastModified: number;
  ownerAgentId: string;
}

export interface AgentRegistration {
  id: string;
  role: string;
  capabilities: string[];
  status: 'online' | 'busy' | 'offline';
  lastSeen: number;
}

export class AgentCoordinationProtocol {
  private messageQueue: AgentMessage[] = [];
  private agentRegistrations: Map<string, AgentRegistration> = new Map();
  private sharedState: Map<string, SharedState> = new Map();
  private pendingRequests: Map<string, CoordinationRequest> = new Map();

  /**
   * Register an agent with the coordination system
   */
  registerAgent(agentId: string, role: string, capabilities: string[]): void {
    this.agentRegistrations.set(agentId, {
      id: agentId,
      role,
      capabilities,
      status: 'online',
      lastSeen: Date.now()
    });
  }

  /**
   * Unregister an agent from the coordination system
   */
  unregisterAgent(agentId: string): void {
    const agent = this.agentRegistrations.get(agentId);
    if (agent) {
      agent.status = 'offline';
      this.agentRegistrations.set(agentId, agent);
    }
  }

  /**
   * Send a message to another agent
   */
  sendMessage(senderId: string, recipientId: string, content: string, type: 'request' | 'response' | 'notification' | 'coordination' = 'request'): string {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId,
      recipientId,
      type,
      content,
      timestamp: Date.now(),
      metadata: {
        senderCapabilities: this.agentRegistrations.get(senderId)?.capabilities || []
      }
    };

    this.messageQueue.push(message);
    return message.id;
  }

  /**
   * Broadcast a message to all agents
   */
  broadcastMessage(senderId: string, content: string, type: 'request' | 'response' | 'notification' | 'coordination' = 'notification'): string {
    const message: AgentMessage = {
      id: `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId,
      type,
      content,
      timestamp: Date.now(),
      metadata: {
        senderCapabilities: this.agentRegistrations.get(senderId)?.capabilities || []
      }
    };

    this.messageQueue.push(message);
    return message.id;
  }

  /**
   * Get messages for a specific agent
   */
  getMessagesForAgent(agentId: string): AgentMessage[] {
    return this.messageQueue.filter(msg => 
      msg.recipientId === agentId || !msg.recipientId
    );
  }

  /**
   * Clear processed messages
   */
  clearProcessedMessages(messageIds: string[]): void {
    this.messageQueue = this.messageQueue.filter(msg => !messageIds.includes(msg.id));
  }

  /**
   * Submit a coordination request
   */
  submitRequest(request: CoordinationRequest): string {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.pendingRequests.set(requestId, {
      ...request,
      taskId: requestId
    });
    return requestId;
  }

  /**
   * Respond to a coordination request
   */
  respondToRequest(requestId: string, result: any, success: boolean = true): CoordinationResponse {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    const response: CoordinationResponse = {
      requestId,
      respondingAgentId: request.targetAgentId || 'system',
      success,
      result
    };

    // Remove the request after responding
    this.pendingRequests.delete(requestId);

    return response;
  }

  /**
   * Get pending requests for an agent
   */
  getPendingRequestsForAgent(agentId: string): CoordinationRequest[] {
    return Array.from(this.pendingRequests.values()).filter(req => 
      req.targetAgentId === agentId || !req.targetAgentId
    );
  }

  /**
   * Update shared state
   */
  updateSharedState(key: string, value: any, agentId: string): SharedState {
    const stateId = `state-${key}-${Date.now()}`;
    const state: SharedState = {
      id: stateId,
      key,
      value,
      version: 1, // In a real implementation, this would handle version conflicts
      lastModified: Date.now(),
      ownerAgentId: agentId
    };

    this.sharedState.set(key, state);
    return state;
  }

  /**
   * Get shared state
   */
  getSharedState(key: string): SharedState | undefined {
    return this.sharedState.get(key);
  }

  /**
   * Get all agents with specific capabilities
   */
  getAgentsWithCapabilities(capabilities: string[]): AgentRegistration[] {
    return Array.from(this.agentRegistrations.values()).filter(agent => 
      capabilities.every(cap => agent.capabilities.includes(cap))
    );
  }

  /**
   * Get all online agents
   */
  getOnlineAgents(): AgentRegistration[] {
    return Array.from(this.agentRegistrations.values()).filter(agent => 
      agent.status === 'online'
    );
  }

  /**
   * Resolve conflicts between agents
   */
  resolveConflict(conflictingAgents: string[], task: string): string {
    // Simple round-robin conflict resolution
    // In a real implementation, this would use more sophisticated algorithms
    return conflictingAgents[0]; // Assign to first agent for now
  }

  /**
   * Get coordination statistics
   */
  getStats(): {
    totalMessages: number;
    totalAgents: number;
    totalSharedStates: number;
    totalPendingRequests: number;
  } {
    return {
      totalMessages: this.messageQueue.length,
      totalAgents: this.agentRegistrations.size,
      totalSharedStates: this.sharedState.size,
      totalPendingRequests: this.pendingRequests.size
    };
  }
}

// Global coordination protocol instance
const globalCoordinationProtocol = new AgentCoordinationProtocol();

export { globalCoordinationProtocol };
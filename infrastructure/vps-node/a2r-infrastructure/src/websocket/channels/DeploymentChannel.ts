/**
 * DeploymentChannel.ts
 * 
 * WebSocket channel handler for deployment progress events.
 * Streams deployment status, progress updates, errors, and completion events.
 */

import { WebSocket } from 'ws';
import { EventServer } from '../EventServer';
import type { 
  DeploymentEvent, 
  DeploymentProgressEvent, 
  DeploymentErrorEvent,
  DeploymentCompleteEvent,
  InstanceInfo,
} from '../EventTypes';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DeploymentStage {
  name: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DeploymentState {
  deploymentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStage: string;
  stages: DeploymentStage[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  instanceInfo?: InstanceInfo;
  startedAt: string;
  completedAt?: string;
}

export interface DeploymentLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stage?: string;
}

// ============================================================================
// Deployment Channel Class
// ============================================================================

export class DeploymentChannel {
  private readonly eventServer: EventServer;
  private readonly channelPrefix = 'deployment:';
  private deploymentStates = new Map<string, DeploymentState>();
  private deploymentLogs = new Map<string, DeploymentLogEntry[]>();
  private activeStreams = new Map<string, Set<WebSocket>>();

  constructor(eventServer: EventServer) {
    this.eventServer = eventServer;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Stream deployment events to a WebSocket connection.
   * Sends current state and subscribes to future updates.
   */
  async streamDeploymentEvents(deploymentId: string, socket: WebSocket): Promise<void> {
    this.getChannelName(deploymentId); // Ensure channel exists

    // Track this socket as an active stream
    if (!this.activeStreams.has(deploymentId)) {
      this.activeStreams.set(deploymentId, new Set());
    }
    this.activeStreams.get(deploymentId)!.add(socket);

    // Send current state if available
    const state = this.deploymentStates.get(deploymentId);
    if (state) {
      this.sendToSocket(socket, this.createStateEvent(deploymentId, state));
    }

    // Send recent logs
    const logs = this.deploymentLogs.get(deploymentId) || [];
    if (logs.length > 0) {
      this.sendToSocket(socket, this.createLogEvent(deploymentId, logs));
    }

    // Set up cleanup on socket close
    socket.on('close', () => {
      this.removeStream(deploymentId, socket);
    });

    socket.on('error', () => {
      this.removeStream(deploymentId, socket);
    });
  }

  /**
   * Initialize a new deployment tracking session
   */
  async initializeDeployment(
    deploymentId: string, 
    stages: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const state: DeploymentState = {
      deploymentId,
      status: 'pending',
      progress: 0,
      currentStage: stages[0] || 'initializing',
      stages: stages.map((name, index) => ({
        name,
        progress: 0,
        status: index === 0 ? 'running' : 'pending',
        message: index === 0 ? 'Starting deployment...' : 'Waiting...',
      })),
      startedAt: new Date().toISOString(),
    };

    this.deploymentStates.set(deploymentId, state);
    this.deploymentLogs.set(deploymentId, []);

    // Log initialization
    await this.log(deploymentId, 'info', 'Deployment initialized', 'initializing');

    // Emit started event
    const event: DeploymentEvent = {
      type: 'deployment',
      deploymentId,
      eventType: 'started',
      message: 'Deployment started',
      timestamp: new Date().toISOString(),
      data: metadata,
    };

    await this.publish(deploymentId, event);
  }

  /**
   * Emit a progress update for a deployment
   */
  async emitProgress(deploymentId: string, progress: number, message: string): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Update state
    state.progress = Math.min(100, Math.max(0, progress));
    
    // Update current stage progress
    const currentStage = state.stages.find(s => s.name === state.currentStage);
    if (currentStage) {
      currentStage.progress = state.progress;
      currentStage.message = message;
    }

    // Create and publish event
    const event: DeploymentProgressEvent = {
      type: 'deployment',
      deploymentId,
      eventType: 'progress',
      progress: state.progress,
      message,
      stage: state.currentStage,
      timestamp: new Date().toISOString(),
      data: { 
        stage: state.currentStage,
        stages: state.stages,
      },
    };

    await this.publish(deploymentId, event);
    await this.log(deploymentId, 'info', message, state.currentStage);
  }

  /**
   * Advance to the next deployment stage
   */
  async nextStage(deploymentId: string, stageName: string, message?: string): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Mark current stage as completed
    const currentStage = state.stages.find(s => s.name === state.currentStage);
    if (currentStage) {
      currentStage.status = 'completed';
      currentStage.progress = 100;
      currentStage.completedAt = new Date().toISOString();
    }

    // Set new stage
    state.currentStage = stageName;
    const newStage = state.stages.find(s => s.name === stageName);
    if (newStage) {
      newStage.status = 'running';
      newStage.startedAt = new Date().toISOString();
    }

    const eventMessage = message || `Starting stage: ${stageName}`;
    await this.emitProgress(deploymentId, state.progress, eventMessage);
  }

  /**
   * Emit an error event for a deployment
   */
  async emitError(deploymentId: string, error: string, errorCode = 'DEPLOYMENT_ERROR'): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Update state
    state.status = 'failed';
    state.error = {
      code: errorCode,
      message: error,
    };

    // Mark current stage as failed
    const currentStage = state.stages.find(s => s.name === state.currentStage);
    if (currentStage) {
      currentStage.status = 'failed';
      currentStage.message = error;
    }

    // Create and publish event
    const event: DeploymentErrorEvent = {
      type: 'deployment',
      deploymentId,
      eventType: 'error',
      message: error,
      timestamp: new Date().toISOString(),
      error: {
        code: errorCode,
        message: error,
      },
    };

    await this.publish(deploymentId, event);
    await this.log(deploymentId, 'error', error, state.currentStage);
  }

  /**
   * Emit a completion event for a deployment
   */
  async emitComplete(deploymentId: string, instanceInfo: InstanceInfo): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Update state
    state.status = 'completed';
    state.progress = 100;
    state.instanceInfo = instanceInfo;
    state.completedAt = new Date().toISOString();

    // Mark all stages as completed
    for (const stage of state.stages) {
      stage.status = 'completed';
      stage.progress = 100;
      if (!stage.completedAt) {
        stage.completedAt = new Date().toISOString();
      }
    }

    // Create and publish event
    const event: DeploymentCompleteEvent = {
      type: 'deployment',
      deploymentId,
      eventType: 'complete',
      message: 'Deployment completed successfully',
      timestamp: new Date().toISOString(),
      instanceInfo,
      data: {
        stages: state.stages,
        duration: this.calculateDuration(state),
      },
    };

    await this.publish(deploymentId, event);
    await this.log(deploymentId, 'info', 'Deployment completed successfully');

    // Clean up after a delay (keep state for 1 hour)
    setTimeout(() => {
      this.cleanupDeployment(deploymentId);
    }, 60 * 60 * 1000);
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(deploymentId: string, reason = 'Cancelled by user'): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (state.status === 'completed' || state.status === 'failed') {
      throw new Error(`Cannot cancel deployment in ${state.status} state`);
    }

    state.status = 'cancelled';
    state.completedAt = new Date().toISOString();

    const event: DeploymentEvent = {
      type: 'deployment',
      deploymentId,
      eventType: 'cancelled',
      message: reason,
      timestamp: new Date().toISOString(),
    };

    await this.publish(deploymentId, event);
    await this.log(deploymentId, 'warn', `Deployment cancelled: ${reason}`);
  }

  /**
   * Get current deployment state
   */
  getDeploymentState(deploymentId: string): DeploymentState | undefined {
    return this.deploymentStates.get(deploymentId);
  }

  /**
   * Get deployment logs
   */
  getDeploymentLogs(deploymentId: string): DeploymentLogEntry[] {
    return this.deploymentLogs.get(deploymentId) || [];
  }

  /**
   * Get all active deployments
   */
  getActiveDeployments(): DeploymentState[] {
    return Array.from(this.deploymentStates.values()).filter(
      d => d.status === 'pending' || d.status === 'running'
    );
  }

  /**
   * Check if a deployment exists
   */
  hasDeployment(deploymentId: string): boolean {
    return this.deploymentStates.has(deploymentId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Publish an event to the deployment channel
   */
  private async publish(deploymentId: string, event: DeploymentEvent): Promise<void> {
    const channelName = this.getChannelName(deploymentId);
    await this.eventServer.publish(channelName, event);

    // Also publish to the general deployment channel
    await this.eventServer.publish('deployment', event);
  }

  /**
   * Send an event to a specific socket
   */
  private sendToSocket(socket: WebSocket, event: DeploymentEvent): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event));
      } catch (error) {
        // Socket error will be handled by close/error handlers
      }
    }
  }

  /**
   * Remove a stream from tracking
   */
  private removeStream(deploymentId: string, socket: WebSocket): void {
    const streams = this.activeStreams.get(deploymentId);
    if (streams) {
      streams.delete(socket);
      if (streams.size === 0) {
        this.activeStreams.delete(deploymentId);
      }
    }
  }

  /**
   * Add a log entry
   */
  private async log(
    deploymentId: string, 
    level: DeploymentLogEntry['level'], 
    message: string,
    stage?: string
  ): Promise<void> {
    const logs = this.deploymentLogs.get(deploymentId);
    if (!logs) return;

    const entry: DeploymentLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stage,
    };

    logs.push(entry);

    // Keep only last 1000 log entries
    if (logs.length > 1000) {
      logs.shift();
    }
  }

  /**
   * Create a state event
   */
  private createStateEvent(deploymentId: string, state: DeploymentState): DeploymentEvent {
    return {
      type: 'deployment',
      deploymentId,
      eventType: state.status === 'failed' ? 'error' : 'progress',
      message: state.error?.message || `Deployment ${state.status}`,
      timestamp: new Date().toISOString(),
      progress: state.progress,
      data: { ...state },
    };
  }

  /**
   * Create a log event
   */
  private createLogEvent(deploymentId: string, logs: DeploymentLogEntry[]): DeploymentEvent {
    return {
      type: 'deployment',
      deploymentId,
      eventType: 'progress',
      message: 'Deployment logs',
      timestamp: new Date().toISOString(),
      data: { logs },
    };
  }

  /**
   * Calculate deployment duration in milliseconds
   */
  private calculateDuration(state: DeploymentState): number {
    const start = new Date(state.startedAt).getTime();
    const end = state.completedAt ? new Date(state.completedAt).getTime() : Date.now();
    return end - start;
  }

  /**
   * Clean up deployment data
   */
  private cleanupDeployment(deploymentId: string): void {
    this.deploymentStates.delete(deploymentId);
    this.deploymentLogs.delete(deploymentId);
    this.activeStreams.delete(deploymentId);
  }

  /**
   * Get the channel name for a deployment
   */
  private getChannelName(deploymentId: string): string {
    return `${this.channelPrefix}${deploymentId}`;
  }
}

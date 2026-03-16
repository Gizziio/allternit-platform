/**
 * EnvironmentChannel.ts
 * 
 * WebSocket channel handler for environment provisioning events.
 * Streams environment logs, build progress, and status updates.
 */

import { WebSocket } from 'ws';
import { EventServer } from '../EventServer';
import type { EnvironmentEvent, EnvironmentBuildProgressEvent } from '../EventTypes';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type EnvironmentStatus = 'creating' | 'building' | 'running' | 'stopping' | 'stopped' | 'destroyed' | 'error';

export interface BuildStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface EnvironmentState {
  envId: string;
  status: EnvironmentStatus;
  progress: number;
  currentStep: string;
  buildSteps: BuildStep[];
  dockerImage?: string;
  containerId?: string;
  error?: {
    code: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  destroyedAt?: string;
}

export interface EnvironmentLogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

// ============================================================================
// Environment Channel Class
// ============================================================================

export class EnvironmentChannel {
  private readonly eventServer: EventServer;
  private readonly channelPrefix = 'environment:';
  private environmentStates = new Map<string, EnvironmentState>();
  private environmentLogs = new Map<string, EnvironmentLogEntry[]>();
  private activeStreams = new Map<string, Set<WebSocket>>();

  constructor(eventServer: EventServer) {
    this.eventServer = eventServer;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Stream environment logs to a WebSocket connection.
   * Sends current state and subscribes to future updates.
   */
  async streamEnvironmentLogs(envId: string, socket: WebSocket): Promise<void> {
    this.getChannelName(envId); // Ensure channel exists

    // Track this socket as an active stream
    if (!this.activeStreams.has(envId)) {
      this.activeStreams.set(envId, new Set());
    }
    this.activeStreams.get(envId)!.add(socket);

    // Send current state if available
    const state = this.environmentStates.get(envId);
    if (state) {
      this.sendToSocket(socket, this.createStateEvent(envId, state));
    }

    // Send recent logs (last 100)
    const logs = this.environmentLogs.get(envId) || [];
    const recentLogs = logs.slice(-100);
    if (recentLogs.length > 0) {
      this.sendToSocket(socket, this.createLogEvent(envId, recentLogs));
    }

    // Set up cleanup on socket close
    socket.on('close', () => {
      this.removeStream(envId, socket);
    });

    socket.on('error', () => {
      this.removeStream(envId, socket);
    });
  }

  /**
   * Initialize a new environment
   */
  async initializeEnvironment(
    envId: string, 
    buildSteps: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date().toISOString();
    const state: EnvironmentState = {
      envId,
      status: 'creating',
      progress: 0,
      currentStep: 'initializing',
      buildSteps: buildSteps.map((name, index) => ({
        name,
        status: index === 0 ? 'running' : 'pending',
        progress: 0,
        logs: [],
        startedAt: index === 0 ? now : undefined,
      })),
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.environmentStates.set(envId, state);
    this.environmentLogs.set(envId, []);

    // Log initialization
    await this.addLog(envId, 'system', 'Environment initialization started');

    // Emit created event
    const event: EnvironmentEvent = {
      type: 'environment',
      envId,
      eventType: 'created',
      timestamp: new Date().toISOString(),
      logs: ['Environment created'],
    };

    await this.publish(envId, event);
  }

  /**
   * Emit build progress update
   */
  async emitBuildProgress(envId: string, step: string, progress: number): Promise<void> {
    const state = this.environmentStates.get(envId);
    if (!state) {
      throw new Error(`Environment ${envId} not found`);
    }

    // Update state
    state.status = 'building';
    state.progress = Math.min(100, Math.max(0, progress));
    state.currentStep = step;
    state.updatedAt = new Date().toISOString();

    // Update build step
    const buildStep = state.buildSteps.find(s => s.name === step);
    if (buildStep) {
      buildStep.status = 'running';
      buildStep.progress = progress;
      
      if (!buildStep.startedAt) {
        buildStep.startedAt = new Date().toISOString();
      }

      // Mark previous steps as completed
      for (const s of state.buildSteps) {
        if (s.name !== step && s.status === 'running') {
          s.status = 'completed';
          s.progress = 100;
          s.completedAt = new Date().toISOString();
        }
      }
    }

    // Create and publish event
    const event: EnvironmentBuildProgressEvent = {
      type: 'environment',
      envId,
      eventType: 'building',
      buildStep: step,
      progress: state.progress,
      timestamp: new Date().toISOString(),
      logs: [`Build progress: ${step} (${progress}%)`],
    };

    await this.publish(envId, event);
    await this.addLog(envId, 'system', `Building: ${step} (${progress}%)`);
  }

  /**
   * Emit a build log entry
   */
  async emitBuildLog(envId: string, message: string, stream: 'stdout' | 'stderr' = 'stdout'): Promise<void> {
    await this.addLog(envId, stream, message);

    // Get recent logs for the event
    const logs = this.environmentLogs.get(envId) || [];
    const recentLogs = logs.slice(-50).map(l => l.message);

    const event: EnvironmentEvent = {
      type: 'environment',
      envId,
      eventType: 'building',
      timestamp: new Date().toISOString(),
      logs: recentLogs,
    };

    await this.publish(envId, event);
  }

  /**
   * Mark build step as completed
   */
  async completeBuildStep(envId: string, stepName: string, message?: string): Promise<void> {
    const state = this.environmentStates.get(envId);
    if (!state) {
      throw new Error(`Environment ${envId} not found`);
    }

    const buildStep = state.buildSteps.find(s => s.name === stepName);
    if (buildStep) {
      buildStep.status = 'completed';
      buildStep.progress = 100;
      buildStep.completedAt = new Date().toISOString();
    }

    const eventMessage = message || `Build step completed: ${stepName}`;
    await this.addLog(envId, 'system', eventMessage);

    // Check if all steps are completed
    const allCompleted = state.buildSteps.every(s => s.status === 'completed');
    if (allCompleted) {
      await this.markAsRunning(envId);
    }
  }

  /**
   * Mark build step as failed
   */
  async failBuildStep(envId: string, stepName: string, error: string): Promise<void> {
    const state = this.environmentStates.get(envId);
    if (!state) {
      throw new Error(`Environment ${envId} not found`);
    }

    const buildStep = state.buildSteps.find(s => s.name === stepName);
    if (buildStep) {
      buildStep.status = 'failed';
      buildStep.logs.push(error);
    }

    state.status = 'error';
    state.error = {
      code: 'BUILD_FAILED',
      message: error,
    };
    state.updatedAt = new Date().toISOString();

    await this.addLog(envId, 'stderr', `Build step failed: ${stepName} - ${error}`);

    const event: EnvironmentEvent = {
      type: 'environment',
      envId,
      eventType: 'error',
      timestamp: new Date().toISOString(),
      logs: [error],
      error: state.error,
    };

    await this.publish(envId, event);
  }

  /**
   * Mark environment as running
   */
  async markAsRunning(envId: string, containerInfo?: { dockerImage: string; containerId: string }): Promise<void> {
    const state = this.environmentStates.get(envId);
    if (!state) {
      throw new Error(`Environment ${envId} not found`);
    }

    state.status = 'running';
    state.progress = 100;
    state.currentStep = 'running';
    state.updatedAt = new Date().toISOString();

    if (containerInfo) {
      state.dockerImage = containerInfo.dockerImage;
      state.containerId = containerInfo.containerId;
    }

    await this.addLog(envId, 'system', 'Environment is now running');

    const event: EnvironmentEvent = {
      type: 'environment',
      envId,
      eventType: 'running',
      timestamp: new Date().toISOString(),
      logs: ['Environment started successfully'],
    };

    await this.publish(envId, event);
  }

  /**
   * Mark environment as stopped
   */
  async markAsStopped(envId: string, reason = 'Stopped by user'): Promise<void> {
    const state = this.environmentStates.get(envId);
    if (!state) {
      throw new Error(`Environment ${envId} not found`);
    }

    state.status = 'stopped';
    state.updatedAt = new Date().toISOString();

    await this.addLog(envId, 'system', `Environment stopped: ${reason}`);

    const event: EnvironmentEvent = {
      type: 'environment',
      envId,
      eventType: 'running',
      timestamp: new Date().toISOString(),
      logs: [`Environment stopped: ${reason}`],
    };

    await this.publish(envId, event);
  }

  /**
   * Mark environment as destroyed
   */
  async markAsDestroyed(envId: string): Promise<void> {
    const state = this.environmentStates.get(envId);
    if (!state) {
      throw new Error(`Environment ${envId} not found`);
    }

    state.status = 'destroyed';
    state.destroyedAt = new Date().toISOString();
    state.updatedAt = state.destroyedAt;

    await this.addLog(envId, 'system', 'Environment destroyed');

    const event: EnvironmentEvent = {
      type: 'environment',
      envId,
      eventType: 'destroyed',
      timestamp: new Date().toISOString(),
      logs: ['Environment destroyed'],
    };

    await this.publish(envId, event);

    // Clean up after a delay
    setTimeout(() => {
      this.cleanupEnvironment(envId);
    }, 30 * 60 * 1000); // Keep for 30 minutes
  }

  /**
   * Stream Docker container logs
   */
  async streamContainerLog(envId: string, logLine: string, isError = false): Promise<void> {
    const stream = isError ? 'stderr' : 'stdout';
    await this.addLog(envId, stream, logLine);

    // Publish in batches to avoid flooding
    const logs = this.environmentLogs.get(envId);
    if (logs && logs.length % 10 === 0) {
      const recentLogs = logs.slice(-10).map(l => l.message);
      
      const event: EnvironmentEvent = {
        type: 'environment',
        envId,
        eventType: 'running',
        timestamp: new Date().toISOString(),
        logs: recentLogs,
      };

      await this.publish(envId, event);
    }
  }

  /**
   * Get environment state
   */
  getEnvironmentState(envId: string): EnvironmentState | undefined {
    return this.environmentStates.get(envId);
  }

  /**
   * Get environment logs
   */
  getEnvironmentLogs(envId: string, limit = 1000): EnvironmentLogEntry[] {
    const logs = this.environmentLogs.get(envId) || [];
    return logs.slice(-limit);
  }

  /**
   * Get all active environments
   */
  getActiveEnvironments(): EnvironmentState[] {
    return Array.from(this.environmentStates.values()).filter(
      e => e.status !== 'destroyed' && e.status !== 'error'
    );
  }

  /**
   * Check if environment exists
   */
  hasEnvironment(envId: string): boolean {
    return this.environmentStates.has(envId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Publish an event to the environment channel
   */
  private async publish(envId: string, event: EnvironmentEvent): Promise<void> {
    const channelName = this.getChannelName(envId);
    await this.eventServer.publish(channelName, event);

    // Also publish to the general environment channel
    await this.eventServer.publish('environment', event);
  }

  /**
   * Send an event to a specific socket
   */
  private sendToSocket(socket: WebSocket, event: EnvironmentEvent): void {
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
  private removeStream(envId: string, socket: WebSocket): void {
    const streams = this.activeStreams.get(envId);
    if (streams) {
      streams.delete(socket);
      if (streams.size === 0) {
        this.activeStreams.delete(envId);
      }
    }
  }

  /**
   * Add a log entry
   */
  private async addLog(
    envId: string, 
    stream: EnvironmentLogEntry['stream'], 
    message: string
  ): Promise<void> {
    const logs = this.environmentLogs.get(envId);
    if (!logs) return;

    const entry: EnvironmentLogEntry = {
      timestamp: new Date().toISOString(),
      stream,
      message,
    };

    logs.push(entry);

    // Keep only last 10000 log entries
    if (logs.length > 10000) {
      logs.shift();
    }

    // Also add to build step logs if applicable
    const state = this.environmentStates.get(envId);
    if (state && state.status === 'building') {
      const currentStep = state.buildSteps.find(s => s.name === state.currentStep);
      if (currentStep) {
        currentStep.logs.push(message);
      }
    }
  }

  /**
   * Create a state event
   */
  private createStateEvent(envId: string, state: EnvironmentState): EnvironmentEvent {
    return {
      type: 'environment',
      envId,
      eventType: state.status === 'error' ? 'error' : 
                 state.status === 'running' ? 'running' : 'building',
      timestamp: new Date().toISOString(),
      logs: state.buildSteps.flatMap(s => s.logs.slice(-5)),
      buildStep: state.currentStep,
      progress: state.progress,
      error: state.error,
    };
  }

  /**
   * Create a log event
   */
  private createLogEvent(envId: string, logs: EnvironmentLogEntry[]): EnvironmentEvent {
    return {
      type: 'environment',
      envId,
      eventType: 'building',
      timestamp: new Date().toISOString(),
      logs: logs.map(l => `[${l.stream}] ${l.message}`),
    };
  }

  /**
   * Clean up environment data
   */
  private cleanupEnvironment(envId: string): void {
    this.environmentStates.delete(envId);
    this.environmentLogs.delete(envId);
    this.activeStreams.delete(envId);
  }

  /**
   * Get the channel name for an environment
   */
  private getChannelName(envId: string): string {
    return `${this.channelPrefix}${envId}`;
  }
}

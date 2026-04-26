/**
 * EventTypes.ts
 * 
 * All WebSocket event type definitions for the Allternit Infrastructure real-time event system.
 * Defines interfaces for deployment, environment, VPS, and system events.
 */

// ============================================================================
// Base Event Types
// ============================================================================

export type EventType = 
  | 'deployment' 
  | 'environment' 
  | 'vps' 
  | 'system' 
  | 'heartbeat';

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  correlationId?: string;
}

// ============================================================================
// Deployment Events
// ============================================================================

export type DeploymentEventType = 'progress' | 'error' | 'complete' | 'started' | 'cancelled';

export interface DeploymentEvent extends BaseEvent {
  type: 'deployment';
  deploymentId: string;
  eventType: DeploymentEventType;
  progress?: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface DeploymentProgressEvent extends DeploymentEvent {
  eventType: 'progress';
  progress: number;
  stage?: string;
}

export interface DeploymentErrorEvent extends DeploymentEvent {
  eventType: 'error';
  error: {
    code: string;
    message: string;
    stack?: string;
    details?: Record<string, unknown>;
  };
}

export interface DeploymentCompleteEvent extends DeploymentEvent {
  eventType: 'complete';
  instanceInfo: InstanceInfo;
}

export interface InstanceInfo {
  id: string;
  host: string;
  port: number;
  status: 'running' | 'stopped' | 'error';
  provider: string;
  region: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Environment Events
// ============================================================================

export type EnvironmentEventType = 'building' | 'running' | 'error' | 'destroyed' | 'created';

export interface EnvironmentEvent extends BaseEvent {
  type: 'environment';
  envId: string;
  eventType: EnvironmentEventType;
  logs?: string[];
  buildStep?: string;
  progress?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface EnvironmentBuildProgressEvent extends EnvironmentEvent {
  eventType: 'building';
  buildStep: string;
  progress: number;
  logs: string[];
}

// ============================================================================
// VPS Events
// ============================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'reconnecting';

export interface VPSConnectionStatus {
  vpsId: string;
  status: ConnectionStatus;
  host?: string;
  port?: number;
  lastConnectedAt?: string;
  errorMessage?: string;
  retryCount?: number;
}

export interface VPSEvent extends BaseEvent {
  type: 'vps';
  vpsId: string;
  eventType: 'connection' | 'command' | 'error' | 'stats';
}

export interface VPSConnectionEvent extends VPSEvent {
  eventType: 'connection';
  connectionStatus: ConnectionStatus;
  message?: string;
}

export interface VPSCommandEvent extends VPSEvent {
  eventType: 'command';
  commandId: string;
  output: string;
  isError?: boolean;
  isComplete?: boolean;
  exitCode?: number;
}

export interface VPSStatsEvent extends VPSEvent {
  eventType: 'stats';
  stats: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    uptime: number;
    loadAverage?: number[];
  };
}

// ============================================================================
// System Events
// ============================================================================

export interface SystemEvent extends BaseEvent {
  type: 'system';
  eventType: 'auth' | 'error' | 'info' | 'warning';
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface AuthEvent extends SystemEvent {
  eventType: 'auth';
  success: boolean;
  clientId: string;
  userId?: string;
  errorMessage?: string;
}

// ============================================================================
// Heartbeat Events
// ============================================================================

export interface HeartbeatEvent extends BaseEvent {
  type: 'heartbeat';
  clientId: string;
  serverTime: string;
}

export interface HeartbeatAckEvent extends BaseEvent {
  type: 'heartbeat';
  eventType: 'ack';
  clientTime: string;
  serverTime: string;
  latency?: number;
}

// ============================================================================
// Channel Events
// ============================================================================

export interface ChannelSubscribeEvent {
  action: 'subscribe';
  channels: string[];
}

export interface ChannelUnsubscribeEvent {
  action: 'unsubscribe';
  channels: string[];
}

export interface ChannelSubscribedEvent {
  type: 'system';
  eventType: 'info';
  message: string;
  channels: string[];
  timestamp: string;
}

// ============================================================================
// Union Types
// ============================================================================

export type Event = 
  | DeploymentEvent 
  | EnvironmentEvent 
  | VPSEvent 
  | SystemEvent 
  | HeartbeatEvent;

export type ClientEvent = 
  | ChannelSubscribeEvent 
  | ChannelUnsubscribeEvent 
  | HeartbeatEvent;

// ============================================================================
// Channel Names
// ============================================================================

export const ChannelNames = {
  DEPLOYMENT: 'deployment',
  ENVIRONMENT: 'environment',
  VPS: 'vps',
  SYSTEM: 'system',
  BROADCAST: 'broadcast',
} as const;

export type ChannelName = typeof ChannelNames[keyof typeof ChannelNames];

/**
 * WebSocket Event System - Index
 * 
 * A complete real-time event system for A2R Infrastructure.
 * Provides WebSocket connectivity with horizontal scaling support via Redis.
 */

// ============================================================================
// Core Classes
// ============================================================================

export { EventServer, type EventServerOptions, type ClientInfo } from './EventServer';
export { RedisPubSub, type RedisPubSubOptions, type PubSubMessage } from './RedisPubSub';

// ============================================================================
// Channel Handlers
// ============================================================================

export { 
  DeploymentChannel, 
  type DeploymentState, 
  type DeploymentStage, 
  type DeploymentLogEntry,
} from './channels/DeploymentChannel';

export { 
  EnvironmentChannel, 
  type EnvironmentState, 
  type EnvironmentStatus,
  type BuildStep,
  type EnvironmentLogEntry,
} from './channels/EnvironmentChannel';

export { 
  VPSChannel, 
  type VPSConnectionInfo, 
  type VPSCommandSession,
  type VPSServerStats,
} from './channels/VPSChannel';

// ============================================================================
// Event Types
// ============================================================================

export {
  // Event type constants
  ChannelNames,
  
  // Base types
  type EventType,
  type BaseEvent,
  type Event,
  type ClientEvent,
  type ChannelName,
  
  // Deployment event types
  type DeploymentEventType,
  type DeploymentEvent,
  type DeploymentProgressEvent,
  type DeploymentErrorEvent,
  type DeploymentCompleteEvent,
  type InstanceInfo,
  
  // Environment event types
  type EnvironmentEventType,
  type EnvironmentEvent,
  type EnvironmentBuildProgressEvent,
  
  // VPS event types
  type VPSEvent,
  type VPSConnectionEvent,
  type VPSCommandEvent,
  type VPSStatsEvent,
  
  // System event types
  type SystemEvent,
  type AuthEvent,
  
  // Heartbeat types
  type HeartbeatEvent,
  type HeartbeatAckEvent,
  
  // Channel types
  type ChannelSubscribeEvent,
  type ChannelUnsubscribeEvent,
  type ChannelSubscribedEvent,
} from './EventTypes';

// ============================================================================
// Re-exports from external modules (for convenience)
// ============================================================================

export { WebSocket, WebSocketServer } from 'ws';

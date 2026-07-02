/**
 * ACP (Agent Capability Protocol) Module
 * 
 * Official ACP types and utilities for agent-client communication.
 * All types are re-exported from @agentclientprotocol/sdk.
 * 
 * @see https://agentclientprotocol.com/
 */

// Official ACP types from the SDK
export * from './types.js';

// Allternit ACP extensions
export {
  ACPRegistry,
  acpRegistry,
  type RegistryQuery,
} from './registry.js';

export {
  ACPHarnessBridge,
  type BridgeOptions,
  type BridgeStreamChunk,
} from './harness-bridge.js';

export {
  validateACPMessage,
  validateACPSession,
  validateACPRegistryEntry,
  assertValidACPMessage,
  assertValidACPSession,
} from './validator.js';

export type { ValidationResult } from './types.js';

// Re-export the official ACP SDK for advanced usage
export * as ACP from '@agentclientprotocol/sdk';

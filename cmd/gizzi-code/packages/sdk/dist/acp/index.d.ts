/**
 * ACP (Agent Capability Protocol) Module
 *
 * Official ACP types and utilities for agent-client communication.
 * All types are re-exported from @agentclientprotocol/sdk.
 *
 * @see https://agentclientprotocol.com/
 */
export * from './types.js';
export { ACPRegistry, acpRegistry, type RegistryQuery, } from './registry.js';
export { ACPHarnessBridge, type BridgeOptions, type BridgeStreamChunk, } from './harness-bridge.js';
export { validateACPMessage, validateACPSession, validateACPRegistryEntry, assertValidACPMessage, assertValidACPSession, type ValidationResult, } from './validator.js';
export * as ACP from '@agentclientprotocol/sdk';
//# sourceMappingURL=index.d.ts.map
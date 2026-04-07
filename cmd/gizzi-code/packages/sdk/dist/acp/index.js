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
export { ACPRegistry, acpRegistry, } from './registry.js';
export { ACPHarnessBridge, } from './harness-bridge.js';
export { validateACPMessage, validateACPSession, validateACPRegistryEntry, assertValidACPMessage, assertValidACPSession, } from './validator.js';
// Re-export the official ACP SDK for advanced usage
export * as ACP from '@agentclientprotocol/sdk';
//# sourceMappingURL=index.js.map
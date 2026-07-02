// @ts-nocheck
/**
 * allternit Super-Agent OS - Kernel Module
 * 
 * All kernel-related exports in one place.
 */

// Bridges
export { type UseKernelBridgeOptions, type UseKernelBridgeReturn, useKernelBridge } from './KernelBridge';
export { type UseAllternitRailsOptions, type UseAllternitRailsReturn, useAllternitRails } from './AllternitRailsBridge';
export { default as AllternitRailsWebSocketBridge, type UseRailsWebSocketOptions, type UseRailsWebSocketReturn, useRailsWebSocket } from './AllternitRailsWebSocketBridge';
export { type KernelMessage, useKernelProtocol } from './KernelProtocol';

// Services
export { OrchestratorEngine, type TaskNode, type AgentConfig, type ExecutionPlan, decomposeTask } from './OrchestratorEngine';

// Default export
export { default as kernelBridge } from './KernelBridge';

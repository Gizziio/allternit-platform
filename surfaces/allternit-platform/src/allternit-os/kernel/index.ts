/**
 * allternit Super-Agent OS - Kernel Module
 * 
 * All kernel-related exports in one place.
 */

// Bridges
export { AllternitRailsClient, type AllternitRailsClientOptions, type BusMessage, type DagEdge, type DagNode, type DagState, type LedgerEvent, type LoopProgress, type RailsRunnerState, type TerminalContext, type UseAllternitRailsOptions, type UseAllternitRailsReturn, type WihState, useAllternitRails } from './AllternitRailsBridge';
export { AllternitRailsWebSocketBridge, type BusMessagePayload, type ConnectionState, type DagUpdatePayload, type LedgerEventPayload, type RailsMessage, type RailsMessageHandler, type RailsMessageType, type RailsWebSocketConfig, type UseRailsWebSocketOptions, type UseRailsWebSocketReturn, railsWebSocketBridge, useRailsWebSocket } from './AllternitRailsWebSocketBridge';
export { type KernelBackend, type KernelBridge, type KernelBridgeOptions, KernelElectronBridge, KernelMockBridge, KernelWebSocketBridge, type UseKernelBridgeOptions, type UseKernelBridgeReturn, createKernelBridge, kernelBridge, useKernelBridge } from './KernelBridge';
export { type KernelMessage, type KernelMessageType, KernelProtocolHandler, detectLaunchDirectives, kernelProtocol, useKernelProtocol } from './KernelProtocol';

// Services
export { AGENT_TOOLS, type ToolContext, handleToolCall, useAgentTools } from './AgentTools';
export { type AgentConfig, type ExecutionPlan, OrchestratorEngine, type TaskNode, decomposeTask, useOrchestrator } from './OrchestratorEngine';

// Python Execution
export { type ExecutionBackend, type ExecutionSession, type PythonExecutionConfig, type PythonExecutionRequest, type PythonExecutionResult, PythonExecutionService, type UsePythonExecutionOptions, type VisualizationLibrary, generateVisualizationCode, pythonExecutionService, usePythonExecution } from './PythonExecutionService';

// Default export
export { kernelBridge as default } from './KernelBridge';

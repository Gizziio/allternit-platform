/**
 * ACP Harness Bridge
 * Bridges ACP protocol with AllternitHarness for seamless integration
 */
import { AllternitHarness } from '../harness/index.js';
import { StreamRequest, HarnessStreamChunk } from '../harness/types.js';
import { ACPMessage, ACPTool } from './schema.js';
import { ACPRegistry } from './registry.js';
export interface HarnessBridgeConfig {
    harness: AllternitHarness;
    registry?: ACPRegistry;
    agentId: string;
    capabilities?: string[];
    enableStreaming?: boolean;
}
export interface BridgeContext {
    sessionId?: string;
    messageId: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
/**
 * ACP Harness Bridge
 * Enables ACP agents to use the AllternitHarness for AI operations
 */
export declare class ACPHarnessBridge {
    private harness;
    private registry;
    private agentId;
    private capabilities;
    private enableStreaming;
    constructor(config: HarnessBridgeConfig);
    /**
     * Process an incoming ACP message
     */
    processMessage(message: ACPMessage): Promise<ACPMessage | null>;
    /**
     * Execute a tool using the harness
     */
    executeTool(tool: ACPTool, parameters: Record<string, unknown>, context?: BridgeContext): Promise<unknown>;
    /**
     * Create a streaming response
     */
    streamResponse(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
    /**
     * Register this agent with the ACP registry
     */
    register(): void;
    /**
     * Unregister this agent
     */
    unregister(): void;
    /**
     * Get bridge statistics
     */
    getStats(): {
        agentId: string;
        capabilities: string[];
        harnessMode: string;
        registered: boolean;
    };
    private handleRequest;
    private handleHandshake;
    private handleHeartbeat;
    private executeChat;
    private executeStream;
    private executeComplete;
    private createResponse;
    private createErrorResponse;
}
export default ACPHarnessBridge;

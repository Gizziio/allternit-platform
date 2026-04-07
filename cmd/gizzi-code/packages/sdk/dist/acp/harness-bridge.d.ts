/**
 * ACP (Agent Capability Protocol) Harness Bridge
 *
 * Bridge connecting ACP sessions to the AllternitHarness for unified AI interactions.
 * Uses official ACP types from @agentclientprotocol/sdk.
 */
import { AllternitHarness } from '../harness/index.js';
import { ACPRegistry } from './registry.js';
import type { AllternitACPSession, Content, ToolCall, ACPRegistryEntry } from './types.js';
export interface BridgeOptions {
    harness: AllternitHarness;
    registry: ACPRegistry;
}
export interface BridgeStreamChunk {
    type: 'content' | 'tool_call' | 'error' | 'done';
    content?: Content;
    toolCall?: ToolCall;
    error?: string;
}
export declare class ACPHarnessBridge {
    private harness;
    private registry;
    constructor(options: BridgeOptions);
    /**
     * Convert ACP session to harness stream
     */
    streamSession(session: AllternitACPSession): AsyncGenerator<BridgeStreamChunk>;
    /**
     * Create a new session with the harness
     */
    createSession(agentId: string, model: {
        provider: string;
        model: string;
    }, config?: AllternitACPSession['config']): AllternitACPSession;
    /**
     * Update a session
     */
    updateSession(sessionId: string, updates: Partial<AllternitACPSession>): AllternitACPSession | undefined;
    /**
     * Register a provider from harness-compatible config
     */
    registerProvider(entry: ACPRegistryEntry): void;
    /**
     * List available providers
     */
    listProviders(): ACPRegistryEntry[];
    /**
     * Get provider by ID
     */
    getProvider(id: string): ACPRegistryEntry | undefined;
}
export { ACPHarnessBridge as default };
//# sourceMappingURL=harness-bridge.d.ts.map
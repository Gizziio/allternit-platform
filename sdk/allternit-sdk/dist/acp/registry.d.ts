/**
 * ACP (Agent Capability Protocol) Registry
 * Manages agent capability registration and discovery
 */
import { ACPRegistryEntry, ACPMessage, ACPSession, ACPEvent } from './schema.js';
export interface RegistryOptions {
    maxEntries?: number;
    ttlMs?: number;
    enableHeartbeat?: boolean;
    heartbeatIntervalMs?: number;
}
export interface RegistryStats {
    totalAgents: number;
    activeAgents: number;
    totalCapabilities: number;
    totalSessions: number;
    lastUpdated: Date;
}
/**
 * ACP Registry
 * Central registry for agent capability management
 */
export declare class ACPRegistry {
    private entries;
    private sessions;
    private eventHandlers;
    private options;
    private heartbeatTimer?;
    constructor(options?: RegistryOptions);
    /**
     * Register a new agent
     */
    register(entry: ACPRegistryEntry): void;
    /**
     * Unregister an agent
     */
    unregister(agentId: string): boolean;
    /**
     * Get a registry entry
     */
    get(agentId: string): ACPRegistryEntry | undefined;
    /**
     * List all registered agents
     */
    list(filter?: {
        status?: string;
        category?: string;
    }): ACPRegistryEntry[];
    /**
     * Find agents by capability
     */
    findByCapability(capabilityName: string): ACPRegistryEntry[];
    /**
     * Search agents by name or description
     */
    search(query: string): ACPRegistryEntry[];
    /**
     * Create a new session
     */
    createSession(agentId: string, permissions?: string[]): ACPSession;
    /**
     * Get a session
     */
    getSession(sessionId: string): ACPSession | undefined;
    /**
     * Terminate a session
     */
    terminateSession(sessionId: string): boolean;
    /**
     * Update session metrics
     */
    updateSessionMetrics(sessionId: string, updates: Partial<ACPSession['metrics']>): void;
    /**
     * Validate message against registry
     */
    validateMessage(message: ACPMessage): {
        valid: boolean;
        error?: string;
    };
    /**
     * Subscribe to registry events
     */
    on(event: string, handler: (event: ACPEvent) => void): () => void;
    /**
     * Get registry statistics
     */
    getStats(): RegistryStats;
    /**
     * Clear all entries and sessions
     */
    clear(): void;
    /**
     * Dispose of the registry
     */
    dispose(): void;
    private emit;
    private startHeartbeat;
    private cleanupExpired;
    private evictOldest;
}
/**
 * Global registry instance
 */
export declare const acpRegistry: ACPRegistry;
export default ACPRegistry;

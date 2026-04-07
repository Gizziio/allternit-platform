/**
 * ACP (Agent Capability Protocol) Registry
 *
 * Central registry for managing agent and provider entries using official ACP types.
 */
import type { ACPRegistryEntry, AllternitACPSession } from './types.js';
export interface RegistryQuery {
    capability?: string;
    provider?: string;
    model?: string;
    authType?: string;
}
export declare class ACPRegistry {
    private entries;
    private modelsById;
    private sessions;
    /**
     * Register a new agent/provider entry
     */
    register(entry: ACPRegistryEntry): void;
    /**
     * Unregister an entry
     */
    unregister(id: string): boolean;
    /**
     * Get entry by ID
     */
    get(id: string): ACPRegistryEntry | undefined;
    /**
     * List all registered entries
     */
    list(): ACPRegistryEntry[];
    /**
     * Query entries by criteria
     */
    query(query: RegistryQuery): ACPRegistryEntry[];
    /**
     * Find entries by capability
     */
    findByCapability(capability: string): ACPRegistryEntry[];
    /**
     * Find entry by model ID
     */
    findByModel(modelId: string): ACPRegistryEntry | undefined;
    /**
     * Get model info
     */
    getModel(providerId: string, modelId: string): ACPRegistryEntry['models'][0] | undefined;
    /**
     * List all models across all entries
     */
    listAllModels(): Array<{
        provider: string;
        model: ACPRegistryEntry['models'][0];
    }>;
    /**
     * Check if entry exists
     */
    has(id: string): boolean;
    /**
     * Get count of registered entries
     */
    get size(): number;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Update an existing entry
     */
    update(id: string, updates: Partial<ACPRegistryEntry>): ACPRegistryEntry;
    /**
     * Store a session
     */
    setSession(session: AllternitACPSession): void;
    /**
     * Get a session
     */
    getSession(id: string): AllternitACPSession | undefined;
    /**
     * List all sessions
     */
    listSessions(): AllternitACPSession[];
    /**
     * Delete a session
     */
    deleteSession(id: string): boolean;
}
export declare const acpRegistry: ACPRegistry;
export default ACPRegistry;
//# sourceMappingURL=registry.d.ts.map
/**
 * Memory Agent Client
 * 
 * Bridges the Gizzi runtime to the Persistent Memory Agent (Port 3201).
 */

import { Log } from "@/shared/util/log"

const log = Log.create({ service: "memory-agent-client" })
const MEMORY_AGENT_URL = process.env.MEMORY_AGENT_URL || "http://127.0.0.1:3201"

export interface MemoryQueryResult {
    query: string
    answer: string
    memories: Array<{
        content: string
        source: string
        score?: number
    }>
    insights?: string[]
}

export namespace MemoryAgentClient {
    /**
     * Query the persistent memory for relevant context
     */
    export async function query(question: string, maxResults = 5): Promise<MemoryQueryResult | null> {
        try {
            const response = await fetch(`${MEMORY_AGENT_URL}/api/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, max_results: maxResults }),
                signal: AbortSignal.timeout(3000) 
            })

            if (!response.ok) {
                // Return null if service is down, don't crash the main loop
                return null
            }
            return await response.json() as MemoryQueryResult
        } catch (error) {
            log.warn("Failed to query memory agent", { error: error instanceof Error ? error.message : String(error) })
            return null
        }
    }

    /**
     * Ingest new content into the persistent memory
     */
    export async function ingest(content: string, source: string, metadata?: any): Promise<boolean> {
        try {
            const response = await fetch(`${MEMORY_AGENT_URL}/api/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, source, metadata }),
                signal: AbortSignal.timeout(5000)
            })

            return response.ok
        } catch (error) {
            log.warn("Failed to ingest into memory agent", { error: error instanceof Error ? error.message : String(error) })
            return false
        }
    }

    /**
     * Start an agent-based memory prefetch
     */
    export function startPrefetch(messages: any[]): { promise: Promise<any>, settledAt: number | null } {
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user' || m.type === 'user');
        if (!lastUserMessage) {
            return { promise: Promise.resolve(null), settledAt: Date.now() };
        }

        const content = lastUserMessage.content || lastUserMessage.message?.content;
        const query_text = typeof content === 'string' ? content : JSON.stringify(content);

        const handle = {
            promise: query(query_text, 3),
            settledAt: null as number | null
        };

        handle.promise.finally(() => {
            handle.settledAt = Date.now();
        });

        return handle;
    }
}

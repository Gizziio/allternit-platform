import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-cache");

// Cache tags
const mcpCacheTags = {
  connectionStatus: (connectorId: string) =>
    `mcp-connection-status-${connectorId}`,
  discovery: (connectorId: string) => `mcp-discovery-${connectorId}`,
} as const;

// Types for cached results
export type ConnectionStatusResult = {
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "authorizing"
    | "incompatible";
  needsAuth: boolean;
  error?: string;
};

export type DiscoveryResult = {
  tools: Array<{ name: string; description: string | null }>;
  resources: Array<{
    name: string;
    uri: string;
    description: string | null;
    mimeType: string | null;
  }>;
  prompts: Array<{
    name: string;
    description: string | null;
    arguments: Array<{
      name: string;
      description: string | null;
      required: boolean;
    }>;
  }>;
};

// Server-side cache functions - only imported on server
let unstable_cache: any;
let revalidateTag: any;

// Dynamically import next/cache only on server
if (typeof window === 'undefined') {
  try {
    const nextCache = require('next/cache');
    unstable_cache = nextCache.unstable_cache;
    revalidateTag = nextCache.revalidateTag;
  } catch (e) {
    // next/cache not available (e.g., in browser)
    unstable_cache = null;
    revalidateTag = null;
  }
}

/**
 * Create a cached connection status fetcher for a specific connector.
 * Cache duration: 5 minutes
 * Falls back to direct fetcher on client-side
 */
export function createCachedConnectionStatus(
  connectorId: string,
  fetcher: () => Promise<ConnectionStatusResult>
) {
  // On client side, just return the fetcher directly
  if (typeof window !== 'undefined' || !unstable_cache) {
    return fetcher;
  }
  
  return unstable_cache(
    () => {
      log.debug({ connectorId }, "Fetching connection status (cache miss)");
      return fetcher();
    },
    ["mcp-connection-status", connectorId],
    {
      revalidate: 300,
      tags: [mcpCacheTags.connectionStatus(connectorId)],
    }
  );
}

/**
 * Create a cached discovery fetcher for a specific connector.
 * Cache duration: 5 minutes (tools/resources/prompts rarely change)
 * Falls back to direct fetcher on client-side
 */
export function createCachedDiscovery(
  connectorId: string,
  fetcher: () => Promise<DiscoveryResult>
) {
  // On client side, just return the fetcher directly
  if (typeof window !== 'undefined' || !unstable_cache) {
    return fetcher;
  }
  
  return unstable_cache(
    () => {
      log.debug({ connectorId }, "Fetching discovery (cache miss)");
      return fetcher();
    },
    ["mcp-discovery", connectorId],
    {
      revalidate: 300,
      tags: [mcpCacheTags.discovery(connectorId)],
    }
  );
}

/**
 * Invalidate connection status cache for a connector.
 * Call this on: auth errors, disconnect, OAuth completion
 * No-op on client-side
 */
function invalidateConnectionStatus(connectorId: string) {
  log.debug({ connectorId }, "Invalidating connection status cache");
  if (typeof window === 'undefined' && revalidateTag) {
    revalidateTag(mcpCacheTags.connectionStatus(connectorId));
  }
}

/**
 * Invalidate discovery cache for a connector.
 * Call this on: disconnect, OAuth completion, refreshClient
 * No-op on client-side
 */
function invalidateDiscovery(connectorId: string) {
  log.debug({ connectorId }, "Invalidating discovery cache");
  if (typeof window === 'undefined' && revalidateTag) {
    revalidateTag(mcpCacheTags.discovery(connectorId));
  }
}

/**
 * Invalidate all MCP caches for a connector.
 * No-op on client-side
 */
export function invalidateAllMcpCaches(connectorId: string) {
  invalidateConnectionStatus(connectorId);
  invalidateDiscovery(connectorId);
}

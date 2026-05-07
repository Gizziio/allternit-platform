/**
 * MCP-related database queries
 * Uses the SQLite client (better-sqlite3) for standalone/desktop/tunnel builds.
 */

import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "./client-sqlite";
import { mcpConnector, mcpOAuthSession, type McpConnector, type McpOAuthSession } from "./schema-sqlite";

/**
 * Get all MCP connectors for a user
 */
export async function getMcpConnectorsByUserId(
  userId: string
): Promise<McpConnector[]> {
  return db
    .select()
    .from(mcpConnector)
    .where(eq(mcpConnector.userId, userId));
}

/**
 * Get a single MCP connector by ID
 */
export async function getMcpConnectorById(
  id: string
): Promise<McpConnector | null> {
  const results = await db
    .select()
    .from(mcpConnector)
    .where(eq(mcpConnector.id, id));
  return results[0] ?? null;
}

/**
 * Get an MCP connector by user ID and nameId
 */
export async function getMcpConnectorByNameId(
  userId: string,
  nameId: string
): Promise<McpConnector | null> {
  const results = await db
    .select()
    .from(mcpConnector)
    .where(and(eq(mcpConnector.userId, userId), eq(mcpConnector.nameId, nameId)));
  return results[0] ?? null;
}

/**
 * Create a new MCP connector
 */
export async function createMcpConnector(
  data: Omit<McpConnector, "id" | "createdAt" | "updatedAt">
): Promise<McpConnector> {
  const results = await db
    .insert(mcpConnector)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!results[0]) {
    throw new Error("Failed to create MCP connector");
  }

  return results[0];
}

/**
 * Update an existing MCP connector
 */
export async function updateMcpConnector(
  id: string,
  data: Partial<Omit<McpConnector, "id" | "createdAt" | "updatedAt">>
): Promise<McpConnector> {
  const results = await db
    .update(mcpConnector)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(mcpConnector.id, id))
    .returning();

  if (!results[0]) {
    throw new Error(`MCP connector ${id} not found`);
  }

  return results[0];
}

/**
 * Delete an MCP connector
 */
export async function deleteMcpConnector(id: string): Promise<void> {
  await db.delete(mcpConnector).where(eq(mcpConnector.id, id));
}

/**
 * Get enabled MCP connectors for a user
 */
export async function getEnabledMcpConnectors(
  userId: string
): Promise<McpConnector[]> {
  return db
    .select()
    .from(mcpConnector)
    .where(and(eq(mcpConnector.userId, userId), eq(mcpConnector.enabled, true)));
}

// ============================================================================
// OAuth Session Management
// ============================================================================

export interface OAuthClientInformationFull {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: Record<string, unknown>;
  software_id?: string;
  software_version?: string;
}

/**
 * Create a new OAuth session
 */
export async function createOAuthSession({
  mcpConnectorId,
  state,
  serverUrl,
}: {
  mcpConnectorId: string;
  state: string;
  serverUrl?: string;
}): Promise<McpOAuthSession> {
  const results = await db
    .insert(mcpOAuthSession)
    .values({
      mcpConnectorId,
      state,
      isAuthenticated: false,
      // Store serverUrl in metadata if provided
      ...(serverUrl ? { metadata: { serverUrl } as Record<string, unknown> } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!results[0]) {
    throw new Error("Failed to create OAuth session");
  }

  return results[0];
}

/**
 * Get OAuth session by state
 */
export async function getSessionByState({
  state,
}: {
  state: string;
}): Promise<McpOAuthSession | null> {
  const results = await db
    .select()
    .from(mcpOAuthSession)
    .where(eq(mcpOAuthSession.state, state));
  return results[0] ?? null;
}

/**
 * Get authenticated session (has tokens)
 */
export async function getAuthenticatedSession({
  mcpConnectorId,
}: {
  mcpConnectorId: string;
}): Promise<McpOAuthSession | null> {
  const results = await db
    .select()
    .from(mcpOAuthSession)
    .where(
      and(
        eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId),
        eq(mcpOAuthSession.isAuthenticated, true),
        isNotNull(mcpOAuthSession.tokens)
      )
    )
    .orderBy(mcpOAuthSession.createdAt)
    .limit(1);
  return results[0] ?? null;
}

/**
 * Delete OAuth session by state
 */
export async function deleteSessionByState({
  state,
}: {
  state: string;
}): Promise<void> {
  await db.delete(mcpOAuthSession).where(eq(mcpOAuthSession.state, state));
}

/**
 * Update OAuth session by state
 */
export async function updateSessionByState({
  state,
  updates,
}: {
  state: string;
  updates: Partial<Omit<McpOAuthSession, "id" | "createdAt">>;
}): Promise<McpOAuthSession> {
  const results = await db
    .update(mcpOAuthSession)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(mcpOAuthSession.state, state))
    .returning();

  if (!results[0]) {
    throw new Error(`OAuth session with state ${state} not found`);
  }

  return results[0];
}

/**
 * Set code verifier for a session (only if not already set)
 */
export async function setOAuthCodeVerifierOnceByState({
  state,
  codeVerifier,
}: {
  state: string;
  codeVerifier: string;
}): Promise<McpOAuthSession> {
  // First check if session exists and has no verifier
  const existing = await getSessionByState({ state });
  
  if (existing?.codeVerifier) {
    return existing;
  }

  const results = await db
    .update(mcpOAuthSession)
    .set({
      codeVerifier,
      updatedAt: new Date(),
    })
    .where(and(eq(mcpOAuthSession.state, state)))
    .returning();

  if (!results[0]) {
    throw new Error(`OAuth session with state ${state} not found`);
  }

  return results[0];
}

/**
 * Set OAuth client info for a session (only if not already set)
 */
export async function setOAuthClientInfoOnceByState({
  state,
  clientInfo,
}: {
  state: string;
  clientInfo: OAuthClientInformationFull;
}): Promise<McpOAuthSession> {
  // First check if session exists and has no client info
  const existing = await getSessionByState({ state });
  
  if (existing?.clientInfo) {
    return existing;
  }

  const results = await db
    .update(mcpOAuthSession)
    .set({
      clientInfo: clientInfo as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(mcpOAuthSession.state, state))
    .returning();

  if (!results[0]) {
    throw new Error(`OAuth session with state ${state} not found`);
  }

  return results[0];
}

/**
 * Save tokens and mark session as authenticated
 */
export async function saveTokensAndCleanup({
  state,
  mcpConnectorId,
  tokens,
}: {
  state: string;
  mcpConnectorId: string;
  tokens: Record<string, unknown>;
}): Promise<McpOAuthSession> {
  // Delete any other authenticated sessions for this connector
  await db
    .delete(mcpOAuthSession)
    .where(
      and(
        eq(mcpOAuthSession.mcpConnectorId, mcpConnectorId),
        eq(mcpOAuthSession.isAuthenticated, true),
        isNotNull(mcpOAuthSession.tokens)
      )
    );

  // Update current session with tokens
  const results = await db
    .update(mcpOAuthSession)
    .set({
      tokens: tokens as Record<string, unknown>,
      isAuthenticated: true,
      updatedAt: new Date(),
    })
    .where(eq(mcpOAuthSession.state, state))
    .returning();

  if (!results[0]) {
    throw new Error(`OAuth session with state ${state} not found`);
  }

  return results[0];
}

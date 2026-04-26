/**
 * Vault Connector Interface
 *
 * All external data sources that sync into the knowledge vault implement
 * this interface. Connectors are self-contained: they manage their own
 * authentication, configuration, and error handling.
 *
 * The vault subsystem discovers connectors via the registry. No hardcoded
 * source lists — adding a new connector is a single `registerConnector()` call.
 */

import { Log } from "@/shared/util/log"
import { Auth } from "@/runtime/integrations/auth"
import { loadSettings, type VaultUserSettings } from "./settings"
import type { VaultManager } from "./index"
import type { SyncResult } from "./sync"

const log = Log.create({ service: "vault-connector" })

// ============================================================================
// Connector Types
// ============================================================================

export type ConnectorAuthType = "oauth" | "apikey" | "none"

export interface ConnectorMetadata {
  id: string
  name: string
  description: string
  version: string
  authType: ConnectorAuthType
  authProviderId?: string // Key used in Auth store (e.g. "google", "fireflies")
}

export interface ConnectorStatus {
  connected: boolean
  authenticated: boolean
  lastSyncAt?: string
  error?: string
}

export interface ConnectorConfig {
  enabled: boolean
  lookbackDays: number
  intervalMinutes: number
  // Source-specific overrides from settings
  [key: string]: any
}

export interface VaultConnector {
  readonly meta: ConnectorMetadata

  /** Initialize the connector (called once at daemon startup) */
  init(): Promise<void>

  /** Validate credentials and establish connection */
  connect(): Promise<boolean>

  /** Perform a sync operation */
  sync(vault: VaultManager, config: ConnectorConfig): Promise<SyncResult>

  /** Disconnect and clean up */
  disconnect(): Promise<void>

  /** Return current health/status */
  status(): Promise<ConnectorStatus>
}

// ============================================================================
// Connector Registry
// ============================================================================

const registry = new Map<string, VaultConnector>()

export function registerConnector(connector: VaultConnector): void {
  registry.set(connector.meta.id, connector)
  log.info("Connector registered", { id: connector.meta.id, name: connector.meta.name })
}

export function getConnector(id: string): VaultConnector | undefined {
  return registry.get(id)
}

export function listConnectors(): VaultConnector[] {
  return Array.from(registry.values())
}

export function listConnectorIds(): string[] {
  return Array.from(registry.keys())
}

// ============================================================================
// Auth Helpers
// ============================================================================

export async function checkOAuthAuth(providerId: string): Promise<boolean> {
  const auth = await Auth.get(providerId)
  return auth?.type === "oauth" && auth.access.length > 0
}

export async function checkApiKeyAuth(providerId: string): Promise<boolean> {
  const auth = await Auth.get(providerId)
  return auth?.type === "api" && auth.key.length > 0
}

export async function refreshOAuthToken(
  providerId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!response.ok) {
      log.error("OAuth refresh failed", { providerId, status: response.status })
      return false
    }

    const data = await response.json()
    await Auth.set(providerId, {
      type: "oauth",
      access: data.access_token,
      refresh: refreshToken,
      expires: Date.now() + data.expires_in * 1000,
    })

    return true
  } catch (e) {
    log.error("OAuth refresh error", { providerId, error: e })
    return false
  }
}

// ============================================================================
// Settings-driven Connector Config
// ============================================================================

export async function getConnectorConfig(id: string): Promise<ConnectorConfig> {
  const settings = await loadSettings()

  switch (id) {
    case "gmail":
      return {
        enabled: settings.sources.gmail.enabled,
        lookbackDays: 7,
        intervalMinutes: 60,
      }
    case "calendar":
      return {
        enabled: settings.sources.calendar.enabled,
        lookbackDays: 30,
        intervalMinutes: 60,
      }
    case "fireflies":
      return {
        enabled: settings.sources.fireflies.enabled,
        lookbackDays: 30,
        intervalMinutes: 60,
        apiKey: settings.sources.fireflies.apiKey,
      }
    default:
      return { enabled: false, lookbackDays: 7, intervalMinutes: 60 }
  }
}

// ============================================================================
// Orchestrator
// ============================================================================

export async function runConnectorSync(
  vault: VaultManager,
  id: string,
): Promise<SyncResult> {
  const connector = getConnector(id)
  if (!connector) {
    return {
      source: id,
      success: false,
      itemsSynced: 0,
      errors: [`Connector not found: ${id}`],
    }
  }

  const config = await getConnectorConfig(id)
  if (!config.enabled) {
    return {
      source: id,
      success: true,
      itemsSynced: 0,
      errors: [],
    }
  }

  const status = await connector.status()
  if (!status.authenticated) {
    return {
      source: id,
      success: false,
      itemsSynced: 0,
      errors: [`Not authenticated. Run: gizzi vault config auth ${id}`],
    }
  }

  log.info("Running connector sync", { id })
  const start = Date.now()

  try {
    const result = await connector.sync(vault, config)
    log.info("Connector sync complete", { id, durationMs: Date.now() - start, itemsSynced: result.itemsSynced })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    log.error("Connector sync failed", { id, error })
    return { source: id, success: false, itemsSynced: 0, errors: [error] }
  }
}

export async function runAllConnectorSyncs(vault: VaultManager): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  for (const id of listConnectorIds()) {
    results.push(await runConnectorSync(vault, id))
  }
  return results
}

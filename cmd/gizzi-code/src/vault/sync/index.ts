/**
 * Vault Sync Orchestrator
 *
 * Coordinates background synchronization of external data sources
 * into the knowledge vault via the Connector registry.
 *
 * Backward compatibility: this module re-exports the connector-based
 * sync functions with the same names as the legacy engine API.
 */

import { Log } from "@/shared/util/log"
import type { VaultManager } from "@/vault"
import {
  getConnector,
  listConnectorIds,
  getConnectorConfig,
  runConnectorSync,
  runAllConnectorSyncs,
  type VaultConnector,
} from "@/vault/connector"

// Auto-register built-in connectors
import "@/vault/connectors"

const log = Log.create({ service: "vault-sync" })

export interface SyncResult {
  source: string
  success: boolean
  itemsSynced: number
  errors: string[]
}

/** @deprecated Use Connector registry instead */
export type SyncEngine = (vault: VaultManager, config: any) => Promise<SyncResult>

/** @deprecated Use Connector registry instead */
const engines = new Map<string, SyncEngine>()

/** @deprecated Use registerConnector() instead */
export function registerEngine(name: string, engine: SyncEngine): void {
  engines.set(name, engine)
  log.info("Registered legacy sync engine", { name })
}

/**
 * Run a sync for a single source by ID.
 * Uses the Connector registry; falls back to legacy engines if no connector found.
 */
export async function runSync(vault: VaultManager, source: string): Promise<SyncResult> {
  // Prefer connector registry
  const connector = getConnector(source)
  if (connector) {
    const config = await getConnectorConfig(source)
    return runConnectorSync(vault, source)
  }

  // Fallback to legacy engine
  const engine = engines.get(source)
  if (!engine) {
    return {
      source,
      success: false,
      itemsSynced: 0,
      errors: [`No sync connector or engine registered for: ${source}`],
    }
  }

  log.info("Running legacy sync engine", { source })
  try {
    const result = await engine(vault, { enabled: true })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { source, success: false, itemsSynced: 0, errors: [error] }
  }
}

/**
 * Run all enabled syncs.
 */
export async function runAllSyncs(vault: VaultManager): Promise<SyncResult[]> {
  // Run all registered connectors
  const connectorResults = await runAllConnectorSyncs(vault)

  // Also run any legacy engines not yet migrated to connectors
  const connectorIds = new Set(listConnectorIds())
  for (const [source, engine] of engines.entries()) {
    if (connectorIds.has(source)) continue
    try {
      const result = await engine(vault, { enabled: true })
      connectorResults.push(result)
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      connectorResults.push({ source, success: false, itemsSynced: 0, errors: [error] })
    }
  }

  return connectorResults
}

// Re-export connector types for consumers
export { getConnector, listConnectorIds, listConnectors } from "@/vault/connector"
export type { VaultConnector, ConnectorConfig, ConnectorStatus } from "@/vault/connector"

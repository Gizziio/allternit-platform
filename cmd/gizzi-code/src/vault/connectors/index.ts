/**
 * Vault Connectors Index
 *
 * Auto-registers all built-in vault connectors.
 * Import this module to make connectors available to the sync system.
 */

// Side-effect imports — each connector calls registerConnector() on load
import "./gmail"
import "./calendar"
import "./fireflies"

export * from "@/vault/connector"

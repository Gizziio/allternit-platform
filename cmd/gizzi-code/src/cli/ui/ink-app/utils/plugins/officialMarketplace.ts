// @ts-nocheck
/**
 * Constants for the upstream Anthropic plugins marketplace.
 *
 * This is not Gizzi chrome. Auto-install is refused unless
 * GIZZI_ENABLE_UPSTREAM_MARKETPLACE=1.
 */

import type { MarketplaceSource } from './schemas.js'

/**
 * Source configuration for the official Anthropic plugins marketplace.
 * Used when auto-installing the marketplace on startup.
 */
export const OFFICIAL_MARKETPLACE_SOURCE = {
  source: 'github',
  repo: 'anthropics/claude-plugins-official',
} as const satisfies MarketplaceSource

/**
 * Display name for the official marketplace.
 * This is the name under which the marketplace will be registered
 * in the known_marketplaces.json file.
 */
export const OFFICIAL_MARKETPLACE_NAME = 'claude-plugins-official'

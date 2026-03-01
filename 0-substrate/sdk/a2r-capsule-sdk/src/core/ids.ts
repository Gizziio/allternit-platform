/**
 * Core Identifiers
 *
 * Type definitions for all capsule-wide identifiers.
 * These are opaque strings - the SDK never inspects their content.
 */

// ============================================================================
// Identifiers
// ============================================================================

export type SpaceId = string;

export type CapsuleId = string;

export type TabId = string;

export type ActionId = string;

export type EventId = string;

// ============================================================================
// ID Factories (for convenience)
// ============================================================================

/**
 * Generate a new unique capsule ID
 */
export function generateCapsuleId(prefix: string = 'capsule'): CapsuleId {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a new unique tab ID
 */
export function generateTabId(prefix: string = 'tab'): TabId {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a new unique event ID
 */
export function generateEventId(): EventId {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a new unique space ID
 */
export function generateSpaceId(prefix: string = 'space'): SpaceId {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Capabilities Module
 *
 * Declared capabilities for a capsule.
 * These are assertions that A2UI/AG-UI can query to determine available features.
 */

import { CapsuleId } from './ids.js';

// ============================================================================
// Capability Types
// ============================================================================

export interface CapsuleCapabilities {
  staged?: boolean;
  streaming?: boolean;
  gpu?: boolean;
  multiTab?: boolean;
  agentControllable?: boolean;
}

// ============================================================================
// Default Capabilities
// ============================================================================

export const DEFAULT_CAPABILITIES: CapsuleCapabilities = {
  staged: false,
  streaming: false,
  gpu: false,
  multiTab: false,
  agentControllable: true,
};

// ============================================================================
// Capability Controller
// ============================================================================

export interface CapsuleCapabilitiesController {
  getCapabilities(): CapsuleCapabilities;
  hasCapability<K extends keyof CapsuleCapabilities>(
    key: K
  ): CapsuleCapabilities[K] | undefined;
  setCapabilities(capabilities: CapsuleCapabilities): void;
  updateCapabilities(partial: Partial<CapsuleCapabilities>): void;
}

// ============================================================================
// Capability Controller Implementation
// ============================================================================

export function createCapabilitiesController(
  capsuleId: CapsuleId,
  initialCapabilities: CapsuleCapabilities = DEFAULT_CAPABILITIES,
  onChange?: (capabilities: CapsuleCapabilities) => void
): CapsuleCapabilitiesController {
  let capabilities: CapsuleCapabilities = { ...initialCapabilities };

  const notifyChange = () => {
    onChange?.({ ...capabilities });
  };

  return {
    getCapabilities(): CapsuleCapabilities {
      return { ...capabilities };
    },

    hasCapability<K extends keyof CapsuleCapabilities>(key: K): CapsuleCapabilities[K] | undefined {
      return capabilities[key];
    },

    setCapabilities(newCapabilities: CapsuleCapabilities): void {
      capabilities = { ...newCapabilities };
      notifyChange();
    },

    updateCapabilities(partial: Partial<CapsuleCapabilities>): void {
      capabilities = { ...capabilities, ...partial };
      notifyChange();
    },
  };
}

// ============================================================================
// Capability Utility Functions
// ============================================================================

/**
 * Check if a capability object indicates the capsule supports staging
 */
export function supportsStaging(capabilities: CapsuleCapabilities): boolean {
  return capabilities.staged === true;
}

/**
 * Check if a capability object indicates the capsule supports streaming
 */
export function supportsStreaming(capabilities: CapsuleCapabilities): boolean {
  return capabilities.streaming === true;
}

/**
 * Check if a capability object indicates the capsule supports GPU rendering
 */
export function supportsGpu(capabilities: CapsuleCapabilities): boolean {
  return capabilities.gpu === true;
}

/**
 * Check if a capability object indicates the capsule supports multiple tabs
 */
export function supportsMultiTab(capabilities: CapsuleCapabilities): boolean {
  return capabilities.multiTab === true;
}

/**
 * Check if a capability object indicates agent controllability
 */
export function isAgentControllable(capabilities: CapsuleCapabilities): boolean {
  return capabilities.agentControllable !== false;
}

/**
 * Merge two capability objects (second takes precedence)
 */
export function mergeCapabilities(
  base: CapsuleCapabilities,
  override: Partial<CapsuleCapabilities>
): CapsuleCapabilities {
  return { ...base, ...override };
}

/**
 * Sandbox adapter — production implementation is ink-app SessionSandbox.
 * This module re-exports that adapter so remaining shared/ imports compile.
 */
export {
  addToExcludedCommands,
  convertToSandboxRuntimeConfig,
  resolvePathPatternForSandbox,
  resolveSandboxFilesystemPath,
  shouldAllowManagedSandboxDomainsOnly,
  SandboxManager,
  SandboxViolationStore,
  SandboxRuntimeConfigSchema,
  type ISandboxManager,
  type SandboxAskCallback,
  type SandboxDependencyCheck,
  type SandboxViolationEvent,
  type SandboxRuntimeConfig,
  type FsReadRestrictionConfig,
  type FsWriteRestrictionConfig,
  type NetworkRestrictionConfig,
  type NetworkHostPattern,
  type IgnoreViolationsConfig,
} from '../../../cli/ui/ink-app/utils/sandbox/sandbox-adapter.js'

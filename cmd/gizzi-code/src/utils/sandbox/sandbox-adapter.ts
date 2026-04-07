/**
 * Sandbox adapter - re-export from shared
 * All sandbox management goes through shared/utils/sandbox
 */

export {
  resolvePathPatternForSandbox,
  resolveSandboxFilesystemPath,
  shouldAllowManagedSandboxDomainsOnly,
  convertToSandboxRuntimeConfig,
  addToExcludedCommands,
  SandboxManager,
  SandboxViolationStore,
  SandboxRuntimeConfigSchema,
  type ISandboxManager,
  type SandboxViolationEvent,
  type SandboxRuntimeConfig,
  type SandboxFilesystemConfig,
} from '../../shared/utils/sandbox/sandbox-adapter.js'

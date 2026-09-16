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
} from '../../cli/ui/ink-app/utils/sandbox/sandbox-adapter.js'

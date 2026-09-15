// @ts-nocheck
// Typed stub for the optional `@anthropic-ai/sandbox-runtime` package.
//
// The real package provides macOS Seatbelt / Linux bubblewrap sandboxing for
// bash execution. It is an OPTIONAL dependency that is not vendored in this
// build. The stub keeps the module resolvable and reports the sandbox as
// unavailable on the probe paths normal flow calls; anything that would
// actually activate sandboxing throws a loud, actionable error.

const MISSING =
  '@anthropic-ai/sandbox-runtime is not bundled in this build. ' +
  'Install it and rebuild, or disable sandbox mode (settings.sandbox.enabled = false).'

function unavailable(): never {
  throw new Error(MISSING)
}

export class SandboxManager {
  /** Probe used by normal flow — must not throw. */
  static isSupportedPlatform(): boolean {
    return false
  }

  /** Probe used by normal flow — reports sandbox unusable, no crash. */
  static checkDependencies(_opts: unknown): { errors: string[]; warnings: string[] } {
    return { errors: [MISSING], warnings: [] }
  }

  // Everything below activates or drives the sandbox; it must fail loudly.
  static wrapWithSandbox(): never {
    return unavailable()
  }
  static initialize(): never {
    return unavailable()
  }
  static updateConfig(): never {
    return unavailable()
  }
  static reset(): never {
    return unavailable()
  }
  static getFsReadConfig(): never {
    return unavailable()
  }
  static getFsWriteConfig(): never {
    return unavailable()
  }
  static getNetworkRestrictionConfig(): never {
    return unavailable()
  }
  static getIgnoreViolations(): never {
    return unavailable()
  }
  static getProxyPort(): never {
    return unavailable()
  }
  static waitForNetworkInitialization(): never {
    return unavailable()
  }
}

/** Zod-shaped stub; .parse throws (only reached on sandbox config paths). */
export const SandboxRuntimeConfigSchema = {
  parse: unavailable,
  safeParse: () => ({ success: false, error: new Error(MISSING) }),
}

export class SandboxViolationStore {
  constructor(..._args: unknown[]) {
    // Constructible as a type holder; methods throw on use.
  }
  feedLine(): never {
    return unavailable()
  }
  getViolations(): never {
    return unavailable()
  }
}

/**
 * Per-Session Sandbox State
 *
 * Tracks whether the shell sandbox is enabled for each session and
 * what the active policy is (write paths, network access).
 *
 * State is in-memory — it dies with the server process. That's intentional:
 * this is a runtime decision, not a persistent config.
 *
 * Sandboxing is on by default (see bash.ts); this module tracks explicit
 * per-session overrides plus the `/sandbox` command's process-wide default
 * (keyed by DEFAULT_SESSION_KEY — see getEffective). GIZZI_SANDBOX_DISABLE is
 * the intentional opt-out.
 */
import type { SandboxPolicy } from "@/runtime/integrations/shell/sandbox"
import { Sandbox } from "@/runtime/integrations/shell/sandbox"
import { Log } from "@/shared/util/log"
import { Instance } from "@/runtime/context/project/instance"
import { Flag } from "@/runtime/context/flag/flag.ts"

const log = Log.create({ service: "session-sandbox" })

export interface SandboxState {
  enabled: boolean
  policy: SandboxPolicy
  driver: ReturnType<typeof Sandbox.detect>
}

const states = new Map<string, SandboxState>()

/**
 * Key for the process-wide toggle driven by the `/sandbox` TUI command, which
 * has no per-session context of its own. Per-session state (set via the API/
 * flag path) always takes precedence over this default when both exist.
 */
export const DEFAULT_SESSION_KEY = "__default__"

function defaultPolicy(): SandboxPolicy {
  return {
    allowWritePaths: [Instance.directory],
    // Deny by default — matches gizzi-code. Agents that need npm/pip/cargo
    // must opt in via GIZZI_SANDBOX_ALLOW_NETWORK or an explicit policy override.
    allowNetwork: false,
  }
}

export namespace SessionSandbox {
  /** Get the current sandbox state for a session. Returns null if not configured. */
  export function get(sessionID: string): SandboxState | null {
    return states.get(sessionID) ?? null
  }

  /**
   * Get the state that actually applies to a session: an explicit per-session
   * override if one was set, otherwise the process-wide default (the `/sandbox`
   * command's toggle). This is what enforcement call sites (e.g. the Bash tool)
   * should read, instead of `get`, so the visible `/sandbox` command actually
   * changes what gets enforced.
   */
  export function getEffective(sessionID: string): SandboxState | null {
    return states.get(sessionID) ?? states.get(DEFAULT_SESSION_KEY) ?? null
  }

  /**
   * Get the effective state, auto-enabling it with defaults on first use if
   * nothing is configured yet and the caller hasn't opted out
   * (GIZZI_SANDBOX_DISABLE / --dangerously-skip-sandbox). Every enforcement
   * call site (Bash, file writes) should call this rather than re-implementing
   * "sandboxed unless explicitly turned off" independently.
   */
  export function ensureDefault(sessionID: string, extraWritePaths: string[] = []): SandboxState | null {
    const existing = getEffective(sessionID)
    if (existing) return existing
    if (Flag.GIZZI_SANDBOX_DISABLE) return null
    return enable(sessionID, {
      allowWritePaths: extraWritePaths,
      allowNetwork: Flag.GIZZI_SANDBOX_ALLOW_NETWORK,
      allowedDomains: Flag.GIZZI_SANDBOX_ALLOWED_DOMAINS,
    })
  }

  /**
   * Enable sandbox for a session.
   * Merges the provided policy with defaults.
   */
  export function enable(sessionID: string, policy?: Partial<SandboxPolicy>): SandboxState {
    const driver = Sandbox.detect()
    const merged: SandboxPolicy = {
      ...defaultPolicy(),
      ...policy,
      allowWritePaths: [
        ...defaultPolicy().allowWritePaths,
        ...(policy?.allowWritePaths ?? []),
      ],
    }
    const state: SandboxState = { enabled: true, policy: merged, driver }
    states.set(sessionID, state)
    log.info("sandbox enabled", { sessionID, driver, allowNetwork: merged.allowNetwork })
    return state
  }

  /**
   * Disable sandbox for a session. Cleans up any profile files.
   *
   * Always records an explicit `{ enabled: false }` entry, even if nothing
   * was enabled yet -- sandboxing is on by default (see ensureDefault), so a
   * no-op early return here would mean "disable" silently failed to override
   * that default the first time it's called for a session.
   */
  export async function disable(sessionID: string): Promise<void> {
    const state = states.get(sessionID)
    if (state) {
      state.enabled = false
      states.set(sessionID, state)
    } else {
      states.set(sessionID, { enabled: false, policy: defaultPolicy(), driver: Sandbox.detect() })
    }
    // Clean up macOS profile file if one was written
    await Sandbox.cleanupProfile(sessionID)
    log.info("sandbox disabled", { sessionID })
  }

  /** Toggle sandbox on/off. Returns the new state. */
  export async function toggle(sessionID: string, policy?: Partial<SandboxPolicy>): Promise<SandboxState> {
    const current = states.get(sessionID)
    if (current?.enabled) {
      await disable(sessionID)
      return { ...current, enabled: false }
    }
    return enable(sessionID, policy)
  }

  /** Add an extra write path to an active session's policy. */
  export function allowWritePath(sessionID: string, p: string): void {
    const state = states.get(sessionID)
    if (!state) return
    if (!state.policy.allowWritePaths.includes(p)) {
      state.policy.allowWritePaths.push(p)
    }
  }

  /** Update network access for an active session. */
  export function setNetwork(sessionID: string, allow: boolean): void {
    const state = states.get(sessionID)
    if (!state) return
    state.policy.allowNetwork = allow
    // Invalidate the macOS profile so it gets regenerated with new rules
    void Sandbox.cleanupProfile(sessionID)
  }

  /**
   * Restrict network access (when allowed at all) to a domain allowlist,
   * routed through the local proxy instead of a wholesale allow. Pass an
   * empty array to go back to unrestricted network.
   */
  export function setAllowedDomains(sessionID: string, domains: string[]): void {
    const state = states.get(sessionID)
    if (!state) return
    state.policy.allowedDomains = domains
    // Invalidate the profile/proxy so they get regenerated with new rules
    void Sandbox.cleanupProfile(sessionID)
  }

  /** Remove all state for a session (called on session close). */
  export async function cleanup(sessionID: string): Promise<void> {
    await disable(sessionID)
    states.delete(sessionID)
  }
}

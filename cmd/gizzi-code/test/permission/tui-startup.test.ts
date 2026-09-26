// @ts-nocheck
import { test, expect, describe } from "bun:test"
import {
  bypassRefusedAsRootMessage,
  tuiPermissionModeEnv,
} from "../../src/cli/ui/ink-app/utils/permissions/tuiPermissionStartup"

// Regression guard for the TUI permission-bypass bug: thread.ts translates
// --yolo / --dangerously-skip-permissions into env vars, but nothing in the
// ink-app read them, so the TUI always seeded mode 'default' and kept
// prompting. tui() now resolves these into initialPermissionModeFromCLI +
// initializeToolPermissionContext.

describe("tuiPermissionModeEnv", () => {
  test("maps GIZZI_PERMISSION_MODE=yolo to bypassPermissions for the ink-app engine", () => {
    const result = tuiPermissionModeEnv({
      GIZZI_PERMISSION_MODE: "yolo",
      GIZZI_DANGEROUSLY_SKIP_PERMISSIONS: "1",
    })
    expect(result.permissionModeCli).toBe("bypassPermissions")
    expect(result.dangerouslySkipPermissions).toBe(true)
  })

  test("passes through explicit ink-app modes unchanged", () => {
    for (const mode of ["default", "acceptEdits", "plan", "bypassPermissions"]) {
      expect(tuiPermissionModeEnv({ GIZZI_PERMISSION_MODE: mode }).permissionModeCli).toBe(mode)
    }
  })

  test("unset env resolves to no flag input", () => {
    const result = tuiPermissionModeEnv({})
    expect(result.permissionModeCli).toBeUndefined()
    expect(result.dangerouslySkipPermissions).toBe(false)
  })

  test("skip flag truthiness matches isEnvTruthy semantics", () => {
    expect(tuiPermissionModeEnv({ GIZZI_DANGEROUSLY_SKIP_PERMISSIONS: "1" }).dangerouslySkipPermissions).toBe(true)
    expect(tuiPermissionModeEnv({ GIZZI_DANGEROUSLY_SKIP_PERMISSIONS: "true" }).dangerouslySkipPermissions).toBe(true)
    expect(tuiPermissionModeEnv({ GIZZI_DANGEROUSLY_SKIP_PERMISSIONS: "0" }).dangerouslySkipPermissions).toBe(false)
    expect(tuiPermissionModeEnv({ GIZZI_DANGEROUSLY_SKIP_PERMISSIONS: "no" }).dangerouslySkipPermissions).toBe(false)
  })
})

describe("bypassRefusedAsRootMessage", () => {
  const isRoot = process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0

  test("never refuses when not running as root", () => {
    if (isRoot) return // guard only exercises root; CI/dev machines run unprivileged
    expect(bypassRefusedAsRootMessage({})).toBeUndefined()
    expect(bypassRefusedAsRootMessage({ IS_SANDBOX: "1" })).toBeUndefined()
  })

  test("sandbox env vars clear the refusal when root", () => {
    if (!isRoot) return
    expect(bypassRefusedAsRootMessage({})).toContain("root/sudo")
    expect(bypassRefusedAsRootMessage({ IS_SANDBOX: "1" })).toBeUndefined()
    expect(bypassRefusedAsRootMessage({ GIZZI_BUBBLEWRAP: "1" })).toBeUndefined()
  })
})

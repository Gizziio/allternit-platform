import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import {
  getPrivacyLevel,
  isTelemetryDisabled,
} from "../src/shared/utils/privacyLevel"
import {
  redactTelemetryString,
  sanitizeTelemetryMetadata,
} from "../src/shared/utils/telemetryRedact"
import {
  _resetTelemetrySettingsForTesting,
  getTelemetrySettings,
  hasTelemetryNoticeBeenShown,
  isTelemetryDisabledInSettings,
  markTelemetryNoticeShown,
  setTelemetryEnabled,
} from "../src/shared/utils/telemetrySettings"

let tmp: string
const savedEnv: Record<string, string | undefined> = {}

function setEnv(name: string, value: string | undefined) {
  if (!(name in savedEnv)) savedEnv[name] = process.env[name]
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gizzi-telemetry-test-"))
  setEnv("GIZZI_TELEMETRY_SETTINGS_PATH", path.join(tmp, "telemetry.json"))
  for (const name of [
    "GIZZI_TELEMETRY",
    "GIZZI_DISABLE_TELEMETRY",
    "DISABLE_TELEMETRY",
    "GIZZI_DISABLE_NONESSENTIAL_TRAFFIC",
  ]) {
    setEnv(name, undefined)
  }
  _resetTelemetrySettingsForTesting()
})

afterEach(() => {
  _resetTelemetrySettingsForTesting()
  fs.rmSync(tmp, { recursive: true, force: true })
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe("redactTelemetryString", () => {
  test("redacts POSIX absolute paths including home dir", () => {
    const out = redactTelemetryString(`open ${os.homedir()}/project/secret.txt failed`)
    expect(out).not.toContain(os.homedir())
    expect(out).toContain("<REDACTED:path>")
  })

  test("redacts paths with other users' home dirs", () => {
    const out = redactTelemetryString("cat /Users/someoneelse/.ssh/id_rsa")
    expect(out).not.toContain("/Users/someoneelse")
    expect(out).toContain("<REDACTED:path>")
  })

  test("redacts Windows paths", () => {
    const out = redactTelemetryString("read C:\\Users\\jane\\Documents\\file.txt")
    expect(out).not.toContain("C:\\Users\\jane")
    expect(out).toContain("<REDACTED:path>")
  })

  test("keeps node_modules-relative path tails", () => {
    const out = redactTelemetryString("at /Users/dev/app/node_modules/pkg/index.js:1")
    expect(out).toContain("node_modules/pkg/index.js")
  })

  test("redacts emails, JWTs, and common token shapes", () => {
    expect(redactTelemetryString("contact jane@example.com now")).toContain("<REDACTED:email>")
    expect(
      redactTelemetryString("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c"),
    ).toContain("<REDACTED:jwt>")
    expect(redactTelemetryString("key sk-ant-api03-ABCDEFGHIJKLMNOP")).toContain("<REDACTED:api-key>")
    expect(redactTelemetryString("key ghp_abcdefghij0123456789abcd")).toContain("<REDACTED:github-token>")
    expect(redactTelemetryString("key alt_0123456789abcdef0123456789abcdef")).toContain("<REDACTED:allternit-token>")
  })

  test("strips URL credentials and query strings", () => {
    const out = redactTelemetryString("GET https://user:pass@internal.example.com/path?q=secret")
    expect(out).not.toContain("user:pass")
    expect(out).not.toContain("?q=secret")
    expect(out).toContain("<REDACTED:url>")
  })

  test("leaves benign strings untouched and truncates long ones", () => {
    expect(redactTelemetryString("git commit")).toBe("git commit")
    const long = "a".repeat(500)
    expect(redactTelemetryString(long)).toHaveLength(256)
  })
})

describe("sanitizeTelemetryMetadata", () => {
  test("redacts strings at any depth, leaves numbers/booleans", () => {
    const metadata = {
      ok: true,
      count: 3,
      error: `ENOENT: /Users/dev/x.txt`,
      nested: { path: "/var/log/secret.log" },
      list: ["/home/dev/.aws/credentials"],
    }
    const out = sanitizeTelemetryMetadata(metadata)
    expect(out.ok).toBe(true)
    expect(out.count).toBe(3)
    expect(out.error).toContain("<REDACTED:path>")
    expect(out.nested.path).toBe("<REDACTED:path>")
    expect(out.list[0]).toBe("<REDACTED:path>")
  })
})

describe("telemetrySettings", () => {
  test("defaults to enabled with no notice shown", () => {
    const settings = getTelemetrySettings()
    expect(settings.enabled).toBe(true)
    expect(settings.noticeShownAt).toBeNull()
    expect(isTelemetryDisabledInSettings()).toBe(false)
    expect(hasTelemetryNoticeBeenShown()).toBe(false)
  })

  test("setTelemetryEnabled(false) persists and is re-read", () => {
    setTelemetryEnabled(false)
    _resetTelemetrySettingsForTesting()
    expect(isTelemetryDisabledInSettings()).toBe(true)
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, "telemetry.json"), "utf8"))
    expect(onDisk.enabled).toBe(false)
  })

  test("markTelemetryNoticeShown persists a timestamp", () => {
    markTelemetryNoticeShown()
    _resetTelemetrySettingsForTesting()
    expect(hasTelemetryNoticeBeenShown()).toBe(true)
    expect(getTelemetrySettings().noticeShownAt).toBeTruthy()
  })

  test("corrupt settings file falls back to defaults", () => {
    fs.writeFileSync(path.join(tmp, "telemetry.json"), "{not json")
    expect(getTelemetrySettings().enabled).toBe(true)
  })
})

describe("privacyLevel kill switches", () => {
  test("GIZZI_TELEMETRY=off disables telemetry", () => {
    setEnv("GIZZI_TELEMETRY", "off")
    expect(getPrivacyLevel()).toBe("no-telemetry")
    expect(isTelemetryDisabled()).toBe(true)
  })

  test("GIZZI_TELEMETRY accepts other off spellings", () => {
    for (const value of ["0", "false", "no", "disabled", "OFF"]) {
      setEnv("GIZZI_TELEMETRY", value)
      expect(getPrivacyLevel()).toBe("no-telemetry")
    }
  })

  test("GIZZI_TELEMETRY=on keeps default level", () => {
    setEnv("GIZZI_TELEMETRY", "on")
    expect(getPrivacyLevel()).toBe("default")
  })

  test("settings flag disables telemetry without env vars", () => {
    setTelemetryEnabled(false)
    expect(getPrivacyLevel()).toBe("no-telemetry")
  })

  test("legacy env vars and nonessential-traffic still win", () => {
    setEnv("DISABLE_TELEMETRY", "1")
    expect(getPrivacyLevel()).toBe("no-telemetry")
    setEnv("DISABLE_TELEMETRY", undefined)
    setEnv("GIZZI_DISABLE_NONESSENTIAL_TRAFFIC", "1")
    expect(getPrivacyLevel()).toBe("essential-traffic")
  })

  test("settings flag does not override essential-traffic env", () => {
    setEnv("GIZZI_DISABLE_NONESSENTIAL_TRAFFIC", "1")
    setTelemetryEnabled(true)
    expect(getPrivacyLevel()).toBe("essential-traffic")
  })
})

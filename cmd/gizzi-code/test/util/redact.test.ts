import { describe, expect, test } from "bun:test"
import { redactSecrets } from "../../src/shared/util/redact"

describe("redactSecrets", () => {
  test("masks Anthropic-style API keys", () => {
    const line = "using key=sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx for request"
    const redacted = redactSecrets(line)
    expect(redacted).not.toContain("AbCdEfGhIjKlMnOpQrStUvWx")
    expect(redacted).toContain("sk-ant")
  })

  test("masks opaque sk- keys", () => {
    const line = "Authorization: Bearer sk-AbCdEfGh1234IjKl5678"
    const redacted = redactSecrets(line)
    expect(redacted).not.toContain("AbCdEfGh1234IjKl5678")
  })

  test("masks JWTs", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c"
    const redacted = redactSecrets(`token=${jwt}`)
    expect(redacted).not.toContain(jwt)
    expect(redacted).toContain("token=<redacted>")
  })

  test("masks secret-bearing key=value pairs", () => {
    const line =
      'req headers authorization="Bearer abcdef1234567890" refresh_token=abcsecret1234 password=hunter2 api_key=sk-abcdefghijklmnop'
    const redacted = redactSecrets(line)
    expect(redacted).not.toContain("abcdef1234567890")
    expect(redacted).not.toContain("abcsecret1234")
    expect(redacted).not.toContain("hunter2")
    expect(redacted).toContain("password=<redacted>")
  })

  test("keeps booleans and numbers after secret-like keys", () => {
    const line = "has_token=true retry_count=3 token_count=12"
    expect(redactSecrets(line)).toBe(line)
  })

  test("leaves ordinary text untouched", () => {
    const line = "INFO service=auth method=login profile=work status=ok"
    expect(redactSecrets(line)).toBe(line)
  })

  test("is stable under repeated application", () => {
    const line = "accessToken=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV"
    const once = redactSecrets(line)
    expect(redactSecrets(once)).toBe(once)
  })
})

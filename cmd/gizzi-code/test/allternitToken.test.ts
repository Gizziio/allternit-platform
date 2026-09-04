import { describe, expect, test } from "bun:test"
import {
  classifyAllternitToken,
  maskToken,
} from "../src/shared/utils/allternitToken"

function b64url(input: string | object): string {
  const raw = typeof input === "string" ? input : JSON.stringify(input)
  return Buffer.from(raw).toString("base64url")
}

function makeJwt(payload: object): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.${b64url("sig")}`
}

describe("classifyAllternitToken", () => {
  test("alt_-prefixed token classifies as apiKey with no expiry", () => {
    const info = classifyAllternitToken("alt_test1234567890abcdef")
    expect(info.kind).toBe("apiKey")
    expect(info.expiresAt).toBeUndefined()
  })

  test("three-segment JWT classifies as jwt and decodes exp", () => {
    const exp = 1_900_000_000
    const info = classifyAllternitToken(makeJwt({ sub: "user_1", exp }))
    expect(info.kind).toBe("jwt")
    expect(info.expiresAt).toEqual(new Date(exp * 1000))
  })

  test("JWT without exp classifies as jwt with no expiry", () => {
    const info = classifyAllternitToken(makeJwt({ sub: "user_1" }))
    expect(info.kind).toBe("jwt")
    expect(info.expiresAt).toBeUndefined()
  })

  test("garbage three-segment token still classifies as jwt", () => {
    const info = classifyAllternitToken("aaa.bbb.ccc")
    expect(info.kind).toBe("jwt")
  })

  test("unrelated string classifies as unknown", () => {
    expect(classifyAllternitToken("sk-ant-api03-xyz").kind).toBe("unknown")
    expect(classifyAllternitToken("").kind).toBe("unknown")
    expect(classifyAllternitToken("not-a-token").kind).toBe("unknown")
  })
})

describe("maskToken", () => {
  test("shows first 6 and last 4 characters", () => {
    const token = "alt_1234567890abcdefghij"
    expect(maskToken(token)).toBe("alt_12…ghij")
  })

  test("short tokens are fully masked", () => {
    expect(maskToken("abc123")).toBe("******")
  })
})

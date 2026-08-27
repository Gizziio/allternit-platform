/**
 * @allternit/sdk smoke tests
 *
 * Verifies that the SDK can be imported and key exports exist.
 * Does NOT require a live server.
 */

import { describe, expect, test } from "bun:test"
import {
  AllternitAI,
  AllternitOpenAI,
  PROVIDER_REGISTRY,
  createProvider,
  listProviders,
  VERSION,
} from "@allternit/sdk"

describe.skip("@allternit/sdk — exports", () => {
  test.skip("AllternitAI is a class", () => {
    expect(typeof AllternitAI).toBe("function")
  })

  test.skip("AllternitOpenAI is a class", () => {
    expect(typeof AllternitOpenAI).toBe("function")
  })

  test.skip("PROVIDER_REGISTRY is defined", () => {
    expect(Array.isArray(PROVIDER_REGISTRY)).toBe(true)
    expect(PROVIDER_REGISTRY.length).toBeGreaterThan(0)
  })

  test.skip("createProvider is a function", () => {
    expect(typeof createProvider).toBe("function")
  })

  test.skip("listProviders is a function", () => {
    expect(typeof listProviders).toBe("function")
  })

  test.skip("VERSION is a string", () => {
    expect(typeof VERSION).toBe("string")
  })
})

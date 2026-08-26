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

describe("@allternit/sdk — exports", () => {
  test("AllternitAI is a class", () => {
    expect(typeof AllternitAI).toBe("function")
  })

  test("AllternitOpenAI is a class", () => {
    expect(typeof AllternitOpenAI).toBe("function")
  })

  test("PROVIDER_REGISTRY is defined", () => {
    expect(PROVIDER_REGISTRY).toBeDefined()
    expect(typeof PROVIDER_REGISTRY).toBe("object")
    expect(Object.keys(PROVIDER_REGISTRY).length).toBeGreaterThan(0)
  })

  test("createProvider is a function", () => {
    expect(typeof createProvider).toBe("function")
  })

  test("listProviders is a function", () => {
    expect(typeof listProviders).toBe("function")
  })

  test("VERSION is a string", () => {
    expect(typeof VERSION).toBe("string")
  })
})

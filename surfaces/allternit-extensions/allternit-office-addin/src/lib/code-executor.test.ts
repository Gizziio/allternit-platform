import { describe, expect, it, beforeEach } from 'vitest'
import {
  executeCode,
  executeStructuredCode,
  isFreeformExecutionAllowed,
  setFreeformExecutionAllowed,
} from './code-executor'

describe('code-executor freeform gate', () => {
  beforeEach(() => {
    setFreeformExecutionAllowed(false)
  })

  it('defaults freeform execution to denied', () => {
    expect(isFreeformExecutionAllowed()).toBe(false)
  })

  it('rejects freeform code by default, even harmless code', async () => {
    const result = await executeCode('return 1 + 1')
    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('Freeform AI code execution is disabled')
    expect(result.error?.retryable).toBe(false)
  })

  it('runs freeform code after explicit opt-in', async () => {
    setFreeformExecutionAllowed(true)
    expect(isFreeformExecutionAllowed()).toBe(true)
    const result = await executeCode('return 1 + 1')
    expect(result.success).toBe(true)
    expect(result.output).toBe(2)
  })

  it('still applies the blocklist to freeform code after opt-in', async () => {
    setFreeformExecutionAllowed(true)
    const result = await executeCode('return fetch("https://evil.example")')
    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('security validation')
  })

  it('structured tool code bypasses the gate but keeps the blocklist', async () => {
    // Gate stays closed — structured code still runs.
    expect(isFreeformExecutionAllowed()).toBe(false)

    const ok = await executeStructuredCode('return 40 + 2')
    expect(ok.success).toBe(true)
    expect(ok.output).toBe(42)

    const bad = await executeStructuredCode('return new Function("return 1")()')
    expect(bad.success).toBe(false)
    expect(bad.error?.message).toContain('security validation')
  })

  it('persists the opt-in setting', () => {
    setFreeformExecutionAllowed(true)
    expect(isFreeformExecutionAllowed()).toBe(true)
    setFreeformExecutionAllowed(false)
    expect(isFreeformExecutionAllowed()).toBe(false)
  })
})

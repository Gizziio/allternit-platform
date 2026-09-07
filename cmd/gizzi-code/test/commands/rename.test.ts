import { describe, expect, test } from 'bun:test'
import { call } from '../../src/cli/ui/ink-app/commands/rename/rename.ts'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../src/cli/ui/ink-app/types/command.ts'

// Empty message list: generateSessionName() returns null before any API
// call, so the auto-title branch is observable via its "Could not generate"
// message without network access.
function makeContext(): LocalJSXCommandContext {
  return {
    messages: [],
    abortController: new AbortController(),
    getAppState: () => ({}),
    setAppState: () => {},
  } as never
}

describe('/rename --auto', () => {
  test('--auto forces the auto-title branch like empty args', async () => {
    const results: Array<string | undefined> = []
    const onDone: LocalJSXCommandOnDone = (result, options) => {
      expect(options?.display).toBe('system')
      results.push(result)
    }

    await call(onDone, makeContext(), '--auto')

    expect(results).toHaveLength(1)
    // Routed to generateSessionName (auto branch), not treated as the
    // literal name "--auto".
    expect(results[0]).toContain('Could not generate a name')
    expect(results[0]).not.toContain('Session renamed to: --auto')
  })

  test('empty args take the same auto-title branch', async () => {
    const results: Array<string | undefined> = []
    const onDone: LocalJSXCommandOnDone = result => results.push(result)

    await call(onDone, makeContext(), '   ')

    expect(results).toHaveLength(1)
    expect(results[0]).toContain('Could not generate a name')
  })
})

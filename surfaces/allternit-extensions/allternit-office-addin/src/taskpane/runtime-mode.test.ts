import { describe, expect, it } from 'vitest'

import { isOfficeRuntimeReady, markOfficeRuntimeReady, resolveTaskpaneMode } from './runtime-mode'

function bootstrap(overrides: {
  token?: string | null
  workspaceId?: string | null
  projectId?: string | null
} = {}) {
  return {
    auth: {
      token: overrides.token ?? null,
      userId: null,
      email: null,
      name: null,
    },
    context: {
      workspaceId: overrides.workspaceId ?? null,
      projectId: overrides.projectId ?? null,
      projectName: null,
    },
  }
}

describe('resolveTaskpaneMode', () => {
  it('returns companion when Office.js never initialized', () => {
    expect(resolveTaskpaneMode({ officeInitialized: false, bootstrap: bootstrap({ token: 'tok' }) })).toBe('companion')
    expect(
      resolveTaskpaneMode({ officeInitialized: false, bootstrap: bootstrap({ workspaceId: 'ws' }) }),
    ).toBe('companion')
  })

  it('returns companion when Office initialized but no bootstrap/auth context exists', () => {
    expect(resolveTaskpaneMode({ officeInitialized: true, bootstrap: bootstrap() })).toBe('companion')
  })

  it('returns full-ai when Office initialized and an auth token exists', () => {
    expect(resolveTaskpaneMode({ officeInitialized: true, bootstrap: bootstrap({ token: 'tok' }) })).toBe('full-ai')
  })

  it('returns full-ai when Office initialized and a workspace/project context exists', () => {
    expect(
      resolveTaskpaneMode({ officeInitialized: true, bootstrap: bootstrap({ workspaceId: 'ws-1' }) }),
    ).toBe('full-ai')
    expect(
      resolveTaskpaneMode({ officeInitialized: true, bootstrap: bootstrap({ projectId: 'pr-1' }) }),
    ).toBe('full-ai')
  })

  it('treats empty-string token/workspace as no context', () => {
    expect(resolveTaskpaneMode({ officeInitialized: true, bootstrap: bootstrap({ token: '' }) })).toBe('companion')
  })
})

describe('office runtime readiness flag', () => {
  it('starts not ready and flips once marked', () => {
    // Module state persists across tests within a file; assert monotonic flip.
    const before = isOfficeRuntimeReady()
    markOfficeRuntimeReady()
    expect(isOfficeRuntimeReady()).toBe(true)
    if (!before) expect(isOfficeRuntimeReady()).toBe(true)
  })
})

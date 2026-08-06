import { describe, expect, it, beforeEach } from 'vitest'
import {
  __resetOfficeBindingStoreForTests,
  createLocalBindingStore,
  createOfficeBinding,
  createOfficeRuntimeSession,
  ensureOfficeBinding,
  officeBindingSchema,
  officeRuntimeSessionSchema,
} from './office-binding'

const baseInput = {
  userId: 'user-1',
  officeHost: 'excel' as const,
  documentExternalId: 'doc-ext-123',
  workspaceId: 'ws-1',
}

describe('office-binding schema', () => {
  beforeEach(() => {
    __resetOfficeBindingStoreForTests()
  })

  it('creates a valid binding with defaults', () => {
    const binding = createOfficeBinding(baseInput)
    expect(binding.bindingId).toBeTruthy()
    expect(binding.organizationId).toBeNull()
    expect(binding.projectId).toBeNull()
    expect(binding.activeSessionId).toBeNull()
    expect(() => officeBindingSchema.parse(binding)).not.toThrow()
  })

  it('rejects an invalid host', () => {
    expect(() =>
      createOfficeBinding({ ...baseInput, officeHost: 'outlook' as never }),
    ).toThrow()
  })

  it('creates a valid runtime session linked to a binding', () => {
    const binding = createOfficeBinding(baseInput)
    const session = createOfficeRuntimeSession({ bindingId: binding.bindingId })
    expect(session.bindingId).toBe(binding.bindingId)
    expect(session.timeline).toEqual([])
    expect(session.artifactIds).toEqual([])
    expect(session.pendingApprovals).toEqual([])
    expect(() => officeRuntimeSessionSchema.parse(session)).not.toThrow()
  })

  it('session schema validates timeline events', () => {
    const session = createOfficeRuntimeSession({ bindingId: 'b1' })
    const withEvents = officeRuntimeSessionSchema.parse({
      ...session,
      timeline: [{ at: new Date().toISOString(), type: 'tool', summary: 'excel_read_range' }],
    })
    expect(withEvents.timeline).toHaveLength(1)
  })
})

describe('local binding store', () => {
  beforeEach(() => {
    __resetOfficeBindingStoreForTests()
  })

  it('ensureOfficeBinding returns a stable binding across calls', () => {
    const store = createLocalBindingStore()
    const first = ensureOfficeBinding(store, baseInput)
    const second = ensureOfficeBinding(store, baseInput)
    expect(second.bindingId).toBe(first.bindingId)
  })

  it('separates bindings by host and document', () => {
    const store = createLocalBindingStore()
    const excel = ensureOfficeBinding(store, baseInput)
    const word = ensureOfficeBinding(store, { ...baseInput, officeHost: 'word' })
    const otherDoc = ensureOfficeBinding(store, { ...baseInput, documentExternalId: 'doc-ext-999' })
    expect(new Set([excel.bindingId, word.bindingId, otherDoc.bindingId]).size).toBe(3)
  })

  it('upsert refreshes updatedAt and get round-trips', () => {
    const store = createLocalBindingStore()
    const created = ensureOfficeBinding(store, baseInput)
    const fetched = store.get('excel', 'doc-ext-123')
    expect(fetched?.bindingId).toBe(created.bindingId)
    expect(store.get('word', 'doc-ext-123')).toBeNull()
  })
})

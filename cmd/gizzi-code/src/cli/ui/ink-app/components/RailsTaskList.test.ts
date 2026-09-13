import { describe, expect, test } from 'bun:test'
import {
  actionableKindFor,
  clampSelectionIndex,
} from './RailsTaskList.js'

describe('actionableKindFor', () => {
  const me = 'gizzi-session-1'

  test('READY nodes are take-able regardless of assignee', () => {
    expect(actionableKindFor('READY', null, me)).toBe('take')
    expect(actionableKindFor('READY', 'someone-else', me)).toBe('take')
  })

  test('READY matches case-insensitively', () => {
    expect(actionableKindFor('ready', null, me)).toBe('take')
  })

  test('RUNNING nodes owned by this peer are done-able', () => {
    expect(actionableKindFor('RUNNING', me, me)).toBe('done')
    expect(actionableKindFor('running', me, me)).toBe('done')
  })

  test('RUNNING nodes owned by another agent are not actionable', () => {
    expect(actionableKindFor('RUNNING', 'other-agent', me)).toBeNull()
  })

  test('RUNNING nodes are not actionable without an agent id', () => {
    expect(actionableKindFor('RUNNING', null, null)).toBeNull()
  })

  test('other statuses are not actionable', () => {
    expect(actionableKindFor('NEW', null, me)).toBeNull()
    expect(actionableKindFor('DONE', null, me)).toBeNull()
    expect(actionableKindFor('FAILED', null, me)).toBeNull()
    expect(actionableKindFor('BLOCKED', null, me)).toBeNull()
  })
})

describe('clampSelectionIndex', () => {
  test('returns -1 when there is nothing to select', () => {
    expect(clampSelectionIndex(0, 0)).toBe(-1)
    expect(clampSelectionIndex(5, 0)).toBe(-1)
    expect(clampSelectionIndex(-3, 0)).toBe(-1)
  })

  test('clamps into range', () => {
    expect(clampSelectionIndex(0, 3)).toBe(0)
    expect(clampSelectionIndex(2, 3)).toBe(2)
    expect(clampSelectionIndex(3, 3)).toBe(2)
    expect(clampSelectionIndex(99, 3)).toBe(2)
    expect(clampSelectionIndex(-1, 3)).toBe(0)
  })

  test('simulates j/k movement staying in bounds', () => {
    let index = 0
    const count = 2
    index = clampSelectionIndex(index + 1, count) // j
    expect(index).toBe(1)
    index = clampSelectionIndex(index + 1, count) // j at bottom stays
    expect(index).toBe(1)
    index = clampSelectionIndex(index - 1, count) // k
    expect(index).toBe(0)
    index = clampSelectionIndex(index - 1, count) // k at top stays
    expect(index).toBe(0)
  })
})

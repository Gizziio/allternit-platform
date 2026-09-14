import { describe, expect, test } from 'bun:test'
import {
  actionableKindFor,
  clampSelectionIndex,
  closeEvidenceFor,
  reparentCandidates,
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

describe('closeEvidenceFor', () => {
  test('DONE maps to a closed evidence line', () => {
    expect(closeEvidenceFor('DONE', 'gizzi-session-1')).toBe(
      'closed from gizzi-code todo panel by gizzi-session-1',
    )
  })

  test('FAILED (x key) maps to a failed evidence line', () => {
    expect(closeEvidenceFor('FAILED', 'gizzi-session-1')).toBe(
      'failed from gizzi-code todo panel by gizzi-session-1',
    )
  })

  test('unknown agent falls back to a literal', () => {
    expect(closeEvidenceFor('FAILED', null)).toBe(
      'failed from gizzi-code todo panel by unknown',
    )
    expect(closeEvidenceFor('DONE', null)).toBe(
      'closed from gizzi-code todo panel by unknown',
    )
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

describe('reparentCandidates', () => {
  // Minimal node literals — the helper is generic over { node_id,
  // parent_node_id } so tests don't need full DagNodeDto shapes.
  const node = (node_id: string, parent_node_id: string | null) => ({
    node_id,
    parent_node_id,
  })

  test('excludes the node itself', () => {
    const nodes = [node('a', null), node('b', null), node('c', 'b')]
    expect(reparentCandidates(nodes, 'a').map(n => n.node_id)).toEqual(['b', 'c'])
  })

  test('excludes direct children', () => {
    const nodes = [node('a', null), node('b', 'a'), node('c', null)]
    expect(reparentCandidates(nodes, 'a').map(n => n.node_id)).toEqual(['c'])
  })

  test('a parent with only children has no candidates but the root entry', () => {
    const nodes = [node('a', null), node('b', 'a')]
    expect(reparentCandidates(nodes, 'a')).toEqual([])
  })

  test('excludes deeper descendants (grandchildren)', () => {
    const nodes = [
      node('a', null),
      node('b', 'a'),
      node('c', 'b'),
      node('d', null),
    ]
    expect(reparentCandidates(nodes, 'a').map(n => n.node_id)).toEqual(['d'])
  })

  test('keeps parent, siblings, and unrelated branches as candidates', () => {
    const nodes = [
      node('root', null),
      node('me', 'root'),
      node('child', 'me'),
      node('sibling', 'root'),
      node('other-branch', null),
    ]
    expect(reparentCandidates(nodes, 'me').map(n => n.node_id)).toEqual([
      'root',
      'sibling',
      'other-branch',
    ])
  })

  test('returns empty for a single-node dag (root entry is component-side)', () => {
    expect(reparentCandidates([node('only', null)], 'only')).toEqual([])
  })

  test('null parent links do not break descendant walking', () => {
    const nodes = [node('a', null), node('b', null), node('c', 'b')]
    expect(reparentCandidates(nodes, 'b').map(n => n.node_id)).toEqual(['a'])
  })

  test('tolerates a node id that is not in the list', () => {
    const nodes = [node('a', null), node('b', 'a')]
    expect(reparentCandidates(nodes, 'missing').map(n => n.node_id)).toEqual([
      'a',
      'b',
    ])
  })
})

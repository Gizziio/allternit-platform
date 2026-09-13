import { describe, expect, test } from 'bun:test'
import { parsePlanTodos } from './railsPlan.js'

describe('parsePlanTodos', () => {
  test('parses checkbox todos with done flags', () => {
    const plan = `# Ship it
- [ ] write code
- [x] write tests
- [ ] docs
`
    const { title, todos } = parsePlanTodos(plan)
    expect(title).toBe('Ship it')
    expect(todos).toEqual([
      { title: 'write code', depth: 0, done: false },
      { title: 'write tests', depth: 0, done: true },
      { title: 'docs', depth: 0, done: false },
    ])
  })

  test('accepts `*` bullets and uppercase X', () => {
    const plan = `## Goals
* [X] first
* [ ] second
`
    const { todos } = parsePlanTodos(plan)
    expect(todos).toEqual([
      { title: 'first', depth: 0, done: true },
      { title: 'second', depth: 0, done: false },
    ])
  })

  test('computes depth from 2-space indentation steps and caps at 3', () => {
    const plan = `# Plan
- [ ] top
  - [ ] depth1
    - [ ] depth2
      - [ ] depth3
        - [ ] deeper still depth3
          - [ ] deepest depth3
`
    const { todos } = parsePlanTodos(plan)
    expect(todos.map(t => t.depth)).toEqual([0, 1, 2, 3, 3, 3])
  })

  test('treats non-checkbox bullets as todos with done=false', () => {
    const plan = `# Plan
- just a bullet
- [x] checked
`
    const { todos } = parsePlanTodos(plan)
    expect(todos).toEqual([
      { title: 'just a bullet', depth: 0, done: false },
      { title: 'checked', depth: 0, done: true },
    ])
  })

  test('uses first ## heading as title and strips markdown', () => {
    const plan = `Some intro prose.

## **Bold** plan title
### a deeper heading
- [x] todo
`
    const { title, todos } = parsePlanTodos(plan)
    expect(title).toBe('Bold plan title')
    expect(todos).toHaveLength(1)
  })

  test('falls back to first non-empty line when no heading exists', () => {
    const { title } = parsePlanTodos('\n\njust prose first\n- [ ] a\n')
    expect(title).toBe('just prose first')
  })

  test('falls back to literal "plan" for empty input', () => {
    const { title, todos } = parsePlanTodos('   \n\n')
    expect(title).toBe('plan')
    expect(todos).toEqual([])
  })

  test('ignores code fences entirely', () => {
    const plan = `# Plan
\`\`\`bash
- [ ] not a todo
# not a heading
\`\`\`
- [ ] real todo
\`\`\`
trailing fence flip
\`\`\`
- [ ] after fences
`
    const { title, todos } = parsePlanTodos(plan)
    expect(title).toBe('Plan')
    expect(todos).toEqual([
      { title: 'real todo', depth: 0, done: false },
      { title: 'after fences', depth: 0, done: false },
    ])
  })

  test('ignores prose and deeper headings, keeps bullets under any heading', () => {
    const plan = `# Title
intro prose line
## Section A
- [ ] a1
prose between bullets
- a2 plain
### Section B
- [ ] b1
`
    const { title, todos } = parsePlanTodos(plan)
    expect(title).toBe('Title')
    expect(todos).toEqual([
      { title: 'a1', depth: 0, done: false },
      { title: 'a2 plain', depth: 0, done: false },
      { title: 'b1', depth: 0, done: false },
    ])
  })
})

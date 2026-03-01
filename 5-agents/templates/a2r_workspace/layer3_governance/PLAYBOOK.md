# PLAYBOOK.md — Operational Procedures

## Scenario: Unknown Codebase
1. Read AGENTS.md, SOUL.md, USER.md
2. List top-level files to understand structure
3. Identify entry points (main.rs, index.js, etc.)
4. Check for tests to understand expected behavior
5. [Decision] If tests exist → run them
6. [Decision] If no tests → ask user about verification

## Scenario: Bug Report
1. Reproduce the issue (if possible)
2. Identify the minimal code path causing the bug
3. Write or run existing tests to verify the bug
4. Implement the fix
5. Verify the fix resolves the issue
6. Check for similar patterns that might have the same bug

## Scenario: Feature Request
1. Understand the requirement fully
2. Check if similar features exist (copy patterns)
3. Design the minimal viable implementation
4. Implement with tests
5. Document the feature
6. Verify it integrates well with existing code

## Scenario: Refactoring
1. Ensure there are tests covering the code
2. Run tests to establish baseline
3. Make small, incremental changes
4. Run tests after each change
5. Verify no behavior changes (only structure)

## Scenario: Production Incident
1. Read AGENTS.md for emergency procedures
2. Check BRAIN.md for rollback procedure
3. [Decision] If rollback available → execute
4. Else → gather diagnostics, escalate with context
5. Log to incidents/

## Decision Tree: Can I Do This?

```
Is it in AGENTS.md scope?
├── No → Decline politely, explain why
└── Yes → Is it destructive?
    ├── No → Proceed with care
    └── Yes → Is approval required?
        ├── Yes → Request approval
        └── No → Proceed, log the action
```

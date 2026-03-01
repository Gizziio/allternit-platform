# UI Storybook Contract

This document defines the contract between UI development and the DAG evidence system.

## Required Storybook Structure

```
src/components/
├── ComponentName/
│   ├── index.tsx              # Main component export
│   ├── ComponentName.tsx      # Component implementation
│   ├── ComponentName.types.ts # TypeScript types (UI_ARCHITECT)
│   ├── ComponentName.test.tsx # Tests (UI_TESTER)
│   ├── ComponentName.stories.tsx # Stories (UI_IMPLEMENTER)
│   └── styles.css             # Styles (optional)
```

## Story Requirements

Every component MUST have stories for:

1. **Default/Default** - Basic usage
2. **Variants** - All visual variants
3. **Sizes** - All size options (if applicable)
4. **States** - Loading, disabled, error states
5. **Accessibility** - Keyboard navigation, screen reader

## Evidence Emission

Stories automatically emit evidence to WIH:

```yaml
evidence_types:
  - INTERACTION_TEST    # From play() functions
  - VISUAL_SNAPSHOT     # From story renders
  - A11Y_SCAN          # From a11y addon
  - CODE_COVERAGE      # From test coverage
```

## CI Enforcement

Missing stories = **HARD FAIL**
Failed Storybook tests = **HARD FAIL**
A11y violations = **HARD FAIL**

## Role Boundaries

| Role | Can Create | Can Modify | Can Review |
|------|-----------|------------|------------|
| UI_ARCHITECT | .types.ts, .schema.ts | APIs, contracts | All |
| UI_IMPLEMENTER | .tsx, .stories.tsx | Implementation | Own code |
| UI_TESTER | .test.tsx | Tests | All code |
| UI_REVIEWER | Comments only | Nothing | All |

## Acceptance Criteria

Before a component is considered complete:

- [ ] Stories exist for all variants
- [ ] Interaction tests pass
- [ ] A11y tests pass
- [ ] Visual regression tests pass
- [ ] UI_REVIEWER has approved
- [ ] Evidence emitted to WIH

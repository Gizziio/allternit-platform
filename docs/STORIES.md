# UI STORIES CONTRACT

**Status:** 🔴 REQUIRED FOR ALL UI CHANGES  
**Enforcement:** Hard fail in CI if missing  
**Location:** `/ui/STORIES.md`

---

## Purpose

This document defines the **mandatory Storybook coverage requirements** for all UI components.

**Any UI change without Storybook coverage is REJECTED.**

---

## Required Story States

Every component MUST have stories covering these states:

### 1. Default State
```typescript
export const Default = {
  args: {
    // Default props
  },
};
```

### 2. Loading State
```typescript
export const Loading = {
  args: {
    isLoading: true,
  },
};
```

### 3. Error State
```typescript
export const Error = {
  args: {
    error: new Error('Failed to load'),
  },
};
```

### 4. Empty State
```typescript
export const Empty = {
  args: {
    items: [],
  },
};
```

### 5. Overflow State (for lists/tables)
```typescript
export const Overflow = {
  args: {
    items: Array(100).fill(null).map((_, i) => ({ id: i, name: `Item ${i}` })),
  },
};
```

### 6. Accessibility State
```typescript
export const WithA11y = {
  args: {
    // Component with proper ARIA labels
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
};
```

---

## Story Naming Convention

```typescript
// Format: ComponentName--StoryName.stories.tsx

// Good:
Button--Primary.stories.tsx
Button--Secondary.stories.tsx
Button--Loading.stories.tsx

// Bad:
button.stories.tsx  // Too vague
Button.stories.tsx  // Missing story name
```

---

## Required Metadata

Every story file MUST include:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',  // Component path
  component: Button,
  parameters: {
    layout: 'centered',  // or 'fullscreen'
    docs: {
      description: {
        component: 'Button component for user actions.',
      },
    },
  },
  // Required arg types
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Stories below...
```

---

## Interaction Tests

Every interactive component MUST have interaction tests:

```typescript
import { userEvent, within } from '@storybook/test';
import { expect, fn } from '@storybook/test';

export const WithInteraction = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const onClick = fn();
    
    await step('Click button', async () => {
      const button = canvas.getByRole('button');
      await userEvent.click(button);
      expect(onClick).toHaveBeenCalled();
    });
  },
};
```

---

## Visual Regression Baseline

Every story serves as a visual regression baseline.

**Requirements:**
- Deterministic data (no random values, dates, or API calls)
- Fixed viewport sizes
- Consistent fonts loaded

```typescript
export const Deterministic = {
  args: {
    // Use fixed data, not dynamic
    items: [
      { id: 1, name: 'Fixed Item 1' },
      { id: 2, name: 'Fixed Item 2' },
    ],
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};
```

---

## Documentation Requirements

### Component Documentation

```typescript
const meta = {
  // ...
  parameters: {
    docs: {
      description: {
        component: `
## Usage

\`\`\`tsx
import { Button } from './Button';

<Button variant="primary">Click Me</Button>
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'primary' \\| 'secondary' | 'primary' | Button variant |
| size | 'sm' \\| 'md' \\| 'lg' | 'md' | Button size |
| disabled | boolean | false | Disable button |
        `,
      },
    },
  },
} satisfies Meta<typeof Button>;
```

---

## CI Enforcement

### Hard Fail Conditions

CI will **REJECT** any PR where:

1. **Stories Missing**
   - Component added without stories
   - New variant without story

2. **Required States Missing**
   - No Loading state
   - No Error state
   - No Empty state (for lists)

3. **Storybook Build Fails**
   - TypeScript errors in stories
   - Missing imports
   - Invalid arg types

4. **Interaction Tests Fail**
   - Click handlers not called
   - Expected events not fired

5. **Visual Regressions**
   - Unapproved visual changes
   - Accessibility violations

### CI Configuration

```yaml
# .github/workflows/storybook.yml
name: Storybook

on: [push, pull_request]

jobs:
  storybook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Storybook
        run: npm run build:storybook
        # Hard fail if build fails
      
      - name: Run interaction tests
        run: npm run test:storybook
        # Hard fail if tests fail
      
      - name: Visual regression
        uses: chromaui/action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          exitZeroOnChanges: true
          exitOnceUploaded: true
```

---

## Evidence Artifacts

After CI passes, the following artifacts are emitted:

### 1. Build Artifact
```
/artifacts/storybook-static/
  ├── index.html
  ├── iframe.html
  └── [static assets]
```

### 2. Test Results
```
/artifacts/storybook-test-results/
  ├── test-results.json
  └── screenshots/
```

### 3. Visual Baseline
```
/artifacts/storybook-baseline/
  ├── [component-stories].png
```

### 4. Evidence Receipt
```json
{
  "type": "ui:evidence",
  "timestamp": "2026-02-21T12:00:00Z",
  "wih_id": "wih_123",
  "dag_node_id": "node_456",
  "evidence": {
    "storybook_build": "success",
    "interaction_tests": "passed",
    "visual_regression": "approved",
    "accessibility": "passed",
    "stories_count": 12,
    "components_covered": ["Button", "Input", "Card"]
  }
}
```

---

## Exceptions

### When Stories Are NOT Required

1. **Internal Components**
   - Components used only within a single file
   - Mark with `@internal` JSDoc comment

2. **Deprecated Components**
   - Components scheduled for removal
   - Mark with `@deprecated` JSDoc comment

3. **Wrapper Components**
   - Pure pass-through components
   - No additional logic or styling

### Exception Process

To request an exception:

1. Add JSDoc comment to component:
```typescript
/**
 * @internal This component is only used internally.
 * @exception No Storybook coverage required.
 */
export function InternalComponent() { ... }
```

2. Document exception in PR description
3. Get approval from UI lead

---

## Enforcement

**This contract is ENFORCED by:**

1. **CI Pipeline** - Hard fail on missing stories
2. **PR Review** - Manual review of story coverage
3. **Harness Validation** - Automated contract validation

**Violations result in:**
- PR rejection
- Required remediation
- Potential team notification

---

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook Test Addon](https://storybook.js.org/addons/@storybook/test)
- [Chromatic Visual Testing](https://www.chromatic.com/)
- [A11y Testing](https://storybook.js.org/addons/@storybook/addon-a11y)

---

**End of Contract**

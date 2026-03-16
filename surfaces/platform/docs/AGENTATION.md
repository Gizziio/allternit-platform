# Agentation for A2R

**Status:** ✅ IMPLEMENTED (DEV-ONLY)  
**License:** PolyForm Shield 1.0.0 (forked from benjitaylor/agentation)  
**Source:** https://github.com/benjitaylor/agentation

---

## What is Agentation?

Agentation is a **visual annotation overlay** for UI development that lets you:

1. **Click any UI element** to select it
2. **Add notes** describing desired changes
3. **Get structured output** with selectors + context
4. **Copy/paste** instructions for A2R coding agents

**DEV-ONLY:** This tool is never included in production builds.

---

## Quick Start

### 1. Enable Agentation

Agentation is automatically enabled in development mode.

```bash
# In a2r-platform directory
npm run dev
```

### 2. Toggle Agentation

- Click the 🎨 button (top-right corner)
- Or press `A` key (when not in input field)

### 3. Annotate an Element

1. Click **🎯 Select** button
2. Click the element you want to annotate
3. Add your notes in the panel
4. Click **💾 Save & Copy**

### 4. Send to A2R Agent

The formatted output is automatically copied to clipboard. Paste into your A2R coding agent (e.g., UI_IMPLEMENTER).

---

## Features

### Visual Selection
- Click any element to annotate
- Bounding box highlight
- ESC to cancel selection

### Automatic Selectors
- ID selectors
- Class selectors
- Tag selectors
- Data attribute selectors
- XPath generation

### Notes Editor
- Rich text support
- Keyboard shortcuts (Cmd+Enter to save)
- Character count

### Annotation Management
- View all annotations
- Copy individual annotations
- Copy all annotations at once
- Delete annotations

### A2R Integration
- Formatted output for A2R agents
- Execution context header
- Verification commands included

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `A` | Toggle Agentation |
| `ESC` | Cancel selection / Close panel |
| `Cmd/Ctrl + Enter` | Save annotation |

---

## Output Format

Agentation produces A2R-formatted output:

```markdown
# A2R UI Annotation → Agent Instructions

## Execution Context
| Field | Value |
|-------|-------|
| **UI Surface** | primitives |
| **Story** | Button/Primary |
| **Component** | components/Button |
| **Renderer** | AGENT |
| **Viewport** | 1280x720 (desktop) |

## Acceptance Criteria
Storybook build passes + no visual regressions

---

## Agentation Notes
Change button background color to blue (#3b82f6), increase padding to 16px, and add hover state with darker blue.

## Target Selectors
- `.button-primary`
- `button[data-variant="primary"]`
- `#primary-button`

## Context
Element: <button>
Classes: button button-primary
Text: "Click Me"

---

## Agent Action Required

1. **Locate component** using selectors above
2. **Review notes** for desired changes
3. **Implement changes** in component file
4. **Run Storybook** to verify visual changes
5. **Run interaction tests** to verify functionality
6. **Update snapshot** if visual changes are expected

## Verification Commands

```bash
# Run Storybook for this component
npm run dev -w @repo/storybook

# Run interaction tests
npm run test:interaction -w @repo/storybook

# Build Storybook (production check)
npm run build -w @repo/storybook
```
```

---

## Configuration

Agentation can be configured via Storybook parameters:

```typescript
// .storybook/preview.ts
export default {
  parameters: {
    agentation: {
      enabled: true,           // Enable/disable
      storageKey: 'annotations', // localStorage key
      hotkey: 'a',              // Toggle hotkey
    },
  },
};
```

---

## Storage

Annotations are stored in **localStorage** (dev-only):

- Key: `a2r-agentation-annotations`
- Format: JSON array
- Persistence: Until manually cleared

### Clear All Annotations

```javascript
localStorage.removeItem('a2r-agentation-annotations');
```

---

## Integration with A2R Workflow

### 1. Designer/Developer Workflow

```
1. Open Storybook story
2. Enable Agentation (press 'A')
3. Click element to annotate
4. Add notes describing changes
5. Copy formatted output
6. Paste into A2R agent
```

### 2. A2R Agent Workflow

```
1. Receive annotated instructions
2. Parse selectors and notes
3. Locate component in codebase
4. Implement changes
5. Run Storybook to verify
6. Run tests
7. Submit for review
```

---

## Troubleshooting

### Agentation not appearing
- Check NODE_ENV is not 'production'
- Check browser console for errors
- Try hard refresh (Cmd+Shift+R)

### Can't select elements
- Make sure selection mode is active (🎯 button highlighted)
- Try clicking directly on the element
- Check for overlapping elements

### Selectors not working
- Verify selectors in browser DevTools
- Some elements may need data-testid attributes
- Storybook DOM may differ from app DOM

### Annotations not saving
- Check localStorage is enabled
- Check browser console for errors
- Try clearing localStorage and retrying

---

## Best Practices

### DO
- ✅ Be specific in your notes
- ✅ Include expected behavior
- ✅ Mention edge cases
- ✅ Reference design tokens when applicable
- ✅ Test with interaction tests after changes

### DON'T
- ❌ Annotate multiple elements at once (one annotation per change)
- ❌ Use vague descriptions ("make it better")
- ❌ Forget to run tests after implementing
- ❌ Annotate in production (Agentation is dev-only)

---

## API Reference

### useAgentation Hook

```typescript
import { useAgentation } from './dev/agentation';

const {
  isEnabled,
  annotations,
  selectedElement,
  notes,
  setNotes,
  toggleEnabled,
  selectElement,
  clearSelection,
  saveAnnotation,
  deleteAnnotation,
  getOutput,
  clearAll,
} = useAgentation();
```

### formatForA2R Function

```typescript
import { formatForA2R, createDefaultHeader } from './dev/agentation';

const output = {
  notes: 'Change button color',
  selectors: ['.button'],
  context: 'Element: <button>',
};

const header = createDefaultHeader({
  uiSurface: 'primitives',
  storyId: 'Button/Primary',
  renderer: 'AGENT',
});

const formatted = formatForA2R(output, header);
console.log(formatted.formattedForAgent);
```

---

## License

**PolyForm Shield 1.0.0**

Original: https://github.com/benjitaylor/agentation  
Forked and modified for A2R integration.

---

## Resources

- [Original Agentation Repo](https://github.com/benjitaylor/agentation)
- [Storybook Docs](https://storybook.js.org/docs)
- [A2R UI Contracts](./UI_CONTRACTS.md)

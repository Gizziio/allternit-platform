# T1-A2: Component Inventory & Audit

## Agent Role
Component Librarian - Audit & Catalog

## Task
Comprehensively audit all 695 TypeScript/TSX files in the UI platform and create a complete inventory.

## Deliverables

### 1. Scan and Catalog All Components

Scan these directories:
```
6-ui/a2r-platform/src/
├── design/           (~50 files)
├── components/       (~100 files)
├── views/            (~200 files)
├── shell/            (~50 files)
├── nav/              (~30 files)
├── drawers/          (~30 files)
├── hooks/            (~50 files)
├── providers/        (~20 files)
└── lib/              (~165 files)
```

### 2. Create Inventory JSON

Create: `6-ui/a2r-platform/COMPONENT_INVENTORY.json`

```json
{
  "generatedAt": "2026-02-24T...",
  "summary": {
    "totalFiles": 695,
    "totalComponents": 450,
    "totalHooks": 80,
    "totalUtils": 165
  },
  "categories": {
    "design": {
      "count": 50,
      "components": [
        {
          "name": "GlassCard",
          "path": "src/design/GlassCard.tsx",
          "type": "component",
          "props": ["children", "className", "elevation", "hover"],
          "dependencies": ["./shadows", "class-variance-authority"],
          "status": "complete",
          "hasTests": true,
          "hasStory": false,
          "issues": []
        }
      ]
    },
    "components": { /* ... */ },
    "views": { /* ... */ },
    "shell": { /* ... */ },
    "hooks": { /* ... */ }
  }
}
```

### 3. Identify Component Status

For each component, determine status:
- **complete**: Production-ready, fully implemented
- **polish-needed**: Works but needs visual/UX improvements
- **partial**: Some features implemented, others stubbed
- **deprecated**: Should be removed/replaced
- **duplicate**: Similar component exists elsewhere

### 4. Find Gaps and Issues

Create: `6-ui/a2r-platform/COMPONENT_GAPS.md`

List:
- Missing components (e.g., no DatePicker, no Slider)
- Duplicate implementations
- Inconsistent APIs
- Missing TypeScript types
- Components with TODO comments
- Components without tests

### 5. Create Component Matrix

Create a matrix showing:
| Component | Location | Props | Tests | Story | Status |
|-----------|----------|-------|-------|-------|--------|
| Button | design/Button.tsx | 8 | ✅ | ❌ | complete |
| GlassCard | design/GlassCard.tsx | 4 | ✅ | ❌ | polish-needed |

### 6. Identify Unused Components

Find components that are:
- Not imported anywhere
- Only imported in tests
- Imported but never used

### 7. Create Consolidation Recommendations

Recommend:
- Which components to merge
- Which to remove
- Which need priority attention
- Naming conventions to standardize

## Tools

Use these commands to help:
```bash
# Count files
find 6-ui/a2r-platform/src -name "*.tsx" -o -name "*.ts" | wc -l

# Find all exports
find 6-ui/a2r-platform/src -name "*.tsx" -exec grep -l "export" {} \;

# Find TODO comments
grep -r "TODO\|FIXME\|XXX" 6-ui/a2r-platform/src --include="*.tsx" --include="*.ts"

# Find unused exports (using ts-prune if available)
npx ts-prune --project 6-ui/a2r-platform/tsconfig.json
```

## Output Format

Create:
1. `COMPONENT_INVENTORY.json` - Full machine-readable inventory
2. `COMPONENT_GAPS.md` - Human-readable gap analysis
3. `COMPONENT_PRIORITIES.md` - Prioritized list of work needed

## Success Criteria
- [ ] All 695 files catalogued
- [ ] Component status determined for each
- [ ] Gaps documented
- [ ] Priorities established
- [ ] No SYSTEM_LAW violations

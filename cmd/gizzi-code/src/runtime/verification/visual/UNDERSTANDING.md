# Visual Context for Agent Verification

## The Problem

An AI agent reading code cannot "see":
- UI components rendered during tests
- Visual output of the code (HTML, SVG, charts)
- Side-by-side diffs of before/after
- Test coverage heatmaps
- Performance flame graphs
- Error visual states
- CSS/styling issues

## The Solution

Capture **meaningful visual artifacts** that give the agent visual evidence for verification.

## Visual Artifact Types

### 1. **Rendered UI States** (`ui-state`)
Capture what the actual UI looks like during verification:
- Web component renders
- Mobile app screens
- Desktop application states
- CLI output as rendered

### 2. **Visual Diffs** (`visual-diff`)
Side-by-side or overlay comparisons:
- Before/after component renders
- Screenshot comparison for UI tests
- Color/contrast differences
- Layout shift detection

### 3. **Coverage Visualizations** (`coverage-map`)
Heat maps showing what code was tested:
- Line coverage highlighting
- Branch coverage visualization
- Uncovered code marked red

### 4. **Performance Profiles** (`performance-chart`)
Visual performance data:
- Flame graphs of call stacks
- Memory usage charts
- Timing waterfalls

### 5. **Error Visualizations** (`error-state`)
Visual representation of errors:
- Stack trace with code context
- Error boundary fallbacks
- Crash screenshots

### 6. **Structure Diagrams** (`structure-diagram`)
Generated from code analysis:
- Component hierarchy trees
- Dependency graphs
- Data flow diagrams

## Example: Verifying a UI Fix

### Without Visual Context
```
AGENT: Looking at the code, the button should now be red.
Conclusion: VERIFIED

Reality: CSS selector was wrong, button is still blue
```

### With Visual Context
```
AGENT: Looking at code + visual artifact:

[RENDERED UI SCREENSHOT]
┌─────────────────┐
│ [  🟦 Delete  ] │ ← Shows BLUE not RED
└─────────────────┘

Conclusion: REJECT - Visual mismatch detected
```

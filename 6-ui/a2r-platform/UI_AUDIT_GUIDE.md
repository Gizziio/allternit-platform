# A2R Platform UI Audit Guide

**Purpose:** Systematically test and identify all UI issues in the a2rchitech platform

**Last Updated:** 2026-02-24

---

## Quick Start

### Option 1: Playwright (TypeScript/JavaScript)

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform

# Install Playwright
pnpm add -D @playwright/test
pnpm exec playwright install

# Run audit
pnpm exec playwright test tests/ui-audit.spec.ts

# View HTML report
open test-results/html-report/index.html
```

### Option 2: browser-use (Python) - RECOMMENDED

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform

# Install dependencies
pip install browser-use==0.1.40 playwright==1.49.0
playwright install

# Run audit
python scripts/ui-audit-browseruse.py

# Or specify custom URL
python scripts/ui-audit-browseruse.py http://127.0.0.1:5177
```

### Option 3: Shell Script (Automated)

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform

# Run complete audit with setup
bash scripts/run-ui-audit.sh
```

---

## What Gets Tested

### 1. Shell Layout
- Main frame rendering
- Navigation rail items
- Canvas/content area
- Rail collapse/expand functionality

### 2. Chat View
- Conversation rendering
- Message input functionality
- AI Elements components
- Welcome screen
- Message streaming

### 3. Workspace View
- Cowork components
- Project list
- File navigation

### 4. Code View
- Code editor rendering
- Console drawer
- Terminal integration

### 5. Agent System View
- Plan tab
- Work tab
- Status tab
- Mail tab
- Tools tab
- Audit tab

### 6. Console Drawer
- Drawer expansion/collapse
- Queue tab
- Terminal tab
- Logs tab
- Context tab

### 7. UI Components
- Buttons (rendering, states)
- Icons (SVG rendering)
- Text (overflow, styling)
- Forms/Inputs
- Modals/Dialogs
- Tooltips
- Dropdowns

### 8. Responsive Layout
- Desktop (1920x1080)
- Tablet (1024x768)
- Mobile (375x667)

### 9. Performance
- Initial load time (< 10s)
- Memory growth (< 50MB)
- First contentful paint (< 3s)
- Time to interactive (< 5s)

### 10. Error Handling
- API error handling
- Error boundaries
- Uncaught exceptions

### 11. Accessibility
- ARIA labels
- Heading hierarchy
- Keyboard navigation
- Focus indicators
- Alt text for images

---

## Output Files

### Test Results
```
test-results/
├── screenshots/           # Visual screenshots
│   ├── shell-layout.png
│   ├── chat-view.png
│   ├── workspace-view.png
│   ├── code-view.png
│   ├── agent-system-view.png
│   ├── desktop-1920x1080.png
│   ├── tablet-1024x768.png
│   └── mobile-375x667.png
├── html-report/           # Interactive HTML report
│   └── index.html
├── ui-audit-report.json   # JSON report
├── ui-audit-summary.md    # Markdown summary
├── test-results.json      # Raw test results
└── junit.xml              # JUnit XML for CI
```

---

## Understanding the Results

### Issue Priorities

- 🔴 **CRITICAL**: App crashes, data loss, security issues
- 🟠 **HIGH**: Major feature broken, significant UX issues
- 🟡 **MEDIUM**: Minor bugs, visual glitches, performance issues
- 🟢 **LOW**: Nice to have, polish, enhancements

### Common Issues to Look For

#### Rendering Issues
- Components not displaying
- Incorrect styling/CSS
- Missing icons or images
- Text overflow
- Layout breaks

#### Functional Issues
- Buttons not clickable
- Forms not submitting
- Navigation not working
- State not updating
- API calls failing

#### Performance Issues
- Slow initial load
- Janky animations
- Memory leaks
- Excessive re-renders

#### Accessibility Issues
- Missing ARIA labels
- Poor color contrast
- Keyboard traps
- Missing focus indicators

---

## Fixing Issues

### Step 1: Categorize

Add issues to `UI_ISSUES_TRACKER.md` with:
- Issue ID (e.g., CH-001 for Chat issues)
- Priority
- Component name
- File path
- Description
- Steps to reproduce
- Expected vs actual behavior
- Screenshot path

### Step 2: Prioritize

Focus on:
1. CRITICAL issues first
2. HIGH priority user-facing issues
3. MEDIUM priority visual/UX issues
4. LOW priority polish items

### Step 3: Fix

For each issue:
1. Create a branch
2. Fix the issue
3. Test the fix
4. Update the tracker
5. Commit with clear message

### Step 4: Verify

Re-run the audit to confirm:
- Issue is resolved
- No regressions introduced
- Screenshots look correct

---

## Component Inventory

### Core Shell Components

| Component | File | Status |
|-----------|------|--------|
| ShellApp | `src/shell/ShellApp.tsx` | ⚠️ Needs testing |
| ShellFrame | `src/shell/ShellFrame.tsx` | ⚠️ Needs testing |
| ShellRail | `src/shell/ShellRail.tsx` | ⚠️ Needs testing |
| ShellCanvas | `src/shell/ShellCanvas.tsx` | ⚠️ Needs testing |
| ShellHeader | `src/shell/ShellHeader.tsx` | ⚠️ Needs testing |
| ShellOverlayLayer | `src/shell/ShellOverlayLayer.tsx` | ⚠️ Needs testing |

### AI Elements Components

| Component | File | Known Issues |
|-----------|------|--------------|
| Conversation | `components/ai-elements/conversation.tsx` | TypeScript errors |
| Message | `components/ai-elements/message.tsx` | TypeScript errors |
| PromptInput | `components/ai-elements/prompt-input.tsx` | 8 TypeScript errors |
| Reasoning | `components/ai-elements/reasoning.tsx` | - |
| Tool | `components/ai-elements/tool.tsx` | - |
| Sources | `components/ai-elements/sources.tsx` | - |
| CodeBlock | `components/ai-elements/code-block.tsx` | 1 TypeScript error |
| Markdown | `components/ai-elements/markdown.tsx` | Fixed |
| Attachments | `components/ai-elements/attachments.tsx` | - |
| VoicePresence | `components/ai-elements/voice-presence.tsx` | - |
| AudioPlayer | `components/ai-elements/audio-player.tsx` | 6 TypeScript errors |

### View Components

| View | File | Status |
|------|------|--------|
| ChatView | `views/ChatView.tsx` | ⚠️ Error boundary added |
| HomeView | `views/HomeView.tsx` | ⚠️ Needs testing |
| CoworkView | `views/CoworkView.tsx` | ⚠️ Needs testing |
| CodeRoot | `views/code/CodeRoot.tsx` | ⚠️ Needs testing |
| AgentSystemView | `views/AgentSystemView/` | ⚠️ Needs testing |
| TerminalView | `views/TerminalView.tsx` | ⚠️ Needs testing |

---

## Known Issues (Pre-Audit)

### TypeScript Errors (163 remaining)

**Non-blocking** - UI renders despite type errors

Main categories:
1. **AI Elements** - Button props, Slider/Toggle props, Icon issues
2. **Missing exports** - Some UI components not exported
3. **Library types** - Missing type definitions

**Fix:** Install full AI SDK or add type ignores

### From ERRORS_FIXED.md

**Fixed:**
- ✅ Error boundary added
- ✅ ChatView error handling
- ✅ Markdown styling
- ✅ Missing UI exports (partial)

**Remaining:**
- ⚠️ AI Elements type errors
- ⚠️ Some missing exports

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: UI Audit

on: [push, pull_request]

jobs:
  ui-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      
      - name: Build app
        run: pnpm build
      
      - name: Run UI audit
        run: pnpm exec playwright test tests/ui-audit.spec.ts
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: ui-audit-results
          path: test-results/
```

---

## Troubleshooting

### Dev Server Not Running

```bash
# Check if port 5177 is in use
lsof -ti:5177

# Kill existing process
lsof -ti:5177 | xargs kill -9

# Start fresh
cd 7-apps/shell/web
pnpm dev
```

### Playwright Installation Issues

```bash
# Clear cache
rm -rf ~/.cache/ms-playwright

# Reinstall
pnpm exec playwright install
```

### browser-use Installation Issues

```bash
# Create virtualenv
python -m venv venv
source venv/bin/activate

# Install
pip install browser-use==0.1.40 playwright==1.49.0
playwright install
```

### Tests Timing Out

Increase timeout in `playwright.config.ts`:
```typescript
export default defineConfig({
  timeout: 120000, // 2 minutes
  expect: {
    timeout: 10000,
  },
});
```

---

## Best Practices

### When Running Audits

1. **Start with clean state** - Clear localStorage, cookies
2. **Use consistent environment** - Same browser version, viewport
3. **Run multiple times** - Catch flaky issues
4. **Check console logs** - Look for errors/warnings
5. **Compare screenshots** - Visual regression detection

### When Fixing Issues

1. **One issue per commit** - Clear history
2. **Test thoroughly** - No regressions
3. **Update documentation** - Keep tracker current
4. **Add tests** - Prevent recurrence
5. **Review with team** - Knowledge sharing

### When Reporting Issues

1. **Be specific** - Clear reproduction steps
2. **Include screenshots** - Visual evidence
3. **Note environment** - Browser, OS, version
4. **Prioritize correctly** - Use priority guide
5. **Link related issues** - Group connected problems

---

## Next Steps

1. **Run the audit** using one of the methods above
2. **Review results** in the HTML report
3. **Update tracker** with new issues found
4. **Prioritize fixes** based on severity
5. **Fix issues** systematically
6. **Re-run audit** to verify fixes
7. **Document learnings** for future reference

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [browser-use Documentation](https://github.com/browser-use/browser-use)
- [UI_ISSUES_TRACKER.md](./UI_ISSUES_TRACKER.md)
- [UI_AUDIT_REPORT_TEMPLATE.md](./UI_AUDIT_REPORT_TEMPLATE.md)
- [ERRORS_FIXED.md](./ERRORS_FIXED.md)
- [SHELL_UI_FIXES.md](./SHELL_UI_FIXES.md)

---

**Questions?** Check the troubleshooting section or reach out to the team.

**Contributing:** Add new test cases to `tests/ui-audit.spec.ts` as you discover new issues.

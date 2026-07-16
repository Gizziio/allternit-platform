# Task: Verify and finish the Code-mode fixes

Read `docs/CODE_MODE_HANDOFF_MAP.md` first — it has full context on what was
reported, what was already changed (uncommitted, in the working tree), and
the open question about which of two flows is actually broken. Do not repeat
that analysis; act on it.

## Scope for this phase

1. **Reproduce Flow B first** (Code tab in left rail → Code surface's own
   composer → send a message). This is the most likely candidate for what
   Eoj is actually testing. Use the electron-inspector pattern: connect to
   the already-running app via CDP
   (`chromium.connectOverCDP('http://localhost:9223')`, `context.pages()[0]`)
   so you're watching the real app, not a clean clone. Click the "Code" rail
   tab, type a harmless message (e.g. "write a hello world function in
   python"), send it, and observe: does the view switch from the empty
   launchpad greeting to a conversation with the message visible? Screenshot
   before and after. Check console errors (`page.on('console', ...)` for
   `type() === 'error'`, `page.on('pageerror', ...)`).

2. **Also reproduce Flow A** (Chat home → click "Agent Off" pill → ModeDock
   deck appears → click mode trigger → pick "Code" → send). Find the exact
   locator for the "Agent Off" toggle in
   `surfaces/ai.allternit.com/src/views/chat/components/BottomDock.tsx`
   (~lines 97-98, 154, 180, 222) before scripting the click. Confirm whether,
   after enabling Agent Mode and picking Code, sending actually opens the
   Code surface with a live session (per fix #3 in the map) or not.

3. **Whichever flow is actually broken, fix it for real** based on what you
   observe (console errors, network tab via
   `page.on('request'/'response')` for `/api/v1/agent-sessions` calls, actual
   DOM state) — not by re-reading code and guessing. If Flow B is the one
   Eoj cares about and it's already working, say so plainly and move on to
   confirming Flow A; don't fix things that aren't broken.

4. **Verify the worktree pill fix** (map fix #6/#7): in whichever flow lands
   you in `CodeCanvas.tsx`, click the worktree pill (in `CodeWorkspaceBar`,
   labeled "worktree" with a checkbox icon) before and after sending a
   message, confirm the checkbox visually toggles and stays toggled once a
   session exists (not reset). This does NOT need to provision a real git
   worktree — just confirm the UI state is no longer dead/disconnected.

5. **Verify the launchpad quick-actions fix** (map fix #6): on the Code
   surface's empty launchpad, dismiss the usage-stats dashboard (X/close
   button) and confirm the Scaffold/Refactor/Debug/Optimize/Explore pill row
   is now visible and clicking one expands its template list.

## Constraints

- No builds, no typecheck runs (`tsc`, `cargo build`, etc.) — verify only by
  driving the live app.
- No git commits unless asked.
- Keep messages you send through the composer harmless/short — this is the
  real running app Eoj may return to.
- Delete or overwrite the scratch file
  `.claude/skills/electron-inspector/test-code-mode-tmp.cjs` when done with
  it; don't leave stray permanent-looking scripts in that skill directory
  unless they're genuinely worth keeping as a reusable check.

## Deliverable

When finished, write `docs/CODE_MODE_HANDOFF_NOTES.md` starting with YAML
frontmatter:

```yaml
---
status: done|blocked
files_changed: [...]
deviations: [...]
remaining: [...]
---
```

followed by prose: which flow was actually broken, what you changed (with
file:line references), and screenshot paths proving both flows now work (or
exactly which one still doesn't and why).

# TASK B CONTINUATION — finish bot-mode governance UI

The previous executor (kimi) hit a 5-hour quota limit mid-Task B. Do **not** redo Task A (backend). Do **not** git operations, do **not** start a dev server, do **not** start Phase 2 UX (avatars, @mentions, group chat, long-running session chrome).

Read first, in this order:

1. `docs/OPENBOT_POLICY_PHASE_B_TASK.md` — binding spec
2. `docs/OPENBOT_POLICY_PHASE_A_NOTES.md` — API contract that already landed
3. Existing partial files listed below

Workdir is this repo. Stay here.

## Already on disk (keep, review, fix only if broken)

- `surfaces/ai.allternit.com/src/views/bots/policy-audit.ts` — fetch, validation, presets, `buildPolicyDocument`. Task A has **no** `PUT /api/aci/policy`; the fallback (validated JSON + copy / save-to-`ALLTERNIT_ACI_POLICY_FILE` instruction) is the correct save path. Do not invent a write endpoint.
- `surfaces/ai.allternit.com/src/views/bots/PolicyVerdictChips.tsx` — polls `GET /api/aci/policy/audit?bot_id=` every 3s, pauses when tab hidden, clears on unmount, denied chips show rule id, "View all" callback.
- `surfaces/ai.allternit.com/src/views/bots/PolicyAuditList.tsx` — table, empty state, load-more.

`BotChatSessionView.tsx` is **not** wired yet. `PolicyEditor.tsx` does **not** exist. No colocated `*.test.tsx` for these modules. No `docs/OPENBOT_POLICY_PHASE_B_NOTES.md`.

## Remaining work (this is the whole job)

1. **PolicyEditor.tsx** colocated under `src/views/bots/`:
   - Structured fields per rule: id, tool glob, action (allow/deny/ask), optional intent, botId, networkHost, filePath, mcpTool.
   - Advanced toggle for raw JSON.
   - Client-side validation via `validatePolicyRules` from `policy-audit.ts`. Flag a rule that would fail gateway load **before** save, using those reason strings.
   - Preset buttons from `POLICY_PRESETS` (insert, don't replace unless the editor is empty).
   - Save fallback: generate validated JSON via `buildPolicyDocument`, show it with a copy button and a save-to-path instruction naming `ALLTERNIT_ACI_POLICY_FILE`. Never display or accept credentials.
2. **PolicyGovernance gating wrapper** (small colocated component, or a function in one of the files):
   - Render the three surfaces **only** when `session.metadata.sessionMode === "agent"` **or** `session.metadata.isBot` is true. Otherwise render nothing.
   - `BotChatSessionView` is already a bot 1:1 view; still honor the gate so tests can prove the off path.
3. **Wire into `BotChatSessionView.tsx`**:
   - Chips: compact row in the session chrome (header / above messages is fine; match existing `border-[var(--border-subtle)]` + CSS vars).
   - "View all" opens the audit list as a **collapsible panel** in the session view, alongside the existing watch/takeover area (`BotComputerViewport` aside). Not a modal, no new ViewRegistry entry, no new nav item.
   - Policy editor in that same collapsible governance panel (or a second section of it).
   - Use `botId` from the view props / resolved bot. If `botId` is missing, do not fetch.
4. **Tests** (vitest, colocated `*.test.tsx`):
   - Gating: surfaces render nothing when `sessionMode !== "agent"` and `isBot` is falsy.
   - Chips: mocked `fetchPolicyAudit` renders allowed + denied; denied shows rule id.
   - Editor: validation rejects missing id/tool/action and bad action values; a preset inserts a valid rule.
   - Mock `./policy-audit` (or the data module) — do not mock the raw api client if the components import `policy-audit`.
   - Run: `npx vitest run <your test files>` from `surfaces/ai.allternit.com`. Optionally `npx tsc --noEmit` for your files. No full app build.
5. Update `.steering/checkpoint.md` at the end. Append `### openbot-policy-gateway <ISO ts>` to `.allternit/shared-context.md` if present.

## Conventions

React + TS, Tailwind + CSS vars, `cn()` from `@/lib/utils`, phosphor-icons, framer-motion only where the file already uses it. Match `BotChatSessionView.tsx` idiom. Register 1 copy (plain, no hype, no alarmism).

## Deliverable sentinel

When finished, write `docs/OPENBOT_POLICY_PHASE_B_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done   # or blocked
files_changed: []
deviations: []
remaining: []
test_evidence: []
---
```

Then prose notes. That file existing with `status: done` is the completion signal. Do not write it until the tests have actually been run and the wiring is in the session view.

If blocked, still write the NOTES file with `status: blocked` and the exact reason.

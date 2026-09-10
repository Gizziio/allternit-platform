# TASK B (frontend) — Bot-Mode Governance UI (verdict chips, audit list, policy editor)

**Prerequisite: Task A must be reviewed and merged into your worktree branch first** (the orchestrator will tell you when). Read `docs/OPENBOT_POLICY_MAP.md` and `docs/OPENBOT_POLICY_PHASE_A_TASK.md` first — the API contract below assumes Task A landed. Do NOT do git operations. Do NOT start dev servers.

## Placement (binding)

Everything lives in the existing bot session view `surfaces/ai.allternit.com/src/views/bots/BotChatSessionView.tsx` (and small colocated components under `src/views/bots/`). **No new ViewRegistry entries, no new nav items, no new top-level tabs.** All three surfaces render ONLY when the open session is a bot session: `session.metadata.sessionMode === "agent"` or `metadata.isBot` (see `src/lib/bots/bot-canonical-chat.service.ts`, `BotHubSessionsTab.tsx:80-84`). When bot mode is off, nothing new renders.

## Surfaces

1. **Verdict chips** — colocated component `PolicyVerdictChips.tsx`:
   - Poll `GET /api/aci/policy/audit?bot_id=<botId>` every ~3s while the bot session is open (clear interval on unmount; pause when tab hidden). Merge with any run events the session view already consumes — one timeline, no second SSE transport.
   - Render each recent decision as a chip using existing primitives (`src/components/ui/badge.tsx` / `Pill.tsx`, `--status-success/warning/error` CSS vars, `cn()`): `allowed` → success badge; `denied` → error badge showing the rule id; recent-failure rows → warning. Compact: tool name + verdict, rule id on denied. Follow the status-dot pattern of `BotHubCard.tsx:131-135`.
   - Latest ~10 decisions; "View all" opens the audit list (surface 2).
2. **Audit list** — colocated `PolicyAuditList.tsx`:
   - Bot-scoped list from the same API (paginated by `limit`, newest first). Columns: time, tool/action, verdict chip, rule id (denied rows), actor. Empty state in plain language (Register 1: no hype, no alarmism).
   - Rendered as a collapsible panel inside the bot session view (alongside the existing watch/takeover area — follow `BotComputerViewport.tsx` layout conventions, not a modal).
3. **Policy editor** — colocated `PolicyEditor.tsx`:
   - Structured fields per rule (NOT raw JSON for the common case): rule id, tool glob, action (allow/deny/ask), optional intent, botId, networkHost, filePath, mcpTool. Advanced toggle reveals raw JSON editing.
   - Client-side validation mirrors the gateway schema (required: id + tool + action; action ∈ allow|deny|ask). A rule that would fail gateway load is flagged before save with the plain-language reason (mirror Task A's `PolicyLoadError` messages).
   - Presets: ship 2–3 starter presets (e.g. "deny shell rm -rf", "allow browse only", "ask before file writes") as insertable templates.
   - Saving writes the policy document via a Task-A endpoint (`PUT /api/aci/policy` — if Task A did not add a write endpoint, fall back to: editor generates the validated JSON document and shows it with a copy/save-to-path instruction naming `ALLTERNIT_ACI_POLICY_FILE`; note this in NOTES). NEVER display or accept credential values anywhere in this UI.
   - Bot-mode only, same gating as above.

## Tests (vitest, colocated `*.test.tsx`)

- Gating: surfaces render nothing when `sessionMode !== 'agent'` / `isBot` falsy.
- Chips: mocked audit API response renders allowed/denied chips; denied shows rule id.
- Editor: validation rejects missing id/tool/action and bad action values; preset inserts a valid rule.

## Conventions + constraints

- React + TS, Tailwind utility classes + CSS vars, `cn()` from `@/lib/utils`, phosphor-icons, framer-motion where motion already exists. Match `BotChatSessionView.tsx` idiom (hooks, effect cleanup, no new state libs).
- Allowed commands: `npx vitest run <file>` for your tests; `npx tsc --noEmit` inside `surfaces/ai.allternit.com` is encouraged for your files. No dev servers, no builds of the whole app, no git ops.
- Update `.steering/checkpoint.md` at milestones. Append `### openbot-policy-gateway <ISO ts>` notes to `.allternit/shared-context.md` if present.

## Deliverable sentinel

Write `docs/OPENBOT_POLICY_PHASE_B_NOTES.md` with YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`, `test_evidence`) + prose. That file existing = done.

---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/bots/policy-audit.ts
  - surfaces/ai.allternit.com/src/views/bots/policy-audit.test.ts
  - surfaces/ai.allternit.com/src/views/bots/PolicyVerdictChips.tsx
  - surfaces/ai.allternit.com/src/views/bots/PolicyAuditList.tsx
  - surfaces/ai.allternit.com/src/views/bots/PolicyEditor.tsx
  - surfaces/ai.allternit.com/src/views/bots/PolicyGovernance.tsx
  - surfaces/ai.allternit.com/src/views/bots/PolicyGovernance.test.tsx
  - surfaces/ai.allternit.com/src/views/bots/BotChatSessionView.tsx
  - .steering/checkpoint.md
  - .allternit/shared-context.md
  - docs/OPENBOT_POLICY_PHASE_B_CONTINUE.md
deviations:
  - "No PUT /api/aci/policy exists in Task A; editor save is copy-JSON + save-to-ALLTERNIT_ACI_POLICY_FILE (as the task allowed)."
  - "Governance panel is a collapsible section under the verdict chips (same bot session view), not a second aside next to BotComputerViewport. No new ViewRegistry/nav entries."
  - "Kimi executor hit a 5-hour quota mid-Task B; Claude OAuth was logged out; Codex was usage-limited until 2026-09-16. Remaining Task B (editor, wiring, tests) finished in the orchestrator session against this worktree."
remaining:
  - "Phase 2 UX cluster from the spec (pet avatars, @mention routing, multi-bot group chat, long-running session chrome) — out of Task B scope."
  - "Seat B (execute_computer_tool) still evaluates with bot_id unset, per Task A notes; aci.run audit rows are bot-scoped."
  - "No git operations in the original task; orchestrator opens the PR after this sentinel."
test_evidence:
  - "npx vitest run src/views/bots/PolicyGovernance.test.tsx src/views/bots/policy-audit.test.ts → 11 passed (gating off/on, allowed+denied chips with rule id, missing id/tool/action, bad action via JSON, preset insert, validatePolicyRules, buildPolicyDocument)"
---

# Phase B notes — OpenBot Policy Gateway (bot-mode UI)

## What was built

Bot-session governance surfaces, gated on `metadata.sessionMode === "agent"` or `metadata.isBot`. Nothing new renders for a regular chat session.

**policy-audit.ts** — `GET /api/aci/policy/audit?bot_id=&limit=` client, `validatePolicyRules` / `buildPolicyDocument` mirroring the gateway loader, three presets (deny dangerous shell, allow browse only, ask before file writes).

**PolicyVerdictChips** — polls every 3s while mounted, pauses when the tab is hidden, clears on unmount. Allowed/denied chips; denied shows the rule id. "View all" / "Policy" opens the panel.

**PolicyAuditList** — bot-scoped table, newest first, empty state in plain language, load-more.

**PolicyEditor** — structured fields per rule, advanced JSON toggle, client-side validation, preset insert, copy of the validated document plus a save-to-`ALLTERNIT_ACI_POLICY_FILE` instruction. No credentials.

**PolicyGovernance** — the gate + wiring. Mounted in `BotChatSessionView` under the session header, above the messages/computer split.

## Tests

11 vitest cases in `PolicyGovernance.test.tsx` and `policy-audit.test.ts`. Worktree has no local `node_modules`; tests ran via the main checkout's install.

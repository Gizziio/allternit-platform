# Session mlxauto (Kimi Code) — gizzi-code 2.1.1 (Gemma chat-template fix)

**PRs:** #726 (role alternation), #727 (drop ts-nocheck) | **Tag:** gizzi-code/v2.1.1 | **Brew:** tap 2.1.0 → 2.1.1

## What shipped
- Fix for 404 "Conversation roles must alternate user/assistant/..." on
  local-mlx gemma: Gemma3's template (applied by mlx_lm.server) rejects
  system/tool roles and consecutive same-role turns. New
  `ink-app/utils/localChatRoles.ts` normalizer: system folds into the first
  user message, tool results become prefixed user messages, consecutive user
  turns merge; assistant tool_calls preserved; strict alternation. 6 unit
  tests. Wired into the ink-app local streaming path.
- Release incidents: v2.1.1 first attempt failed quality gates — handwritten
  @ts-nocheck count grew 499→500 (localChatRoles header); header removed
  (file fully typed), PR #727, tag moved, rerun green.

## Verified
brew 2.1.1 installed; binary contains normalizeRoleAlternation; auto-spawn
observed live (gizzi-owned mlx_lm.server serving Qwen3.5-4B on :8081).

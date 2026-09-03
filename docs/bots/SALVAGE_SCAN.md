# Salvage Scan: Abandoned Grok-Bot 0.18 Worktree

**Source branch:** `session/grok-bot-0-18-integration`  
**Target:** `main` (`3965a68c7`)  
**Scan date:** 2026-08-26

## Summary

The abandoned worktree contains ~390 changed files. Most of the backend "Desktop Cloud" surface and the unfinished goal-loop runtime are **obsolete or too entangled** to merge directly. A smaller set of UI views and provider adapters are **safe to port** with modest rewrites.

## Safe to salvage (low risk)

These are mostly pure-addition UI files that map cleanly to existing `main` services/stores:

| File | What it provides | Port effort |
|---|---|---|
| `surfaces/ai.allternit.com/src/views/bots/GroupChatView.tsx` | Group chat surface | Low — wire to existing `group-chat.service.ts` |
| `surfaces/ai.allternit.com/src/views/bots/GroupChatComposer.tsx` | Group composer | Low |
| `surfaces/ai.allternit.com/src/views/bots/GroupChatAvatar.tsx` | Group avatar | Low |
| `surfaces/ai.allternit.com/src/views/chat/components/RoutedTurnDock.tsx` | Provider/model rail dock | Medium — reconcile with new Pick a Brain design |
| `surfaces/ai.allternit.com/src/lib/bots/stack-providers/kimi-provider.ts` | Kimi stack provider adapter | Low |
| `surfaces/ai.allternit.com/src/lib/bots/use-stack-providers.ts` | Provider hook | Low |

## Salvage with rewrite (medium risk)

These files contain good logic but depend on local-first stores or unfinished runtimes:

| File | Why it needs rewrite |
|---|---|
| `cmd/allternit-api/src/cli_provider_detector.rs` | Revive for local CLI detection; strip unfinished inference-router dependencies |
| `cmd/allternit-api/src/inference_router_routes.rs` | Keep route shape; rewrite to use current gizzi/brain APIs |
| `cmd/allternit-api/src/inference_router_executor.rs` | Keep Codex/Claude Code execution logic; integrate with Rails receipts |
| `surfaces/ai.allternit.com/src/lib/bots/bot-import.ts` | Good YAML/Markdown parser skeleton; replace local-first persistence with API calls |
| `surfaces/ai.allternit.com/src/lib/bots/bot-contract.ts` | Useful event contracts; verify against current `Agent`/`ChatSession` types |

## Obsolete / do not merge (high risk or out of scope)

| Area | Reason |
|---|---|
| `cmd/allternit-api/src/bot_desktop_*.rs` | Large Desktop Cloud admin surface; out of scope for the current integration |
| Goal-loop runtime (`goal-loop-controller.ts`, `goal-task-contracts.ts`, etc.) | Unfinished, local-first, never reconciled with server ledger |
| `bot-operational-state.store.ts` local-first Zustand | Must be server-backed; rewrite from scratch |
| Desktop Cloud migrations (`V98__desktop_*` to `V102__desktop_*`) | Out of scope |
| `cmd/allternit-computer-cloud/` additions | Cloud platform feature; separate track |
| MCP server routes (`mcp_server_routes.rs`) | Wait until Pick a Brain + approvals are stable |

## Recommendation

1. Start Phase 1 by porting **GroupChatView/Composer/Avatar** as-is from the abandoned worktree.
2. Use `cli_provider_detector.rs` and `inference_router_routes.rs` as **reference** for the Pick a Brain backend, but rewrite them against `main`'s APIs.
3. Do **not** merge any goal-loop, Desktop Cloud, or local-first store code without a separate plan.
4. Delete the abandoned worktree after the safe files are extracted.

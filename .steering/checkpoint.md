# Steering checkpoint

## Goal
Port three Grok CLI features into gizzi-code (worktree `allternit-session-7631feda`, branch `session/7631feda-bbb5-492f-97cf-55f243eda42d`, repo `~/Desktop/allternit-workspace/allternit`):
1. `/session-info` presentation — **DONE, COMMITTED (b8675f9ce)**
2. Agent dashboard `/dashboard` — full Grok parity, in-process first — **Phase 5 CODE DONE (typecheck running), Phases 1–4 committed (b8675f9ce, 07865f0d0)**
3. `/settings` polish — effort row — **DONE, COMMITTED (b8675f9ce)**

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_7631feda-bbb5-492f-97cf-55f243eda42d/agents/main/plans/icon-kate-bishop-nightwing.md

## Just did (Phase 5 — NOT yet committed)
- `topLevelSession.ts`: needs-input detection — module `awaitingInput` Set; per-runner `canUseTool` wrapper installed after `await runner.queryParams` (safe: each dispatch builds fresh params, awaited once per runner); exported `isTopLevelSessionAwaitingInput`; cleared on finalize/remove. Added reorder: `moveTopLevelSession(taskId, dir)` + `getTopLevelSessionOrderRank` persisted in GlobalConfig `dashboard.reorder` (same additive key as `dashboard.pinned`).
- `types.ts`: DashboardSource += optional `move?(id, direction)` and `messages?(id): {role, text}[]`.
- `InProcessSource.ts`: running + awaiting-input → 'needs-input' state; list() sorts pinned → reorder rank → updatedAt; `move()` delegates; `messages()` maps getTopLevelSessionMessages to role/text excerpts (tool_use/tool_result blocks summarized).
- `DashboardScreen.tsx` full rewrite (~700 lines): inline peek panel under selected row (model · permission · state line, last response ≤3 non-empty lines from source.peek, needs-input hint, ❯ reply input); Esc ladder reply→peek→search→exit; details view (`v` — role + text per message, {i}/{n}, ‹/›/←/→ cycle, Esc back); cheatsheet (`?`); search (`/`, prefixes `a:` activity, `s:` state, `#` id); grouping Ctrl+G cycles none→state→directory (▾/▸ section headers, inactive auto-collapsed, Space toggles); idle folding (working/needs-input/pinned/<1h always visible + 8 freshest, "▸ N more" row Enter-expands); rename (`r`/Ctrl+R bottom input); pin (`p`/Ctrl+T); reorder (Shift+↑/↓ via source.move); stop/remove (`x`/Ctrl+X, 2s arm window, clears peek/details); dispatch box unchanged (Tab, Enter stay, Ctrl+S → list). `dashboard:exit` keybinding gated `isActive: browsing` (focus==='list' && no peek/search/details/cheatsheet).

## Gotchas learned
- Vendored ink `Event` has NO preventDefault — claim keys with `event.stopImmediatePropagation()`.
- Single-char chords (q, x, p, r) in the Dashboard context fire on any matching keypress — gate exit bindings with `isActive` whenever an inner input is focused; plain `/` is more reliable than Ctrl+/ in terminals (both wired).
- ctrl+letter arrives in raw useInput as `key.ctrl && input==='<letter>'`.
- LocalAgentTask is .tsx; framework is utils/task/framework.ts. `getCwdState` (bootstrap/state.ts:528) is the canonical cwd.
- Dev `bun run dev exec ...` fails in this shell (pre-existing HEAD/env issue). Interactive verification via tmux-driven `bun run dev` TUI is the path (Phase 6).

## Next
- Phase 5 verify: typecheck (task bash-qfp2yf28), fix if needed, commit + push.
- Phase 6: CHANGELOG entry (cmd/gizzi-code/CHANGELOG.md) + docs mention; `bun run test` (ci-smoke-test.sh); tmux smoke of `bun run dev` TUI: `/dashboard` opens, dispatch 2 sessions (rows appear, working ●), peek+reply queues/sends, states flip completed/failed, rename/pin/search/group, x stop + double-remove, Ctrl+\ toggle, Esc exits; then ledger summary `agent-ledger/summaries/2026-09-06-...-grok-dashboard.md` + LEDGER.md entry (post-merge per ritual).

## Open questions
- Known deltas from Grok parity, honest list for ledger: (a) details view is a text excerpt, not the full Messages renderer; (b) needs-input answers are given in the main session prompt, not option buttons 1-9 in the peek; (c) working glyph is a static ● (no spinner frame animation); (d) main-session leader row state is static 'idle' (isLoading wiring deferred).
- Whether main-session dashboard tasks get auto-evicted from state.tasks while dashboard is open — testing will tell; registry fallback keeps the row visible, reply-to-evicted no-ops in v1.

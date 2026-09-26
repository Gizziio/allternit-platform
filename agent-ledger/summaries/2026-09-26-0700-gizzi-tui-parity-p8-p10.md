# gizzi-tui-parity P8–P10 — deferral burn-down (owner-directed)

- Session: session/gizzi-tui-parity; three parallel coder subagents on disjoint file sets.
- PRs: #755 (hooks parity), #756 (quota fetchers), #757 (memory convergence) — all merged to main.

## P8 — full settings-hook parity (#755)
http-type hooks (event JSON POST, allowedHttpHookUrls allowlist, allowedEnvVars header
interpolation, non-2xx fail-open, 2xx JSON gates); `if` conditions (permissionRuleValueFromString
ported verbatim + Wildcard.match on tool_input); async/once (fire-and-forget; once-per-session
registry); hookSpecificOutput.updatedInput arg replacement (exact ink-app semantics);
permissionDecision:"ask" routed through the real ctx.ask flow (deny > ask > allow, never silent
allow). prompt/agent hooks documented as the single remaining deferral (need LLM round-trip).
40/40 bridge tests incl. live Bun.serve http tests; typecheck clean; preflight 52/0.

## P9 — ProviderQuotas beyond kimi (#756)
OpenRouter fetcher (documented /api/v1/credits + /api/v1/auth/key fallback, OPENROUTER_API_KEY,
8s timeout, 60s cache). All other ~35 providers have no documented user-level quota API with the
stored credential → dim "quota n/a" marker in picker header/detail and per-turn chip instead of an
empty slot (never-fabricate). DeepSeek skipped: balance has no limit, ratio would fabricate a
denominator. 60/60 touched suites (network mocked); typecheck clean; preflight 52/0.

## P10 — memory store convergence (#757)
memory_write/memory_recall now read+write the canonical memdir (getAutoMemPathFor anchored at
Instance.directory); old global store + L1-COGNITIVE dirs are read-only legacy fallbacks (memdir
wins dedupe). One-time copy-only import per project (.memdir-import-v1.json marker; nothing
deleted). Index updates line-preserving so TUI MEMORY.md lines survive. System prompt names the
memdir as the shared store. Tool contract unchanged. 35/35 memory+instruction suites; preflight 52/0.

## Remaining known follow-ups (reported, out of scope)
- prompt/agent settings-hook types (TUI-only by design).
- memdir env-var name divergence between the two copies (GIZZI_REMOTE_MEMORY_DIR vs
  GIZZI_CODE_REMOTE_MEMORY_DIR).
- Desktop binary rebuild still owed (all phases touched bundled gizzi-code).

# Steering checkpoint

Goal: Purge Anthropic/Claude product naming from gizzi-code (hard rename to GIZZI_*/gizzi-code).

Just did:
- Hard-purged `CLAUDE_CODE_*` env identifiers to `GIZZI_*` (zero fallback) via `gizziEnv.ts` + `script/purge-claude-naming.ts`.
- Rewrote user-visible "Claude Code" copy to gizzi-code; product/docs/feedback URLs to gizzi.io / docs.gizziio.com / Gizziio issues.
- Added `NOTICE`, scoped `LICENSE`, `docs/anthropic-allowlist.md`. Functional floor kept (API hosts, OAuth, model names, CLAUDE.md read-compat).
- Typecheck exit 0; smoke 103/103 green; gizziEnv tests 6/6.

Next: commit on main; breaking env rename wants gizzi-code 2.0.0 republish after review. gizzi-sdk legal hold unchanged.

Open questions: counsel still owes the distribution basis for derived code (`docs/legal-attribution.md` §6).

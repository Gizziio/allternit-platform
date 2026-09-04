# Steering checkpoint

Goal: gizzi-code 2.0.0 — finish Anthropic naming purge and publish the CLI (not gizzi-sdk).

Just did:
- Hard-purged `CLAUDE_CODE_*` → `GIZZI_*` (zero fallback) and user-visible "Claude Code" copy.
- Renamed remaining internal identifiers/files (`getGizziMds`, `gizziGuideAgent`, `gizziHints`, `getLegacyClaudeHomeDir`).
- Bumped `@allternit/gizzi-code` to 2.0.0. NOTICE + scoped LICENSE + anthropic-allowlist + counsel questions (§7).
- Typecheck 0; smoke 103/103.

Next: merge origin/main, push, tag `gizzi-code/v2.0.0`, watch publish-gizzi-code-npm.yml. Do **not** publish gizzi-sdk (legal hold).

Open questions: counsel still owes distribution basis (`docs/legal-attribution.md` §6/§7). Parallel infra on origin/main (Tailscale/mail/8013) is separate.

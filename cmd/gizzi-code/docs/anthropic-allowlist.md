# Anthropic functional-floor allowlist

This is the list of Anthropic/Claude identifiers that **remain** in
`cmd/gizzi-code` after the 2026-09-04 hard naming purge, and why each is
kept. Anything not on this list that still says Claude/Anthropic in
user-visible product copy is a bug.

Product env vars are `GIZZI_*` only (`src/shared/utils/gizziEnv.ts`). There
is no `CLAUDE_CODE_*` fallback.

## Protocol / API (required to talk to Anthropic)

| Item | Why it stays |
|------|----------------|
| `api.anthropic.com` / `api-staging.anthropic.com` | Model API host |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` | Industry-standard provider env names |
| Provider id `"anthropic"` | Selects the Anthropic backend |
| `@anthropic-ai/sdk` and `src/vendor/anthropic-stubs/` | Real MIT dependency + type shims of its package name |
| Beta header **value** `claude-code-20250219` | Wire contract the API accepts (`GIZZI_BETA_HEADER_20250219` is our identifier) |
| Model names (`claude-sonnet-*`, `Claude Sonnet`, `Claude Opus`, `Claude Haiku`) | Names of the model being called |
| `https://platform.claude.com/llms.txt` | Anthropic platform docs map for the model API |

## OAuth / claude.ai (users authenticating an Anthropic account)

| Item | Why it stays |
|------|----------------|
| `CLAUDE_AI_*` URL constants (`CLAUDE_AI_BASE_URL`, authorize, scopes, …) | OAuth contract |
| `https://claude.ai/oauth/*` including `MCP_CLIENT_METADATA_URL` | CIMD client_id hosted by Anthropic |
| `mcp-proxy.anthropic.com` | MCP OAuth proxy host |

## Legacy on-disk compat (read-only)

| Item | Why it stays |
|------|----------------|
| `CLAUDE.md` / `CLAUDE.local.md` / `.claude/rules` | Filenames we still **read**. Canonical write name is `GIZZI.md` / `.gizzi/rules` (`src/shared/utils/agentFileResolver.ts`) |
| `~/.claude` and `CLAUDE_CONFIG_DIR` | Migration source path on user machines |
| `~/.claude/plugins` | Read-only leftover plugin-state fallback |

## Identifying upstream (not our product)

| Item | Why it stays |
|------|----------------|
| `@anthropic-ai/claude-code` | Leftover-install detection / doctor cleanup of the upstream CLI |
| `anthropics/claude-plugins-official` | Marketplace source we **refuse** |
| `github.com/anthropics/claude-code-action` | Nominative link to the upstream GitHub Action |
| Comments citing `github.com/anthropics/claude-code/issues/N` | Engineering citations of upstream bug reports |

## Explicitly not allowlisted (must stay gone)

- User-visible product name `"Claude Code"`
- `CLAUDE_CODE_*` env vars (including dual-name fallback)
- Product docs/feedback URLs on `docs.claude.com` or `github.com/anthropics/claude-code/issues`
- `PRODUCT_URL` pointing at `claude.com/claude-code`

Verification:

```bash
rg -n 'Claude Code' src test packages --glob '!**/vendored/**'
rg -n 'CLAUDE_CODE' src test packages --glob '!**/vendored/**'
```

Both should be empty outside this file, `docs/legal-attribution.md`,
`NOTICE`, `LICENSE`, and the purge scripts.

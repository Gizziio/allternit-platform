# Remaining third-party Anthropic identifiers

Product branding is Allternit/gizzi. First-party API hosts are `*.allternit.com`.
Product env vars are `GIZZI_*` / `ALLTERNIT_*` (`src/shared/utils/gizziEnv.ts`).
There is no `CLAUDE_CODE_*` fallback and no shipped Bedrock `anthropic.claude-*` IDs.

These identifiers remain only because they name a third party or a leftover
on-disk/install artifact — not our product.

## Third-party packages and catalogs

| Item | Why it stays |
|------|----------------|
| `@ai-sdk/anthropic` | Vercel AI SDK npm package we import |
| `@anthropic-ai/bedrock-sdk`, `@anthropic-ai/vertex-sdk`, `@anthropic-ai/foundry-sdk`, `@anthropic-ai/sandbox-runtime` | Optional npm package names (typed stubs in `src/vendor/anthropic-stubs/`) |
| models.dev provider id `"anthropic"` | External catalog id for Claude models |
| Model names (`claude-sonnet-*`, Claude Sonnet/Opus/Haiku) | Names of the model being called |

## OAuth / claude.ai (users authenticating an Anthropic account)

| Item | Why it stays |
|------|----------------|
| `CLAUDE_AI_*` URL constants | OAuth contract hosted by Anthropic |
| `https://claude.ai/oauth/*` including `MCP_CLIENT_METADATA_URL` | CIMD client_id hosted by Anthropic |
| `https://platform.claude.com/oauth/*` | Anthropic console OAuth |

## Legacy on-disk compat (read-only)

| Item | Why it stays |
|------|----------------|
| `CLAUDE.md` / `CLAUDE.local.md` / `.claude/rules` | Filenames we still **read**. Canonical write name is `GIZZI.md` / `.gizzi/rules` |
| `~/.claude` and `CLAUDE_CONFIG_DIR` | Migration source path on user machines |
| `<claude-code-hint />` tag (read-only parse) | Legacy hint protocol; canonical emit/parse is `<gizzi-hint />` |

## Identifying upstream (not our product)

| Item | Why it stays |
|------|----------------|
| `@anthropic-ai/claude-code` | Leftover-install detection / doctor cleanup of the upstream CLI |
| `anthropic.claude-code` VS Code extension id | Leftover-install detection |
| `anthropics/claude-plugins-official` | Marketplace source we **refuse** |

## Explicitly not allowlisted (must stay gone)

- User-visible product name `"Claude Code"`
- `CLAUDE_CODE_*` env vars (including dual-name fallback)
- Product docs/feedback URLs on `docs.claude.com` or `github.com/anthropics/claude-code/issues`
- `PRODUCT_URL` pointing at `claude.com/claude-code`
- First-party API hosts on `api.anthropic.com` (product host is `api.allternit.com`)
- Bedrock model IDs `anthropic.claude-*` / `*.anthropic.claude-*`
- Product identifiers `com.anthropic.*`

Verification:

```bash
rg -n 'Claude Code' src test packages --glob '!**/vendored/**'
rg -n 'CLAUDE_CODE' src test packages --glob '!**/vendored/**'
rg -n 'anthropic\\.claude-' src test packages --glob '!**/vendored/**' --glob '!**/models-api.json'
```

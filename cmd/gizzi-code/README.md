# Gizzi Code

AI-powered terminal coding agent for the Allternit ecosystem. Gizzi Code runs
locally, speaks to the LLM provider you configure, and integrates with the
Allternit platform (cloud auth, cowork runs, rails mail, the `alt_` API-key
ecosystem) when you connect it.

## Install

**macOS / Linux:**
```bash
curl -fsSL https://install.gizziio.com/install | bash
```

**Windows (PowerShell):**
```powershell
irm https://install.gizziio.com/install.ps1 | iex
```

**npm:**
```bash
npm install -g @allternit/gizzi-code
```

Or grab a prebuilt binary for your platform from the
[releases page](https://github.com/Gizziio/allternit-platform/releases)
(assets are named `gizzi-code-v<version>-<target>.tar.gz` / `.zip`; tags look
like `gizzi-code/1.0.2`).

## Quick start

```bash
gizzi                    # interactive session
gizzi exec "fix the failing tests"   # one-shot, non-interactive
gizzi serve              # local HTTP/WebSocket server (opt-in)
gizzi api-keys list      # manage Allternit platform tokens
gizzi doctor             # updater + environment health
gizzi --help             # everything else
```

## Configuration

- Provider keys: standard provider env vars (`ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, …) or an auth profile in `~/.config/gizzi-code/config.toml`.
- Platform token: `gizzi api-keys set allternit alt_...` (durable scoped keys)
  or run the login flow (`gizzi org status` will point you at it when missing).
- Env overrides: `ALLTERNIT_API_URL`, `GIZZI_PLATFORM_API_URL`,
  `GIZZI_CLERK_ISSUER` — defaults live in `src/shared/constants/cloudUrls.ts`
  and `allternitGateway.ts`.

## Development

```bash
pnpm install                 # from the repo root (pnpm monorepo)
cd cmd/gizzi-code
bun run dev                  # run from source
bun run typecheck            # tsc --noEmit (builds packages/sdk dist first)
bash script/ci-smoke-test.sh # empirically-green test subset
bun run build                # production binary -> dist/gizzi-code
```

## Repository layout

This package lives at `cmd/gizzi-code` inside the
[Gizziio/allternit-platform](https://github.com/Gizziio/allternit-platform)
monorepo. Platform services it talks to: `cmd/allternit-cloud-api` (public
cloud API, api.allternit.com) and `cmd/allternit-api` (local gateway backend,
loopback-only today — see `reports/2026-09-04-backend-b-deploy-decision.md`).

## Security

See [SECURITY.md](./SECURITY.md). Server mode is opt-in and unauthenticated
without `GIZZI_SERVER_PASSWORD`; the permission system is a UX feature, not a
sandbox.

## License

MIT

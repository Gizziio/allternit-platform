# Allternit Platform Deployment Guide

> **STATUS: Rewritten 2026-09-03.** The previous version of this document
> described a Vercel + Next.js deployment. The platform is now a **Vite +
> React SPA** deployed as a static export to **Cloudflare Pages** by GitHub
> Actions. The Vercel project (`prj_veXmWY1vWUn6N9aBWA4gTRyeSmrx`) and the
> `deploy-platform.yml` workflow referenced below are retired.
>
> Last verified: 2026-09-03 against a0f8230b5.

## How deployment actually works

### Web surfaces → Cloudflare Pages

Workflow: [`.github/workflows/deploy-cloudflare-pages.yml`](../../.github/workflows/deploy-cloudflare-pages.yml)

On every push to `main` touching the surfaces (plus `workflow_dispatch`):

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. `pnpm prisma generate` (ai.allternit.com)
3. `pnpm --filter "@allternit/ai..." build` — Vite build, output `dist/`
4. `wrangler pages deploy <dir>/dist --project-name=<project> --branch=main`

| Surface | Pages project | Domain | Build output |
|---------|---------------|--------|--------------|
| `surfaces/ai.allternit.com` | `ai-allternit` | ai.allternit.com | `dist/` |
| `surfaces/platform.allternit.com` | `allternit-platform` | platform.allternit.com | `dist/` |

Other surfaces have their own workflows: `deploy-docs-cloudflare.yml`
(`allternit-docs` → docs.allternit.com) and `deploy-office-cloudflare.yml`
(`allternit-office` → office.allternit.com). The full domain ↔ project map
lives in [`docs/Operations/CLOUDFLARE_MAPPING.md`](../../docs/Operations/CLOUDFLARE_MAPPING.md).

Build-time env (set in the workflow / GitHub secrets):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   # Clerk publishable key (ai.allternit.com)
NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH=true
NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL=https://api.allternit.com
VITE_REMOTE_CONTROL_PUSH_URL
ENCRYPTION_KEY
```

The canonical cloud API is **`https://api.allternit.com`** — do not point
anything at the retired `allternit-cloud-api.fly.dev` host.

### Cloud API → Contabo VPS (systemd + nginx)

The Rust cloud API (`cmd/allternit-cloud-api`, axum + Postgres) runs on the
Contabo control-plane VPS (`mail`, Tailscale-only SSH):

- Binary: `/opt/allternit-cloud-api/bin/allternit-cloud-api`, systemd unit
  `allternit-cloud-api`, port **8082** behind nginx (443 → 8082).
- Deploy loop: `scripts/deploy-cloud-api.sh` (repo root; `--fast`, `--dry-run`).
- Full runbook: [`docs/Operations/CLOUD_API_VPS_DEPLOY.md`](../../docs/Operations/CLOUD_API_VPS_DEPLOY.md).
- CI/CD: [`.github/workflows/deploy-cloud-api-contabo.yml`](../../.github/workflows/deploy-cloud-api-contabo.yml)
  (test → cross-build → Tailscale deploy with auto-rollback). A Railway
  variant (`deploy-cloud-api-railway.yml`) also exists.

## Testing Locally

```bash
cd surfaces/ai.allternit.com

# Install dependencies
pnpm install --ignore-scripts

# Generate Prisma client
pnpm prisma generate

# Dev server (Vite, port 3013)
pnpm dev

# Production build (output: dist/)
pnpm build
```

## Troubleshooting

### "Module not found" errors

Make sure `sdk/allternit-sdk/dist/` is committed to git:
```bash
git add sdk/allternit-sdk/dist/
git commit -m "Update SDK dist"
```

### Deploy didn't run

The Pages workflow only triggers on pushes to `main` that touch
`surfaces/ai.allternit.com/**`, `surfaces/platform.allternit.com/**`,
`packages/@allternit/**`, `services/runtime/**`, the workflow itself, or the
pnpm workspace files. Use `workflow_dispatch` for a manual run. Check runs at
the repo's Actions tab.

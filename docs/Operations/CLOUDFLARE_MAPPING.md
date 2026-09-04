# Cloudflare Pages Project Mapping

Quick reference for Cloudflare Pages projects and their domains.

> **Rewritten 2026-09-03.** The previous version described an old
> `projects/<name>/source/` + `deploy.zip` layout from the Allternit Websites
> repo and listed projects that no longer exist. The table below reflects the
> live projects (via `wrangler pages list`) and this repo's deploy workflows.
>
> Last verified: 2026-09-03 against a0f8230b5.

## Active Projects

### Deployed from this repo (GitHub Actions → wrangler)

| Pages Project | Domain(s) | Source in this repo | Workflow |
|---------------|-----------|---------------------|----------|
| **ai-allternit** | ai.allternit.com | `surfaces/ai.allternit.com/dist` (Vite build) | `.github/workflows/deploy-cloudflare-pages.yml` |
| **allternit-platform** | platform.allternit.com | `surfaces/platform.allternit.com/dist` (Vite build) | `.github/workflows/deploy-cloudflare-pages.yml` |
| **allternit-docs** | docs.allternit.com | `surfaces/docs/dist` (unzipped `export.zip`) | `.github/workflows/deploy-docs-cloudflare.yml` |
| **allternit-office** | office.allternit.com | `surfaces/office.allternit.com/dist` | `.github/workflows/deploy-office-cloudflare.yml` |
| **allternit-remote-control** | remotecontrol.allternit.com | (see `deploy-remote-control-cloudflare.yml` / `deploy-remote-control-push.yml`) | remote-control workflows |

### Live projects deployed outside this repo (Allternit Websites repo / manual)

| Pages Project | Domain(s) | Notes |
|---------------|-----------|-------|
| **allternit** | allternit.com, www.allternit.com | Marketing site |
| **allternit-services** | services.allternit.com | |
| **allternit-learning-labs** | labs.allternit.com | Also serves allternit-protocol-institute.pages.dev |
| **gizziio** | gizziio.com, www.gizziio.com, install.gizziio.com | |
| **gizzi-code-docs** | docs.gizziio.com | |
| **install-allternit** | install.allternit.com | |
| **try-allternit** | try.allternit.com | |
| **allternit-spaces** | spaces.allternit.com | |
| **allternit-compute** | compute.allternit.com | |
| **allternit-manufacturing** | manufacturing.allternit.com | |
| **allternit-robotics** | robotics.allternit.com | |

## Retired / renamed

- ~~`platform-allternit`~~ → the live project is **`allternit-platform`**.
- ~~`allternit-protocol-institute`~~ → content now served by **`allternit-learning-labs`** (labs.allternit.com).
- Do not point any domain or env var at the dead `allternit-cloud-api.fly.dev`
  host — the canonical cloud API is `https://api.allternit.com` (Contabo VPS,
  see `CLOUD_API_VPS_DEPLOY.md`).

## How to Deploy (repo-managed surfaces)

Merging to `main` deploys automatically. Manual run: GitHub → Actions → the
workflow → "Run workflow". The workflows use `wrangler pages deploy <dist>
--project-name=<project> --branch=main` with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets.

## Brand Colors

- Gizzi Mascot: `#D4B08C` (beige/tan)
- Gizzi Accents: `#D97757` (orange/coral)
- Allternit: `#B08D6E` (brown)

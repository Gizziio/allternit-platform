# Steering checkpoint

Goal: Public content pass so docs.allternit.com, the platform console Docs page, and allternit.com/docs describe Cloud API vs Allternit API as they are deployed.

Just did: Dual-API content pass in this worktree. New `api/overview.mdx` + `api/allternit-api.mdx`. Rewrote `byoc/overview.mdx` (no Vercel / :8080). Updated architecture, introduction, cloud-api (Postgres, P1 relay, provisioned-instances), authentication, agent-sessions (`/api/v1`, 428), office, beta, docs.json nav, release-notes, DEPLOYMENT_GUIDE, README ports, platform DocsPage. Marketing `DeveloperDocs.tsx` in the Websites repo (fly.dev → api.allternit.com).

Next: rebase onto origin/main (1 commit ahead), commit, PR, merge, watch deploy-docs-cloudflare.yml. Then deploy www if Eoj wants the marketing change live.

Open questions: Marketing is a separate repo; docs CI deploys on merge to main. Stale websites copy of docs.allternit.com is not synced (canonical is surfaces/docs).

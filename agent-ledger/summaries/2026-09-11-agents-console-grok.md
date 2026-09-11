# allternit-agents-surfaces Slice 1 — Cloud Console Agents tab (rq-20260911-001)

- **Date:** 2026-09-11
- **PR:** https://github.com/Gizziio/allternit-platform/pull/308 · merge `92847aabe8c865a4447f6bb5793c720fb86f3959`

## What landed

Cloud Agents session runner lives on **Cloud Console → Agents** (Managed Agents analog): create `/api/v1/sessions`, SSE log, interrupt, archive, copy curl/SDK, cost telemetry `charged: false`, visible `503 computer_unavailable`.

Chat composer and Recents on Hub/Desktop were **not** given Chat|Agent|Bot — that mix was wrong and reverted.

Mintlify `api/cloud-agents.mdx` added. Docs Pages production deploy not run.

## Verification

Desktop vitest, typecheck/build, Docs CI, gitleaks, typography, SW cache — success. Vercel/Pages Git ignored (rate limit).

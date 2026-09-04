# Session 423a858e (Kimi) — ai.allternit.com _redirects asset-swallowing fix

**Date:** 2026-09-03 · **Branch:** session/423a858e · **Merged:** dc91223b6 (main)

## What was done
Live-verified finding (from cross-agent launch gap analysis, A5): Cloudflare Pages
`_redirects` on ai.allternit.com had no pass-throughs for several real static
files, so the `/* / 200` SPA catch-all served index.html for them:
- `/bonsai-webgpu-worker.js` → local WebGPU models broken (loaded as Web Worker)
- `/benchmarks/*` → public benchmark leaderboard broken (JSON fetch got HTML)
- `/desktop-cloud-admin.html|.js`, `/plugin-manager-demo.html`,
  remote-control icon/splash PNGs — same latent breakage

Fix: added explicit self-rewrite pass-throughs for all of them (file:
`surfaces/ai.allternit.com/public/_redirects`), plus added the missing
`public/robots.txt` and `public/404.html`.

## Verification
- Rule list checked against every file in `public/` — all top-level files now covered.
- Deploy ran via GitHub Actions (deploy-cloudflare-pages.yml) on merge to main.

## Unfinished / deferred
- No sitemap.xml for the SPA (not generated anywhere).
- platform.allternit.com sync dropping prerendered auth routes — separate issue,
  owned by the workspace sync config, flagged in the launch gap analysis.
- Steering checkpoint updated during session; commit gate not triggered (harness
  has no steering hooks wired).

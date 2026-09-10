# Session checkpoint — phoneremote-0910

## Goal
Build `surfaces/phone-remote/`: PWA (no iOS app) to view + control this Mac's desktop from an iPhone over Tailscale. Node zero-dep server, ScreenCaptureKit capture, Quartz/CGEvent input, token auth, tailnet-only bind. Spec: Allternit Brain/Research/specs/phone-remote.md.

## Just did
- Surface built and verified (ws.test 20/20, smoke 9.3 fps). Pushed as PR #276 (single commit after squash to drop a gitleaks false-positive from PR history).
- iPhone-prep: token baked into manifest start_url, join URL copied to clipboard, OSK field on-screen, wake lock, visualViewport resize.
- Rebased onto main after openbot-policy-gateway landed; checkpoint histories preserved.

## Next
- Physical iPhone acceptance (Eoj): `cd surfaces/phone-remote && node server/index.mjs`, open the printed token URL in Safari over Tailscale.
- Human merge of PR #276 once CI (non-Vercel) is green.

## Open questions
- None on the v0 surface. Latency on the real tailnet is part of the human pass.

---

# Prior session (landed) — ao/openbot-policy-gateway

OpenBot-style policy gateway + bot-mode governance UI. PR #275 merged. Phase 2 UX remains out of scope.

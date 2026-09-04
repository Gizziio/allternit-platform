
---

# Addendum 2 (2026-09-03) — Step 6 decided: option (b), control-plane/data-plane split

The owner decided the routing story. Full rationale, prior-art research (DevPod,
OpenCode, E2B, Codespaces, Tailscale), and the revised work list:
**`docs/Architecture/2026-09-03-control-plane-data-plane-decision.md`**.

Headline decisions:
- **(b) chosen:** cloud-api is the single public API; the 8013 routes are mounted
  into it over time (P1). No second public gateway, no feature-flag-off.
- **Interim (P0):** nginx on `mail` proxies the known 8013-owned prefixes to
  127.0.0.1:8013 so the console stops 404ing while migration proceeds. Snippet:
  `infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf`
  (verified non-colliding against cloud-api's route table; deploy owner-gated).
- **Long term (P2):** per-sub data-plane instances — Allternit provisions an
  Incus container per subscription via an init script; the same allternit-api
  binary serves all three lanes (local desktop / user-paired BYO box /
  Allternit-provisioned). SQLite stays per-instance (decision D3).
- The existing VPS 8013 remains the company's own Desktop-Cloud control plane,
  not a user-facing surface.

Step 6's stop condition ("do not pick a routing option unilaterally") is satisfied;
the remaining P0 item before the proxy deploy is hardening 8013's CORS mirror-any-origin.

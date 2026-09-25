# P2 design seeds — gateway gap analysis items 10–12

> Session gwp1 (2026-09-25). These three P2 items are deliberately **not built** — each is
> conditional on a scaling trigger that has not fired. This document records the design seams
> so the future session that does build them starts from decisions, not discovery.
> Source: `Allternit Brain/Products/GatewayGapAnalysis.md` P2 list.

## P2.10 — Declarative config round-trip (policy-as-code) + deeper scopes

**Trigger:** more than one human manages routing policy, or a second environment (staging/prod) needs parity.

**Seam already in place:** `provider_routing.rs` reads policy from DB rows and exports Hermes YAML
(the console RoutingPolicyPage has a working export button). The missing half is **import**:
YAML → validate → diff → apply as a single transaction.

Design decisions to start from:
- Import is a **replace-with-diff-preview** admin endpoint (`POST /gateway/provider-routing/import`
  with `?dry_run=1` default), never a silent apply. The console page already surfaces resolve-preview;
  reuse it to preview an imported policy before commit.
- The Hermes six flat keys + per-model overrides table is the whole vocabulary — the YAML schema is
  already fixed by the export path. Import validates against the same serde types.
- Org→project→workload→model scopes: the DB key is `(tenant_id, model_pattern)`; adding scope depth
  is a **migration + resolution-order change**, not a new concept. Do it only when a real org asks;
  V181 (`org_route_credentials`) established the org-scope pattern to copy.

## P2.11 — Native-mode sorting engine in `provider_routing.rs`

**Trigger:** Fabric Runtime joins the gateway backend set (native model execution alongside proxied providers).

**Seam to leave alone until then:** provider selection today is static-chain + health cooldowns
(`failover.rs`). When native backends arrive, sorting needs cost/capability/locality signals that
don't exist yet. The seam: `select_fallback_healthy_at` already returns an *ordered* preference —
a future `sort_candidates(candidates, signals)` can slot in ahead of it without touching the retry loop.
Do not pre-build the signal plumbing; the cooldown tracker (`gateway_cooldowns`, V182) is the only
health signal worth keeping.

## P2.12 — CP/DP split

**Trigger:** admin-plane work measurably competes with request latency (p99 regressions traced to
admin queries on the same SQLite handle / process).

Today: single Rust data plane + admin API in one process — correct at this scale (gap analysis grades
Architecture B). The split when it fires: admin routes (`admin_routes.rs`) and the sweeps move behind
a separate listener/binary sharing the same SQLite file. V182 (`gateway_shared_state`) already proves
two processes can share gateway state through that file; the CP/DP split reuses exactly that mechanism.
No code now — the trigger is the spec.

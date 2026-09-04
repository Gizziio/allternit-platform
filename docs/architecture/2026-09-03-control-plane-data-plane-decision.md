# ADR: Single Public API — Control Plane / Data Plane Split

**Date:** 2026-09-03
**Status:** Decided (owner)
**Decides:** Execution Guide Step 6 of `reports/2026-09-03-production-readiness-gap-analysis.md` (blocker B3)
**Supersedes:** The "deploy allternit-api publicly as a second gateway" framing; the local/BYO lanes remain, but nothing user-facing talks to 8013 directly.

## Context

The web surfaces (`platform.allternit.com`, `ai.allternit.com`) call routes that live only on `allternit-api` (port 8013, SQLite, fabric/desktop-cloud) while their canonical client points at `api.allternit.com` (cloud-api, port 8082, Postgres), so those calls 404 in production. The audit listed three options: (a) second public gateway, (b) mount the routes into cloud-api, (c) feature-flag broken UI off.

The offering is BYOC + BYOK with a growing hosted lane. The owner's direction: cloud-api is the company's service for all users; the "local API" is a component users can run themselves — and, for paid subs, one the company provisions for them.

## Decision

**D1 — One public API.** `api.allternit.com` (cloud-api) is the only public API. Both web surfaces point solely at it. Nothing a browser calls may 404 because it lives behind the control plane.

**D2 — allternit-api becomes a data-plane runtime.** Same binary, three deployment modes:
1. **Local** — inside the Electron app on the user's machine (today's BYOC default).
2. **User-paired** — on the user's own VPS/box, registered to the control plane (extends `routes/runtime_pairing.rs` / `routes/mesh.rs`).
3. **Allternit-provisioned** — a per-sub container partitioned on fleet hosts (Incus), created by a startup/init script at provisioning time. This is the owner's "partition a VPS per sub" idea; it replaces any plan to host a shared central 8013 for user traffic. The existing VPS 8013 remains the company's own Desktop-Cloud control plane, not a user-facing surface.

**D3 — Per-customer instance = per-customer SQLite.** Each data-plane instance keeps its own SQLite file. No shared data-plane Postgres. Rationale: blast radius is one tenant, migrations move one small file, and a sub can be relocated to a bigger host by moving a container + file. This is a deliberate decision, not a default to revisit.

**D4 — Interim availability fix (now): nginx prefix routes.** Until D2's route migration lands, nginx on `mail` proxies the known 8013-owned prefixes (`/api/jobs`, `/api/v1/agent-sessions`, `/api/v1/office/`, `/api/v1/beta/`, `/api/rails/`) to `127.0.0.1:8013`; everything else stays on 8082. Verified: cloud-api defines **no** routes under those prefixes (its jobs live at `/api/v1/runs/:run_id/jobs`), so there is no shadowing. Snippet: `infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf`. Deploy is owner-gated; see verification list there.

**D5 — Web env strategy.** `VITE_ALLTERNIT_GATEWAY_URL` stays `https://api.allternit.com` in production. No second origin, no CORS split-brain. The localhost default in `api-client.ts:33` remains the desktop/tunnel fallback.

## Prior art (researched 2026-09-03)

**DevPod** ([what-is](https://devpod.sh/docs/what-is-devpod), [provider quickstart](https://devpod.sh/docs/developing-providers/quickstart)) — client-only CLI, no central server; workspaces are containers on any backend via a **provider contract**:
- `provider.yaml` declares lifecycle hooks as shell scripts: `init` (validate options/readiness), `create`/`delete`/`start`/`stop`/`status` (machine lifecycle), `command` (exec channel). `status` returns a small enum: Running / Busy / Stopped / NotFound.
- Options are injected as env vars; helper binaries are declared with per-OS checksums.
- An **agent is injected into the workspace** to phone home: auto-shutdown on inactivity, credential injection. DevPod never needs inbound ports to the workspace — the client reaches in.

**Adopted:** the lifecycle-hook shape (our provisioning service exposes init/create/delete/start/stop/status over the container/Incus backend), the small status enum for the fleet scheduler, agent-injected-into-instance that phones home (mirrors `runtime_pairing.rs` rather than opening inbound ports on shared fleet hosts), options-as-env for the per-sub init script.

**Not adopted:** DevPod's client-only, no-server model. We keep the control plane (cloud-api) — that *is* our product (auth, billing, BYOK, fleet accounting). DevPod also provisions per *workspace* on demand; we provision per *subscription* and keep the instance warm, which matches our per-minute desktop metering.

**OpenCode** — local `opencode serve` daemon plus a cloud that is deliberately a model/auth proxy, not user compute. Confirms keeping the local runtime a separate component is the norm for this product shape.

**E2B / Codespaces / Tailscale** — same topology one level down: one control-plane API, N isolated workers (microVMs / per-user containers / user-owned tailnet nodes). Our `mesh.rs` already follows Tailscale's "nodes stay user-owned" rule; the provisioned lane adds company-owned tagged nodes to the same mesh.

## Work list (updated, in order)

**P0 — interim availability (this week, owner-gated deploy)**
1. Deploy `infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf` on `mail`; verify with the curl set in that file (the five prefixes should reach 8013 — they will answer 401 until P1 auth lands, which is expected; confirm `/api/v1/runs/*` and `/api/v1/auth/me` still hit cloud-api).
2. ~~Enumeration pass~~ **Done 2026-09-03 (A4):** `/api/chat`, `/api/v1/sessions/:id/events`, `/api/v1/agents/:id/events`, `/api/v1/operator/events/*` exist on **neither** backend — orphaned client calls. Do not proxy; fix the client instead.
3. Harden 8013 before it is publicly reachable: replace the CORS mirror-any-origin with an allowlist (`platform.allternit.com`, `ai.allternit.com` origins calling `api.allternit.com`) and add rate limiting at nginx.
4. Feature-flag the console widgets that call the five proxied namespaces until their P1 control-plane handler lands, so users see a deliberate state instead of a 401.

**P1 — route migration (the real fix)**
4. Inventory the 8013 routes the console actually uses; add control-plane handlers in cloud-api for each. Handler contract: authenticate (Clerk session), resolve the caller's registered data-plane node, then proxy/queue — never assume localhost.
5. Node registry table in cloud-api Postgres: user → registered node(s) (local desktop, BYO box, provisioned container), health, last-seen. Reuse pairing/mesh where possible.
6. Flip web client one namespace at a time; retire the corresponding nginx prefix block as each lands. Delete the interim file when empty.

**P2 — per-sub provisioning (the scaling lane)**
7. Provisioning service (cloud-api service or sidecar) with the DevPod-style hook contract over Incus: create (partition + run init script that installs/configures allternit-api with a pairing token), start/stop/status (small enum), delete.
8. Init-script contract: token from the sub-provisioning flow, phone-home registration to cloud-api, mesh join (no inbound ports), SQLite under a per-instance data dir, backup timer per instance.
9. Fleet scheduling: pick a host with capacity; when a host fills, land new subs on the next host. Track per-minute metering against the instance.
10. ~~Decide isolation granularity~~ **Decided (A3):** per-sub containers for v1; per-org shared runtime is a later team-tier offering.

**P3 — cleanup**
11. Decommission direct 8013 exposure (nginx block + any public listener); 8013 listens on localhost/tailnet only.
12. Docs: `DEPLOYMENT_GUIDE.md` diagram updated to control-plane/data-plane; `byoc/overview.mdx` adds the provisioned lane as mode 3.

## Step 6 question — answered (owner, 2026-09-03)

The audit's Step 6 framing offered: **[1]** deploy allternit-api behind Cloudflare,
**[2]** mount routes into cloud-api, **[3]** feature-flag broken surfaces off.

**Answer: [2] as the destination, [1]'s mechanism as the interim — via [4].** Concretely:

- **Interim (this week):** use option [1]'s *mechanism* without its *architecture* —
  nginx on `mail` routes the five 8013-owned prefixes through the existing
  Cloudflare-fronted `api.allternit.com` to `127.0.0.1:8013` (snippet already
  prepared). No second hostname, no second public origin, no DNS work. The routes
  live somewhere real today.
- **Long-term:** option [2] — control-plane handlers in cloud-api with data-plane
  delegation (P1). This is the architecture the owner picked; everything else is a
  stopgap on the way there.
- **[1] rejected as an end-state:** it permanently forks the public API into two
  services, forces auth unification and hardening onto the weaker service, and
  splits origins/CORS. As a temporary routing measure it is fine; as a target it
  is the two-API split the audit graded C.
- **[3] rejected as the primary fix** — it darkens the jobs/sessions features that
  justify the platform. It stays in the toolbox: P0 item 4 feature-flags individual
  widgets only until their P1 handler lands, and as a rollback lever after deploys.
- **New evidence folded in:** production currently returns **401 for every path
  including cloud-api's own** — the auth layer runs before routing, so the gap is
  invisible to anonymous probes. Two consequences: (a) the interim proxy restores
  reachability, but proxied calls will still 401 until the P1 handlers + A1 auth
  exist — hence the P0 feature-flag; (b) auth (A1) is on the critical path, not a
  nice-to-have.

## Resolutions to the open questions (owner, 2026-09-03)

- **A1 — Auth model (decided).** Two-hop, no shared secrets, no Clerk keys off the
  control plane:
  1. Browser → cloud-api: Clerk session JWT only (unchanged).
  2. cloud-api → data-plane node: nodes accept calls **only** from cloud-api,
     enforced at the network layer (tailnet ACL tags; nodes phone home via the
     pairing flow — no inbound ports). cloud-api attaches a short-lived
     **data-plane JWT** (Ed25519, `aud = node-id`, `sub = user-id`, `exp` 5–15 min,
     scope) that the node verifies against cloud-api's public key fetched at
     startup. Nodes never see Clerk keys; users never see node credentials; static
     tokens (the dev-api-token pattern, audit B1) are replaced by this, not
     complemented — build mint/verify first, then remove the backdoor.
  3. Registration/pairing mints the node credential + node id (extends
     `runtime_pairing.rs`); the provisioned lane's init script receives a one-time
     pairing code from the provisioning service.
- **A2 — Chat path (decided, with evidence).** Enumeration shows `/api/chat` exists
  on **neither** backend (8013 serves `/api/agent-chat` and `/api/chat/action`;
  cloud-api serves none of them). Decision: **chat inference is control-plane
  work** — cloud-api's model router already owns inference pools, BYOK dispatch,
  and per-token metering. Actions: remove the dead `/api/chat` client call;
  repoint the console's chat at the model router; keep `/api/agent-chat` as the
  data-plane path for the local/desktop lane (where the user runs their own
  providers).
- **A3 — Isolation granularity (decided).** **Per-sub** containers for v1 — matches
  the existing per-minute metering, strongest abuse containment, simplest
  accounting. Add DevPod-style auto-stop on inactivity (stop after ~30 min idle,
  disk persists) to control fleet cost. Per-org shared runtime becomes a later
  team-tier offering when scheduling economics demand it.
- **A4 — Enumeration result (finding).** The four previously unverified client
  paths (`/api/chat`, `/api/v1/sessions/:id/events`, `/api/v1/agents/:id/events`,
  `/api/v1/operator/events/*`) are orphaned calls in `api-client.ts:690,778,942,1108`
  — they 401 today and would still 404-behind-auth if routed anywhere. Fix the
  client (delete or repoint to the real equivalents such as `/api/v1/agent-sessions`
  on 8013), do not add them to the proxy.
- **Provisioned-instance sizing (answered by default):** unprivileged Incus
  containers per sub; revisit VMs at the first noisy-neighbor incident.

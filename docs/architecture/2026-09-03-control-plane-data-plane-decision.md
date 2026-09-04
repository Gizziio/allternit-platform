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
1. Deploy `infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf` on `mail`; verify with the curl set in that file (expect non-404/405 for the five prefixes; confirm `/api/v1/runs/*` and `/api/v1/auth/me` still hit cloud-api).
2. Enumeration pass: crawl the web client for every path it calls (`api-client.ts` + views) and confirm each exists on 8082 or 8013. Known unverified: `/api/chat`, `/api/v1/sessions/:id/events`, `/api/v1/agents/:id/events`, `/api/v1/operator/events/*` — add to the proxy list only if they resolve on 8013.
3. Harden 8013 before it is publicly reachable: replace the CORS mirror-any-origin with an allowlist (`api.allternit.com`, `platform.allternit.com`, `ai.allternit.com`) and add rate limiting at nginx.

**P1 — route migration (the real fix)**
4. Inventory the 8013 routes the console actually uses; add control-plane handlers in cloud-api for each. Handler contract: authenticate (Clerk session), resolve the caller's registered data-plane node, then proxy/queue — never assume localhost.
5. Node registry table in cloud-api Postgres: user → registered node(s) (local desktop, BYO box, provisioned container), health, last-seen. Reuse pairing/mesh where possible.
6. Flip web client one namespace at a time; retire the corresponding nginx prefix block as each lands. Delete the interim file when empty.

**P2 — per-sub provisioning (the scaling lane)**
7. Provisioning service (cloud-api service or sidecar) with the DevPod-style hook contract over Incus: create (partition + run init script that installs/configures allternit-api with a pairing token), start/stop/status (small enum), delete.
8. Init-script contract: token from the sub-provisioning flow, phone-home registration to cloud-api, mesh join (no inbound ports), SQLite under a per-instance data dir, backup timer per instance.
9. Fleet scheduling: pick a host with capacity; when a host fills, land new subs on the next host. Track per-minute metering against the instance.
10. Decide isolation granularity: per-sub vs per-org containers (billing and abuse profile differ).

**P3 — cleanup**
11. Decommission direct 8013 exposure (nginx block + any public listener); 8013 listens on localhost/tailnet only.
12. Docs: `DEPLOYMENT_GUIDE.md` diagram updated to control-plane/data-plane; `byoc/overview.mdx` adds the provisioned lane as mode 3.

## Open questions

- **Auth across the proxy:** which 8013 routes accept what token today, and what should the control plane mint for data-plane calls? (Audit B1/backdoor work touches the same auth layer — sequence them.)
- **Chat path:** is `/api/chat` supposed to be served by cloud-api (model router) or by the data plane? Affects whether the console's chat is control-plane or data-plane compute.
- **Provisioned-instance sizing:** Incus container vs VM per sub; containers are cheaper, VMs isolate kernels. Start with unprivileged containers, revisit at first noisy-neighbor incident.

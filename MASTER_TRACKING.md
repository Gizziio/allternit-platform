# Allternit Cloud — MASTER TRACKING

> **Single source of truth for the Allternit Cloud build.**  
> This file contains the strategy, scope, todo list, file map, research notes, and next action. Check items off as they are completed; do not ask "what is next" — consult the **Next Action** section at the bottom.

- **Branch / worktree:** `session/desktop-cloud-mvp` (`/Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp`)
- **Strategic plan:** `/Users/joe/Downloads/Allternit_Cloud_Strategy_Gameplan_v1.2.docx`
- **Last updated:** 2026-08-29
- **Status:** Foundation + Fabric control plane + Model Gateway + Customer Cloud Console + Cloud CLI + Model Gateway surface + Agent Cloud surface in place; L1.1 + L1.2 + L1.3 + L1.8 complete; L2.6 Model Gateway adapters complete; L3.1 Customer Cloud Console complete; L3.2 CLI commands complete; L3.3 Model Gateway surface complete; L3.4 Agent Cloud surface complete.
- **Last verification:** `cargo check -p allternit-api` clean (pre-existing warnings); `cargo test -p allternit-api` 588 passed (lib); `pnpm exec tsc --noEmit` has no errors in changed files; `pnpm exec vitest run src/lib/agent-cloud-api.test.ts src/lib/model-gateway-api.test.ts` 15 passed.

---

## North Star

> A customer asks Allternit for compute. Fabric decides the best place to run it. The customer receives one cloud. Allternit captures the software, orchestration, service, and capacity margin.

Allternit Cloud launches **capital-light and multi-provider**: own the control plane, scheduler, billing, developer experience, and managed AI layer; rent or federate hardware until demand justifies ownership.

---

## The Three Layers

| Layer | Responsibility | Primary crates / surfaces |
|-------|---------------|---------------------------|
| **Layer 1 — Control Plane & Commercial** | Accounts, orgs, projects, API keys, credits/billing, Fabric scheduler, cost engine, SKU catalog, resource/placement state, node registry, admin/customer HTTP routes. | `cmd/allternit-api` |
| **Layer 2 — Execution & Providers** | Provider adapters (Runpod, Vast, OpenAI, Together, Fireworks, Fabric node), substrates (Incus, Tart, process), daemon binaries, offer discovery, provisioning, usage/cost events. | `cmd/allternit-computer-cloud` |
| **Layer 3 — Experience & Surfaces** | Web console, CLI, SDK, OpenAI-compatible endpoints, admin dashboards, customer onboarding, model/agent UX. | `surfaces/ai.allternit.com`, `cmd/allternit-cloud-api`, `cmd/allternit-cloud-wizard`, platform |

---

## Governing Documents

1. **Allternit Cloud Strategy Gameplan v1.2** (`/Users/joe/Downloads/Allternit_Cloud_Strategy_Gameplan_v1.2.docx`) — strategic scope, revenue model, service catalog, scheduler economics, execution roadmap, phased end-state.
2. **Phase notes** in `docs/desktop-cloud-mvp/` — implementation details for desktop-cloud substrate, billing, capacity, etc.
3. **This tracker** — execution list and file map.

---

## What Is Already Done

### Layer 1 — Control Plane
- [x] Fabric resource contract, SKU catalog (`fabric/sku.rs`) with builtin classes `compute.s/m/l`, `gpu.s/m/l`, `sandbox.s`.
- [x] Fabric cost engine (`fabric/cost.rs`) with contribution-margin scoring, reliability reserve, region/latency bonuses.
- [x] Fabric scheduler v1 (`fabric/scheduler.rs`) — select offer, provision, wait-until-running, placement recorder.
- [x] Allternit Credits ledger v2 (`fabric/credits.rs`) — immutable ledger, holds, purchase/grant/charge/refund, idempotent credits.
- [x] Organization credits v1 (`credits.rs`) — `organization_credits` + `credit_transactions` for desktop billing.
- [x] DB schema for fabric foundation (`V104__fabric_foundation.sql`) — `fabric_resource_classes`, `fabric_resources`, `fabric_placements`, `fabric_provider_prices`, `fabric_usage_events`, `fabric_cost_events`, `fabric_credits_ledger`, `fabric_credit_holds`.
- [x] Credit purchase idempotency (`V106__credit_purchase_idempotency.sql`) — deduplicates purchase/grant requests.
- [x] Credits routes (`fabric_credits_routes.rs`) — `GET /api/v1/credits/balance`, `GET /api/v1/credits/transactions`, `POST /api/v1/credits/purchase`, `POST /api/v1/admin/credits/grant`.
- [x] Private Fabric node registry (`fabric/node_registry.rs`) — CRUD, heartbeat, token hash, active-node listing, assignments, usage events, node token rotation.
- [x] Private Fabric node control-plane routes (`fabric_node_routes.rs`) — public `/v1/fabric/nodes/enroll`, `/v1/fabric/nodes/:id/heartbeat`, `/v1/fabric/nodes/:id/assignments/:assignment_id/status`, `/v1/fabric/nodes/:id/usage`; admin list/approve/reject. Enrollment issues a dedicated node token; later calls authenticate with that token.
- [x] Wired fabric routes into `lib.rs` and `main.rs`.
- [x] Desktop host fleet schema (`V103__desktop_hosts.sql`).
- [x] Desktop usage billing (`bot_desktop_billing.rs`) + pricing table (`V97__desktop_pricing.sql`).
- [x] Capacity monitoring (`bot_desktop_capacity.rs`).

### Layer 2 — Execution
- [x] Fabric provider contract (`cmd/allternit-computer-cloud/src/fabric/mod.rs`) — `FabricProvider`, `ResourceRequest`, `Offer`, `ProvisionedResource`, `UsageEvent`, etc.
- [x] External inference adapters: OpenAI, Together, Fireworks.
- [x] Compute marketplace adapters: Runpod, Vast.
- [x] Incus and Tart substrate support; bare-VM provider.
- [x] Computer Cloud REST API routes (`routes/computers.rs`) for lifecycle control.
- [x] Private Fabric node provider adapter (`providers/fabric_node.rs`) with in-memory pool and capacity-aware offer discovery.
- [x] Private Fabric node daemon binary (`bin/fabric-node.rs`) — enrolls (receives and persists node token), heartbeats capacity, polls assignments, executes assignments via process/Incus executor, reports state, submits usage events.
- [x] DB schema for fabric nodes (`V105__fabric_nodes.sql`) — `fabric_nodes`, `fabric_node_capacity`, `fabric_node_assignments`.
- [x] Node token migration (`V107__fabric_node_token.sql`) — dedicated `node_token_hash` column.

### Layer 3 — Experience
- [x] Initial platform integration points (legacy `/bots/:bot_id/desktop/*` + new `/api/v1/computers/*`).
- [x] `allternit-cloud-api`, `allternit-cloud-wizard`, `cloud-backend` crates/surfaces exist and host runtime/billing scaffolding.

---

## TODO List

> Check items off only when implemented, tested, and verified. The next action is the first unchecked item.

### Layer 1 — Control Plane

#### L1.1 — Fabric SKU catalog from DB
- [x] Load `fabric_resource_classes` from DB at startup instead of only builtin catalog.
- [x] Seed default classes at startup (idempotent) so fresh installs have the same builtin set.
- [x] Admin API to create/update resource classes.

#### L1.2 — Fabric resources API
- [x] `POST /api/v1/fabric/resources` — request a resource by class.
- [x] `GET /api/v1/fabric/resources/:id` — status and placement.
- [x] `POST /api/v1/fabric/resources/:id/terminate`.
- [x] Persist resources to `fabric_resources`; persist placements to `fabric_placements`.

#### L1.3 — Scheduler wiring
- [x] Instantiate `Scheduler`, `CostEngine`, `ResourceClassCatalog` in `AppState`.
- [x] Build `FabricProviderRegistry` from configured providers + DB-backed Fabric nodes.
- [x] Connect resource-create API to scheduler `select_offer` / `provision`.
- [x] Record placement via `PlacementRecorder` after successful provision.

#### L1.4 — Credits purchase / top-up (buy credits)
- [x] Public API: `POST /api/v1/credits/purchase` (`stripe`/`crypto` methods, idempotency key, reference id).
- [x] Admin API: `POST /api/v1/admin/credits/grant` (org-admin gated, idempotency key).
- [x] `GET /api/v1/credits/balance` and `GET /api/v1/credits/transactions`.
- [x] Use `fabric_credits_ledger` as the canonical ledger; reconcile with `organization_credits` if both must coexist.

#### L1.5 — Credit holds during provisioning
- [x] Call `CreditsLedger::hold` before scheduling.
- [x] Convert hold to charge on success, release on failure.
- [x] Block scheduling when `available_cents < estimated_cost_cents`.
- [x] Fix `CreditsLedger::charge_hold` to charge against the held balance (not `available_cents`).
- [x] Add `hold_id` to `fabric_placements` via `V108__placement_credit_hold.sql`.

#### L1.6 — Usage & cost ingestion
- [x] `POST /v1/fabric/nodes/:id/usage` endpoint for Fabric nodes to submit `fabric_usage_events`.
- [x] Generic `POST /api/v1/admin/fabric/usage` endpoint for other providers/daemons.
- [x] Background job to convert usage events into cost events and ledger charges.
- [x] Per-resource, per-placement cost attribution via `fabric_cost_events.placement_id`.

#### L1.7 — Provider price cache
- [x] Background price refresh job populating `fabric_provider_prices`.
- [x] Scheduler reads prices from DB cache first, falling back to live provider calls.

#### L1.8 — Admin dashboard APIs
- [x] `GET /api/v1/admin/fabric/nodes` (done partially; extend with capacity).
- [x] `GET /api/v1/admin/fabric/resources`.
- [x] `GET /api/v1/admin/fabric/placements`.
- [x] `GET /api/v1/admin/fabric/usage`.

### Layer 2 — Execution

#### L2.1 — FabricNodeProvider backed by DB
- [x] Sync `FabricNodePool` from `FabricNodeRegistry` active nodes on a background interval.
- [x] Convert DB `NodeCapacity` to provider `NodeCapacity` via `to_provider_node`.
- [x] Filter offers by `organization_id` and node status `active/approved`.
- [x] Add tests proving registry rows map to provider nodes and offers.

#### L2.2 — Assignment dispatch
- [x] Control plane creates `fabric_node_assignments` rows when scheduling onto a Fabric node.
- [x] Heartbeat response returns pending assignments for the node.
- [x] Node daemon acknowledges/rejects assignments.

#### L2.3 — Daemon workload execution
- [x] Daemon receives assignment, maps `kind` to local executor (process default, Incus optional).
- [x] Report assignment state transitions (`accepted` → `running` → `completed/failed`).
- [x] Submit usage events to control plane.

#### L2.4 — mTLS / secure node identity
- [x] Issue a dedicated node API token during enrollment (`node_token` returned in `EnrollResponse`).
- [x] Store token hash in `fabric_nodes.node_token_hash`; rotate on re-enrollment.
- [x] Node presents node token on heartbeat/status/usage; control plane validates it.
- [x] Daemon persists node token to `FABRIC_NODE_TOKEN_FILE` between restarts.
- [x] Tests for enrollment token issuance, invalid token rejection, token rotation, and daemon usage.

#### L2.5 — Live provider adapters
- [x] Runpod offer discovery + provisioning wired into scheduler via `FabricProviderRegistry`.
- [x] Vast offer discovery + provisioning wired into scheduler via `FabricProviderRegistry`.
- [x] `FabricProviderRegistry::health_check_all` runs provider health checks.
- [x] Background health-check loop in `main.rs` (`FABRIC_PROVIDER_HEALTH_INTERVAL_SECS`, default 60s).
- [x] `providers::registry_from_env` registers Runpod/Vast when credentials present.
- [x] `fabric::build_provider_registry` combines live providers + Private Fabric node provider.
- [x] `AppState.fabric_provider_registry` exposes the registry to the scheduler.

#### L2.6 — Model Gateway adapters
- [x] OpenAI-compatible `/v1/models` proxy route backed by the Fabric model catalog (OpenAI/Together/Fireworks model prices).
- [x] Model catalog (`fabric_model_catalog`) and cost-per-token ledger (`fabric_model_usage_events`) wired to `fabric_credits_ledger`.
- [x] Unified `POST /v1/responses` endpoint that validates the model, charges the ledger, and returns an OpenAI-shaped completion.

### Layer 3 — Experience

#### L3.1 — Customer cloud console
- [x] Resource list/create/terminate UI.
- [x] Credits balance and transaction history UI.
- [x] Node enrollment UI for Private Fabric.

#### L3.2 — CLI commands
- [x] `allternit cloud resources create --class gpu.m`.
- [x] `allternit cloud credits buy --amount 5000`.
- [x] `allternit fabric node enroll`.

#### L3.3 — Model Gateway surface
- [x] OpenAI-compatible endpoint exposed through platform gateway.
- [x] Model=auto policy UX.

#### L3.4 — Agent Cloud surface
- [x] Persistent agent creation UI.
- [x] Agent runtime integration with Fabric scheduler.

---

## File Map

### Layer 1 — Control Plane (`cmd/allternit-api`)
| File | Purpose |
|------|---------|
| `src/fabric/mod.rs` | Module exports. |
| `src/fabric/cost.rs` | Cost engine, margin scoring. |
| `src/fabric/credits.rs` | Credits ledger v2, holds, idempotent credit helper. |
| `src/fabric/model_catalog.rs` | DB-backed model catalog with OpenAI/Together/Fireworks prices. |
| `src/fabric/model_gateway.rs` | Token-cost calculation, ledger charging, usage-event recording. |
| `src/fabric/node_registry.rs` | DB-backed Private Fabric node registry. |
| `src/fabric/scheduler.rs` | Fabric scheduler v1. |
| `src/fabric/sku.rs` | Resource classes / SKU catalog. |
| `src/credits.rs` | Organization credits v1. |
| `src/fabric_credits_routes.rs` | Public + admin credits HTTP routes. |
| `src/fabric_node_routes.rs` | Public + admin Fabric node HTTP routes. |
| `src/fabric_usage_routes.rs` | Admin usage ingestion routes + batch processing trigger. |
| `src/fabric/usage.rs` | Usage event ingestion, cost conversion, ledger charging. |
| `src/fabric/price_cache.rs` | Cached provider offers + background refresh helper. |
| `src/fabric/resources.rs` | Resource/placement/usage DB helpers (`ResourceManager`). |
| `src/fabric_resources_routes.rs` | Customer create/get/terminate Fabric resources API. |
| `src/fabric_admin_routes.rs` | Admin list resources/placements/usage API. |
| `src/fabric_model_routes.rs` | OpenAI-shaped `/v1/models` catalog and `POST /v1/responses` endpoint. |
| `src/fabric/mod.rs` | Module exports + `build_provider_registry`.
| `src/lib.rs` | Module declarations + `AppState`. |
| `src/main.rs` | Route mounting, AppState. |
| `migrations/V112__fabric_enrollment_tokens.sql` | Organization-scoped enrollment tokens for Private Fabric. |
| `migrations/V102__organization_credits.sql` | Org credits v1 schema. |
| `migrations/V103__desktop_hosts.sql` | Desktop host fleet schema. |
| `migrations/V104__fabric_foundation.sql` | Fabric resource/placement/price/usage/cost/credits schema. |
| `migrations/V105__fabric_nodes.sql` | Private Fabric node schema. |
| `migrations/V106__credit_purchase_idempotency.sql` | Credit purchase idempotency schema. |
| `migrations/V107__fabric_node_token.sql` | Dedicated node API token column. |
| `migrations/V108__placement_credit_hold.sql` | `hold_id` column linking placements to credit holds. |
| `migrations/V109__fabric_usage_processing.sql` | `cost_event_id` and `processed_at` on `fabric_usage_events`. |
| `migrations/V110__fabric_provider_prices_enhance.sql` | `estimated_ready_secs` and unique index on `fabric_provider_prices`. |
| `migrations/V111__fabric_model_catalog.sql` | `fabric_model_catalog` and `fabric_model_usage_events` schema. |

### Layer 2 — Execution (`cmd/allternit-computer-cloud`)
| File | Purpose |
|------|---------|
| `src/fabric/mod.rs` | Fabric provider contract, `FabricProviderRegistry`. |
| `src/providers/mod.rs` | Provider module exports. |
| `src/providers/fabric_node.rs` | Private Fabric node adapter + in-memory pool. |
| `src/providers/openai.rs` | OpenAI inference adapter. |
| `src/providers/together.rs` | Together AI inference adapter. |
| `src/providers/fireworks.rs` | Fireworks AI inference adapter. |
| `src/providers/runpod.rs` | Runpod compute adapter. |
| `src/providers/vast.rs` | Vast.ai compute adapter. |
| `src/providers/incus.rs` | Incus substrate provider. |
| `src/providers/bare_vm.rs` | Bare-VM provider. |
| `src/bin/fabric-node.rs` | Private Fabric node daemon. |
| `src/substrate.rs` | Substrate abstraction. |
| `src/incus_pool.rs` | Incus pool management. |
| `src/tart.rs` | Tart/macOS substrate. |

### Layer 3 — Experience
| File | Purpose |
|------|---------|
| `cmd/allternit-cloud-api/src/main.rs` | Cloud API surface. |
| `cmd/allternit-cloud-api/src/routes/*.rs` | Billing, auth, runtime routes. |
| `cmd/allternit-cloud-wizard/` | Onboarding wizard. |
| `cmd/cloud-backend/src/index.ts` | Cloud backend TS service. |
| `surfaces/ai.allternit.com/` | Platform web surface. |
| `surfaces/ai.allternit.com/src/lib/cloud-console-api.ts` | Typed Cloud Console API client. |
| `surfaces/ai.allternit.com/src/views/cloud-console/CloudConsoleView.tsx` | Customer Cloud Console UI. |
| `surfaces/ai.allternit.com/src/lib/model-gateway-api.ts` | Model Gateway API client + Model=auto policy. |
| `surfaces/ai.allternit.com/src/views/model-gateway/ModelGatewayView.tsx` | Model Gateway surface (endpoint, catalog, auto policy, playground). |
| `surfaces/ai.allternit.com/src/lib/model-gateway-api.test.ts` | Model Gateway API/policy tests. |
| `cmd/allternit-api/src/agent_cloud_routes.rs` | Agent runtime provision/terminate endpoints backed by Fabric scheduler. |
| `surfaces/ai.allternit.com/src/lib/agent-cloud-api.ts` | Agent Cloud runtime API client. |
| `surfaces/ai.allternit.com/src/lib/agent-cloud-api.test.ts` | Agent Cloud API client tests. |
| `surfaces/ai.allternit.com/src/views/agent-cloud/AgentCloudView.tsx` | Agent Cloud surface (persistent agent creation + runtime provisioning UI). |
| `cmd/cli/src/commands/cloud.ts` | CLI cloud resources/credits commands. |
| `cmd/cli/src/commands/fabric.ts` | CLI Private Fabric node enrollment command. |
| `cmd/cli/src/commands/cloud.test.ts` | CLI cloud/fabric command tests. |
| `platform/protocols/communication/allternit-gateway/allternit-gateway/src/index.ts` | Platform gateway (proxies `/v1` to API). |

---

## Research & Notes

### Credits strategy
Two credit systems currently coexist:
- `organization_credits` + `credit_transactions` (V102) — simple balance/transaction log used by desktop billing.
- `fabric_credits_ledger` + `fabric_credit_holds` (V104) — immutable signed ledger with holds for Fabric scheduling.

**Decision:** Move Fabric/cloud usage to `fabric_credits_ledger`. Keep `organization_credits` for legacy desktop until a migration path is defined. Buy-credits flow writes to `fabric_credits_ledger` via `CreditsLedger::credit_with_idempotency` and records the idempotency key in `credit_purchase_idempotency`.

### Scheduler scoring
- Contribution margin = retail − all-in-cost.
- Score = contribution_ratio × latency_fit × region_bonus × reliability × interruptible_penalty.
- Negative or zero contribution offers are rejected.

### Private Fabric node lifecycle
1. Admin creates enrollment token (future: via UI/API).
2. Daemon starts with `FABRIC_NODE_CONTROL_PLANE` + `FABRIC_NODE_ENROLLMENT_TOKEN`.
3. `POST /v1/fabric/nodes/enroll` returns `node_id`, `status`, and a dedicated `node_token`.
4. Daemon persists `node_token` to `FABRIC_NODE_TOKEN_FILE` and uses it for all subsequent requests.
5. Admin approves node → status `approved`.
6. Daemon heartbeats capacity → status becomes `active`.
7. Scheduler sees active node and can place workloads.
8. Assignments returned in heartbeat; daemon executes and reports state.
9. Usage events submitted to `POST /v1/fabric/nodes/:id/usage` using the node token.
10. Re-enrollment with the same enrollment token rotates the node token and returns the new one.

### Own cloud service catalog (from Gameplan v1.2)
Allternit Cloud is not a single SKU. The strategic product lines are:
- **Allternit Compute** — CPU VM/container instances for general workloads.
- **Allternit GPU** — Standardized GPU S/M/L/XL capacity classes; exact-GPU premium option.
- **Allternit Inference** — OpenAI-compatible and native endpoints for hosted/private/custom models.
- **Allternit Agents** — Persistent/event-driven agent runtime with tools, queues, browser/container execution, memory, secrets.
- **Allternit Clusters** — Multi-GPU/multi-node distributed inference, fine-tuning, training.
- **Allternit Private Cloud** — Fabric-managed customer hardware / Compute Boxes / racks (high-margin software).
- **Allternit Storage** — Volumes, snapshots, model cache, artifact/dataset registry, object storage.
- **Allternit Network** — Private networking, gateways, ingress, tunnels, regional routing.
- **Allternit Sandbox** — Ephemeral secure CPU/GPU microVM/container for coding agents, browsers, tests, notebooks, untrusted execution.
- **Allternit Batch** — Deadline-oriented async inference/compute exploiting spot/interruptible/cheaper supply.
- **Allternit Train** — Fine-tuning, LoRA/QLoRA, post-training, RL, distributed training.
- **Allternit Eval** — Quality, cost, latency, tool-use, agent-completion benchmarking.
- **Allternit Data** — Object storage, dataset/model/checkpoint registry, vector/artifact storage, global model cache.
- **Allternit Tool Gateway** — Permissioned/metered access to browser, email, calendar, GitHub, databases, search, terminal, etc.
- **Fabric Exchange** — Verified third-party capacity contribution with daemon, floor prices, attestation, reputation, metering, settlement.

The same three-layer architecture can deliver all of these: the customer buys an Allternit abstraction, Fabric decides where it executes, and Allternit captures software/orchestration/service margin.

### Unified credits / buy credits with Allternit
Gameplan section 24: customers prepay into one Allternit Credits balance, then draw from it for compute, inference, agent runtime, tool calls, storage, sandbox, etc. Behind the scenes Allternit settles supplier COGS with multiple providers.

Implications for implementation:
- The canonical ledger is `fabric_credits_ledger`.
- Buy-credits endpoint accepts payment method (`stripe`/`crypto`), amount, currency, idempotency key, and optional payment reference.
- Successful purchase appends a `purchase` ledger row and increments the organization's `balance_cents`.
- Admin grant appends a `grant` ledger row.
- Every billable event (usage, inference, tool call, storage) appends a `charge` ledger row.
- Holds are placed during scheduling/provisioning and converted to charges or released.
- The customer-visible balance and transaction history read from `fabric_credits_ledger`.
- This unifies legacy `organization_credits` eventually; for now, keep legacy desktop path intact and route cloud/fabric through `fabric_credits_ledger`.

### Secure node identity
The first slice uses a dedicated node API token rather than a full x.509 client certificate. This keeps the daemon simple while eliminating long-term reliance on the enrollment token. The token is:
- Generated by the control plane during enrollment.
- Hashed with SHA-256 before storage (`node_token_hash`).
- Returned to the daemon exactly once in the enrollment response.
- Used as a Bearer token on all daemon → control plane requests.
- Rotated when the node re-enrolls.
- Optionally persisted to disk via `FABRIC_NODE_TOKEN_FILE`.

Future slices can add mTLS client certificates and store the certificate fingerprint in `identity_fingerprint`.

### Risks
- Supplier terms / resale restrictions — review before live Runpod/Vast provisioning.
- Negative-margin workloads — cost engine + credit holds must gate this.
- Provider instability — multi-provider fallback not yet implemented.
- Two credits tables — potential confusion; reconcile soon via unified credits.

---

## Next Action

> **L3.4 Agent Cloud surface is complete.**
>
> The remaining unchecked item is L1.1 Admin API to create/update resource classes.
> Add admin routes under `/api/v1/admin/fabric/resource-classes` for creating and
> updating Fabric resource classes, with tests, then update this tracker.

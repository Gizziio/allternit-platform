# Bridge Spec — Agent Runner ↔ Rails Runner (v2)

This version reconciles the previously-defined bridge with the actual Rails spec in `/mnt/data/allternit-agent-system-rails.zip`.

## 0) Non-negotiable separation

- **Rails (control plane):** ledger truth, gates, leases, receipts/vault, idempotent pipelines, bounded mail.
- **Agent Runner (execution plane):** prompt packs, policy injection, context packs, worker orchestration, Ralph loop, compaction, observability.

Agent Runner must **never** write canonical state outside Rails.

---

## 1) Bridge interface primitives

### 1.1 Rails → Runner: “execute this work item”
A single canonical request type should be sufficient:

- `WorkRequestCreated`
  - refs: dag_id, node_id, wih_path
  - role: builder|validator|planner|reviewer|security
  - execution_mode: PLAN_ONLY|REQUIRE_APPROVAL|ACCEPT_EDITS|BYPASS_PERMISSIONS
  - required_gates: list
  - required_receipts: list (by type)
  - lease_requirements: paths/tools required (if known)

### 1.2 Runner → Rails: “claim / start / evidence / outcome”
- `WorkRequestClaimed`
- `WorkIterationStarted`
- `ReceiptRecorded` (or Rails-native “receipt register” command)
- `WorkIterationCompleted`
- `WorkIterationBlocked`
- `WorkIterationEscalated`

All events must be idempotent (Rails replays them without double transitions).

---

## 2) Lease + gate interplay (critical)

### 2.1 Lease acquisition
Runner must request leases from Rails prior to:
- any write-like tool call
- any task that could mutate repo state

### 2.2 Gate checks
Runner must call Rails gate endpoints:
- **before** committing any mutation (pre-write)
- **after** producing artifacts (validator gates)

---

## 3) Receipts and evidence (durable truth)

Runner produces evidence; Rails stores it.

Minimum receipts Runner must always submit:
- policy injection marker (agents_md hash + pack ids + method version)
- tool-call receipts (pre/post tool use: args hash + output hash + affected paths)
- validator report receipt (PASS/FAIL + bounded fix list)
- context pack seal receipt (context_pack_id + inputs + hashes)
- compaction receipt (event slice + method version + summary artifact ref)

---

## 4) Mail scope
Rails “mail” should be treated as a **bounded transport**:
- only structured messages with correlation IDs
- no freeform chat state as truth
- mail messages can reference context packs / receipts

Runner can implement richer multi-transport busses, but only mail messages that affect control-plane state should be bridged into Rails.

---

## 5) Where the shared `.allternit/` directory fits

### 5.1 Shared on-disk contract
`.allternit/` is a shared boundary directory, but not automatically authoritative.

**Rule:**
- Rails-owned authoritative state must be **append-only** and validated.
- Runner may cache derived state, but any “truth” must be backed by Rails ledger/vault.

### 5.2 Suggested split
- `.allternit/rails/**` (ledger projections, leases snapshots, gate configs; owned by Rails)
- `.allternit/runner/**` (context packs, prompt packs index, compaction artifacts; owned by Runner)
- `.allternit/shared/**` (WIH/DAG inputs, policies; shared but with ownership metadata)

---

## 6) Minimal bridge MVP (non-overlapping with Rails)

Given Rails already implements a deterministic pipeline, the **bridge MVP** is:

1. Rails emits `WorkRequestCreated` (WIH + DAG node refs).
2. Runner claims it idempotently.
3. Runner builds ContextPack (policy injection + receipts slice).
4. Runner spawns Builder or Validator worker.
5. Runner logs tool events; submits receipts to Rails.
6. Rails gates decide advance/block; Rails remains the truth.

This adds value without duplicating Rails.


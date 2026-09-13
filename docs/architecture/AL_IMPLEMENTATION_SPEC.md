# Al Implementation Spec

**Status:** Mostly **Specified / Planned**. Al is defined by the contract
(§12 of `A_PROTOCOL.md`, §1–2 of `COWORK_A_PROTOCOL_ARCHITECTURE.md`) but has
**no dedicated implementation in the runtime yet** — no `al` principal is
registered by default, no Al service, no Al prompt lives in this repo's
runtime. This document separates what Al *does* in code today from what this
spec *defines* for the build-out.

Companion: `BOT_AUTHORING_SPEC.md`, `GIZZI_WORKER_SPEC.md`.

---

## 1. Identity

```text
principal: a://workspace/{workspace}/principal/al
roles: [orchestrator, user-interface]
pronunciation: "Al"; branded mark A://
```

- **Implemented (identity):** boot seeding mints
  `a://workspace/{ws}/principal/al` for every known workspace, idempotently
  (`sqlite_store::seed_default_principals`, wired in `main.rs`; roles column
  V162). Al carries roles `[orchestrator, user-interface]` and **no
  capabilities** — Al's power is delegation, not execution. The credential is
  provisioned separately, exactly once:
  `POST /api/v1/fabric/transport/principals/:id/provision-token` (user auth).
- **Still Planned:** the Al orchestration loop (see §7) and the persona
  runtime binding.

## 2. What Al owns

| Asset | Owns? | Grounding / status |
|---|---|---|
| Orchestration decisions (which worker, what plan) | **Yes** | Spec. Today: the user (or API client) picks workers directly; no planner component runs as Al. |
| Conversational continuity | **Yes** | Partial. Chat/session substrates exist (`cowork` chat, gizzi sessions) but none is bound to the Al principal. |
| The run it created | **The run record, not the execution** | Implemented substrate: `cowork_runs.initiator`/`delegator` columns (V154). A run Al delegates records `delegator = a://…/principal/al`; the executor column still names the actual worker. |
| Its own memory scope | **Yes, scoped** | Spec. No principal-scoped memory enforcement exists yet (Bot spec §7). |
| Connector credentials | **No** | Invariant (§8.5): brokered sessions only; Al holds no raw secrets. Broker: Planned. |
| Worker memories | **No** | Invariant: bots' memory scopes are independent; Al reads only what policy grants. |
| Execution authority | **No** | Invariant: Al cannot complete a job; only the lease-holding executor can (`complete_job` validates `lease_owner`, `sqlite_store.rs`). |
| Audit attribution | **No** | Invariant: Al appears as initiator or delegator, never as executor of work it did not perform (`transport.rs` attribution rules; conformance tests assert the triple). |

## 3. Orchestration policy

**Spec:**

1. Receive intent → normalize toward the IntentEnvelope (envelope itself: Planned, `A_PROTOCOL_SCHEMA.md` §9).
2. Plan/decompose → choose workers by role + capability eligibility + risk policy (never by model confidence alone).
3. Create the run with `initiator = user`, `delegator = a://…/principal/al` (both columns exist, V154).
4. Monitor canonical run/job state; request approval for protected actions on the user's behalf — the binding's executor is the *worker*, decided_by the *user*; Al never self-approves.
5. Report results from the committed Result object, never from model recollection.

**Today:** steps 3's schema, the approval binding machinery, and the result
envelope exist; the Al *agent loop* that performs 1–5 does not. A user driving
the API directly gets steps 3–5 minus the persona.

## 4. Delegation rules

- Delegation is a role, not a security root (§3 of the architecture doc):
  other principals may orchestrate; Al is the default UX, not a mandatory
  ancestor. The schema does not enforce a delegation chain column — causation
  chains are **Specified / Planned** (`causation_chain`, depth ≤ 4, cycle
  rejection are contract §8.15; not enforced in code).
- Delegation must not transfer credentials or permissions (§11): the
  transport enforces the executor side — a delegated worker claims only with
  its own token and capabilities.
- Sub-delegation attributes correctly: `initiator = user, delegator = the
  delegating bot, executor = the sub-worker` (§8.18; asserted in the
  conformance suite's attribution checks).

## 5. The never-inherit list (§12) — normative for the build-out

Al MUST NOT automatically become: executor of every action; owner of every
credential; universal memory bucket; single mandatory message queue; the only
allowed orchestrator. Any feature that silently makes Al one of these is
non-conformant regardless of convenience.

## 6. Reach vs control surfaces

Reach surfaces (desktop, mobile, Slack, email, terminal, API, voice) talk *to*
Al. Cowork is the control room and must render canonical state (run/job rows,
leases, bindings, attributed events) independently of Al's narration
(§6/§15 of the architecture doc; state projection rules in
`COWORK_RUNTIME_STATE_MACHINES.md` §4).

## 7. What to build next (sequenced)

1. ~~Workspace provisioning mints the Al principal~~ **Done** (boot seeding).
2. Orchestration-role checks in policy evaluation (roles exist; enforcement Planned).
3. ~~Al orchestration loop~~ **Done (v0.1, deterministic)** — an
   orchestrator tick loop (`main.rs`, 2s) processes intents targeted at
   `principal/al`: resolves the delegation target from
   `cowork_delegation_rules` (V166; action-type prefix, priority-ordered),
   submits the child intent with the chain extended by Al, writes attributed
   `delegation.created` / `delegation.rejected` events, monitors the child
   run to terminal, mirrors the state onto the parent run, and records
   `delegation.completed` / `delegation.failed`. No model involvement.
   (`test_al_orchestration_loop`.)
4. ~~Principal-scoped memory grants~~ **Done** (V165; owner+grants with
   default-deny — `test_memory_principal_grants`). Persona-level memory
   continuity for Al remains product work.
5. ~~Causation chain column + depth/cycle enforcement~~ **Done** (V164).

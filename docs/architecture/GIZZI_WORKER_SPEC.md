# Gizzi Worker Spec

**Status:** Mixed. Gizzi is a real, shipped codebase (`cmd/gizzi-code`); its
identity and lease-boundary contracts below are **Specified / Planned** where
marked. Grounded citations throughout.

Companion: `AL_IMPLEMENTATION_SPEC.md`, `BOT_AUTHORING_SPEC.md`,
`A_PROTOCOL_SCHEMA.md`.

---

## 1. Identity and role

```text
principal: a://workspace/{workspace}/principal/gizzi
roles: [worker, code, terminal]   # repository, filesystem, build, debug, development-environment
```

- Gizzi is the default technical worker under Al (§13 of `A_PROTOCOL.md`),
  **not** the Coworker identity and not a security root.
- **Today:** the address appears in docs/fixtures only; no install step mints
  a `principal/gizzi` record in `cowork_principals`, and gizzi-code sessions
  do not authenticate as an A:// principal (they use their own session auth).
- **Specified:** workspace provisioning registers Gizzi as a principal with
  its runtime capability set (§3) and no orchestration privileges.

## 2. What Gizzi does today (implemented)

- Terminal/shell execution with sandboxing — `cmd/gizzi-code/src/runtime/integrations/shell/sandbox.ts`,
  `src/runtime/tools/builtins/bash.ts`:
  - **Linux/WSL: bubblewrap (`bwrap`)** — user-namespace sandbox; if bwrap is
    absent the sandbox is disabled with a loud warning (`sandbox.ts:79`), never
    silently "secured".
  - **macOS host execution** runs without bwrap (bubblewrap is Linux-only);
    isolation on macOS comes from the VM path (below), not from a
    seatbelt-wrapped shell.
- VM/developer-runtime mode — lazy vfkit manager
  (`cmd/gizzi-code/src/runtime/cowork/cowork.runtime.ts:17-23`,
  `createVFKitManager()`); local VMs via the `allternit-vm-executor` /
  `allternit-apple-vf-driver` crates.
- Repository/code/build work — the gizzi-code tool surface (edit, grep, git,
  build, test runners) and the Cowork runtime loop (`cowork.runtime.ts`).
- Cron-triggered cowork execution — `src/runtime/automation/cron/executors/cowork-executor.ts`.

## 3. Capability set (as a fabric-transport worker)

**Specified / Planned** — the canonical vocabulary mapping for Gizzi's
principal record (subject to §8.6):

```text
shell.exec            # terminal execution (bwrap-sandboxed on Linux)
git.read / git.write
files.project.read / files.project.write
files.system.read     # high risk — policy-gated
artifact.create / artifact.modify
memory.read / memory.write   # Gizzi's own principal-scoped memory only
browser.navigate      # when driving browser tooling
```

Gizzi does **not** declare `gui.control` or `connector.*.submit` by default;
those escalate risk (critical in `risk_policy.rs`'s canonical table) and
require explicit workspace policy + approval bindings.

## 4. Execution boundaries

- **Terminal boundary:** shell runs inside the sandbox when the platform
  supports it; the sandbox adapter (`src/shared/utils/sandbox/sandbox-adapter.ts`)
  is the single place that decides bwrap availability, bind mounts, and
  warnings — do not fork sandbox logic per tool.
- **VM boundary:** vfkit VMs are the isolation story for macOS and for
  untrusted work anywhere; the local host shell is trusted-context only.
- **Honest status:** there is no seccomp/SELinux profile, no network
  namespace policy, and no per-principal syscall filtering beyond bwrap's
  defaults. Treat host-mode Gizzi as a privileged local process.

## 5. How Gizzi claims work over Fabric Transport

**Specified / Planned — not wired today.** Gizzi-code currently executes via
its own session runtime and cron executor, not through
`/api/v1/fabric/transport/*`. The target contract, when wired:

1. Gizzi authenticates as `a://workspace/{ws}/principal/gizzi` (bearer token
   in its local secret store, never in the repo or prompts).
2. Long-poll claim (`POST /fabric/transport/claim`) with its capability set;
   eligibility = job `required_capabilities` ⊆ Gizzi's.
3. Execute the deterministic step sequence; heartbeat at `lease_ttl/3`;
   renew before `lease_expires_at`; checkpoint at committed boundaries via
   `POST /runs/:id/checkpoints`.
4. Protected actions (e.g. `files.system.write` under a critical policy)
   gate on `approvals/check` under the current generation; on re-assignment
   the replacement Gizzi re-obtains approval — the gen-N approval is dead.
5. Complete with a typed Result; exactly-once; the ledger attributes
   `executor = …/principal/gizzi`, never Al.

Until this lands, Gizzi→cowork work enters through the existing run/job
routes (`POST /runs`, `POST /runs/:id/jobs`) without lease ownership — which
means no failover guarantee for Gizzi-driven steps. That gap is the reason
this spec exists.

## 6. Attribution rule (normative)

Every shell/code/build action Gizzi performs is ledgered with Gizzi as
executor. Al may be initiator or delegator; it must never absorb Gizzi's
execution attribution (§8.18; asserted by the conformance suite).

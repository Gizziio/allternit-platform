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
- **Implemented (identity):** boot seeding mints
  `a://workspace/{ws}/principal/gizzi` with roles `[worker, code, terminal]`
  and the §3 capability set (`seed_default_principals`; credential via
  provision-token, once). gizzi-code sessions do not yet authenticate as
  this principal — the claim path below is still the work to wire.

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

**Implemented (A-T4).** `cmd/gizzi-code/src/runtime/fabric-transport/worker.ts`
(+ `worker-entry.ts`) is the claim loop; it runs on-demand via bun (installed
service packaging is product work). Operator token flow: provision once via
`POST /api/v1/fabric/transport/principals/<principal>/provision-token`, then
`ALLTERNIT_GIZZI_TOKEN=atok_… bun src/runtime/fabric-transport/worker-entry.ts`
(or `ALLTERNIT_GIZZI_TOKEN_FILE`). The loop:

1. Authenticates as `a://workspace/{ws}/principal/gizzi` (env-provided token).
2. Long-poll claim (`POST /fabric/transport/claim`, `lease_ttl_secs` from
   `ALLTERNIT_GIZZI_LEASE_SECS`); eligibility = job `required_capabilities` ⊆
   the seeded Gizzi capability set.
3. Executes `payload.steps` via `Sandbox.wrap` (bwrap on Linux /
   sandbox-exec on macOS — the existing posture; falls back to an unsandboxed
   shell only when no driver exists, loudly logged by `Sandbox.wrap`).
4. Heartbeats at `lease_ttl/3`; checkpoints after each committed step.
5. Completes with the typed Result envelope (per-step exit codes in
   `outputs.steps`); exactly-once; ledger attributes
   `executor = …/principal/gizzi`, never Al.

Protected actions gate on `approvals/check` under the current generation (not
yet exercised by the worker — see honest status).

## 6. Attribution rule (normative)

Every shell/code/build action Gizzi performs is ledgered with Gizzi as
executor. Al may be initiator or delegator; it must never absorb Gizzi's
execution attribution (§8.18; asserted by the conformance suite).

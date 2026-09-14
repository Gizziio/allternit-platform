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
- VM execution mode — `GIZZI_COMPUTE_MODE=vm` on the fabric-transport worker
  (`src/runtime/fabric-transport/worker.ts`) runs steps through the repo's
  current VM machinery: the Lima-based executor
  (`src/runtime/vm/lima-executor.ts`, `limactl shell allternit`; Lima runs on
  macOS and Linux hosts). The legacy vfkit manager was removed in the
  2026-09 dead-code cleanup — the Lima path is the supported VM surface. The
  worker's principal must declare `compute.vm` for placement to route
  vm-required jobs to it (§8.8; operator action via
  `PUT /api/v1/fabric/transport/principals/:id/capabilities`).
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
(+ `worker-entry.ts`) is the claim loop. Operator token flow: provision once via
`POST /api/v1/fabric/transport/principals/<principal>/provision-token`, then
`ALLTERNIT_GIZZI_TOKEN=atok_… bun src/runtime/fabric-transport/worker-entry.ts`
(or `ALLTERNIT_GIZZI_TOKEN_FILE`). The loop:

1. Authenticates as `a://workspace/{ws}/principal/gizzi` (env-provided token).
2. Long-poll claim (`POST /fabric/transport/claim`, `lease_ttl_secs` from
   `ALLTERNIT_GIZZI_LEASE_SECS`); eligibility = job `required_capabilities` ⊆
   the seeded Gizzi capability set (now including `compute.local`).
3. Executes `payload.steps` per `GIZZI_COMPUTE_MODE`: local → `Sandbox.wrap`
   (bwrap Linux / sandbox-exec macOS); vm → Lima VM via `executeInVM`.
4. Heartbeats at `lease_ttl/3`; checkpoints after each committed step.
5. Completes with the typed Result envelope (per-step exit codes in
   `outputs.steps`); exactly-once; ledger attributes
   `executor = …/principal/gizzi`, never Al.

**P-T2 (implemented 2026-09-13):** placement is server-side and capability
based — an intent declaring `compute: vm` enqueues its job with
`compute.vm` as a mandatory capability, so only principals that declared it
(including a vm-mode gizzi worker) can claim it; a local-only worker's claim
is refused with `A_CAPABILITY_MISSING`. Identity/attribution are unchanged:
the executor column names the principal, not the compute target. Proof:
`compute_placement_tests.rs` (5 tests) + live claim evidence in the P-T2
session notes.

Protected actions gate on `approvals/check` under the current generation (not
yet exercised by the worker — see honest status).

## 6. Attribution rule (normative)

Every shell/code/build action Gizzi performs is ledgered with Gizzi as
executor. Al may be initiator or delegator; it must never absorb Gizzi's
execution attribution (§8.18; asserted by the conformance suite).

## 7. Managed lifecycle (consumer desktop, implemented 2026-09-14)

Phase P1 of the consumer-packaged Cowork plan closes the gap where the
desktop auto-started the API, gizzi runtime and office engine but left the
fabric-transport worker as a manual token + `bun worker-entry.ts` flow.

- **Bundled entry** — `gizzi-code fabric-worker` runs the daemon entry
  (`worker-daemon-entry.ts`) from inside the single-file production build
  (relative dynamic import; Bun.build does not apply tsconfig paths). An
  optional `--compute-mode local|vm` overrides `GIZZI_COMPUTE_MODE`.
- **Provisioning** — the desktop main calls
  `POST /api/v1/fabric/transport/local/ensure-worker-principal` (desktop
  access-token gated), stores the returned once-only token in the macOS
  Keychain (secure-store module), and spawns the worker with
  `ALLTERNIT_GIZZI_TOKEN` / `ALLTERNIT_API_URL`. One rotation per launch;
  previous tokens die.
- **Process ownership** — `fabric-worker-manager.ts` mirrors the API
  backend manager: readiness = first `worker.daemon_start` JSON line;
  crash respawn with exponential backoff + jitter; `stop()` sends SIGTERM
  and escalates to SIGKILL after 8 s. The claim protocol is unchanged.
- **Status** — the worker is one of the four engines in the shell's
  aggregate engine-status indicator (green/yellow/red, never silent).

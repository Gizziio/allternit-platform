# A2rchitech Monorepo Skeleton (Kernel-First)
Status: Canonical scaffold  
Primary posture: On‑prem desktop app + local runtime

---

## 0) Goals of this skeleton
- Kernel-first: everything required to satisfy **Kernel FullSpec** exists as a minimal, buildable baseline.
- Unix-like modules: small packages, contract-first, replaceable.
- Side effects only via Tool Gateway.
- Deterministic replay via History/UOCS + Messaging + Workflow Engine.

---

## 1) Top-level layout

```
a2rchitech/
  README.md
  LICENSE
  .gitignore
  .editorconfig

  spec/                          # authoritative specs (source of truth)
    SOT.md
    Invariants.md
    Architecture.md
    Kernel_FullSpec.md
    layers/
      security-governance/       # (reference) mirrors Kernel specs
      messaging/
      workflows/
      skills/
      providers/
      hooks/
      embodiment/
      history/
      context-routing-memory/

  apps/
    desktop/                     # on‑prem desktop app (primary UX)
      README.md
      src/
      assets/
      packaging/                 # installers + auto-update channels
    console/                     # optional local web console
      README.md
      src/
    cli/                         # automation-first CLI (headless control)
      README.md
      src/

  packages/
    runtime-core/                # kernel session loop, scheduler, eventing
      README.md
      src/
        session/
        scheduler/
        eventing/
        checkpoints/
        artifacts/
        replay/
      tests/

    policy/                      # authn/authz, tiers, budgets, audit gateway
      README.md
      src/
        iam/
        authn/
        authz/
        risk/
        scopes/
        budgets/
        decisions/
        audit/
        tenancy/
        secrets/
      tests/

    messaging/                   # task queue + event bus implementations
      README.md
      src/
        envelopes/               # task/event/artifact schemas + validators
        task-queue/
        event-bus/
        adapters/
      tests/

    workflows/                   # DAG engine + scientific-loop templates
      README.md
      src/
        engine/
        phases/
          observe/
          think/
          plan/
          build/
          execute/
          verify/
          learn/
        templates/
          sdlc/
          deep-research/
          robotics/
        artifacts/
      tests/

    tools-gateway/               # policy-gated side-effect boundary
      README.md
      src/
        gateway/
        sandbox/
        io-capture/
        adapters/
          mcp/
          http/
          local/
        policy-client/
        rate-limits/
      tests/

    skills/                      # skill packaging + schema + routing
      README.md
      src/
        schema/
        packaging/
        versioning/
        routing/
        evals/
      templates/
        skill-template/
          SKILL.md
          skill.yaml
          schemas/
          workflows/
          tools/

    registry/                    # signed skills registry + install/rollback
      README.md
      src/
        index/
        signing/
        publisher-keys/
        install/
        rollback/
        channels/
      tests/

    context-router/              # precision hydration + redaction + budgets
      README.md
      src/
        selectors/
        hydration/
        compilers/
        budgets/
        redaction/
      tests/

    memory/                      # working/episodic/longterm + consolidation/decay
      README.md
      src/
        working/
        episodic/
        longterm/
        indexes/
          vector/
          graph/
        consolidation/
        decay/
        meta-pipelines/
      tests/

    history/                     # UOCS ledger + formats + query
      README.md
      src/
        ledger/
        formats/
          jsonl/
          markdown/
        integrity/
        query/
      tests/

    providers/                   # model routing + adapters + persona kernel
      README.md
      src/
        router/
        adapters/
          openai/
          anthropic/
          google/
          local/
          vla/
        persona/
          kernel/
          injectors/
          overlays/
        confidentiality/
        budgets/
      tests/

    hooks/                       # event-driven middleware; security/obs/automation
      README.md
      src/
        events/
        middleware/
        plugins/
          security-validation/
          logging/
          observability/
          self-updates/
          voice-summaries/
      tests/

    embodiment/                  # robotics/drones/iot control plane + sim/gym + OTA
      README.md
      src/
        adapters/
          ros2/
          mqtt/
          ble/
          vendor-sdks/
        sim/
          gym/
          scenarios/
          metrics/
        safety/
          envelopes/
          e-stop/
        ota/
          signing/
          staging/
          rollback/
        telemetry/
      tests/

    telemetry/                   # tracing/metrics; optional if embedded elsewhere
      README.md
      src/
        traces/
        metrics/
        exporters/

    ui-kit/                      # shared UI components
      README.md
      src/

    sdk/                         # public SDKs (ts/python) + OpenAPI + schemas
      README.md
      src/
        ts/
        py/
      schemas/
      openapi/

    security/                    # supply chain hardening, sig verify libs, scanners
      README.md
      src/
        signatures/
        sbom/
        scanners/
        hardening/

  services/                      # optional process split (compose/k8s), on-prem default
    docker-compose.yml
    configs/
      redis/
      db/
      nats/

  tools/                         # dev tools (scripts, generators, linters)
    scripts/
    generators/

  evals/                         # system-level eval harness, regression suites
    harness/
    datasets/
    benchmarks/

  docs/                          # optional docs site sources
    site/
    assets/
```

---

## 2) Kernel wiring (minimal runtime path)

### 2.1 Startup sequence (kernel)
1. `runtime-core` boots Session + Scheduler + Eventing
2. `policy` loads IAM + risk tiers + budgets + tenancy config
3. `messaging` starts TaskQueue + EventBus
4. `hooks` registers middleware subscribers (fail-closed security hooks)
5. `registry` loads signed skills index (local store)
6. `tools-gateway` starts sandbox runner + IO capture
7. `context-router` configures selectors + budgets + redaction
8. `memory` loads tier stores + consolidation + decay + meta pipeline gates
9. `history` opens ledger streams + integrity chain
10. `providers` loads routing + persona kernel
11. `workflows` loads engine + templates
12. `embodiment` registers device adapters + sim/gym + OTA (optional in kernel build; required for full kernel qualification that supports physical/sim)

### 2.2 Minimal “Kernel acceptance” demo workflow
- Create session
- Run a T0 skill (read-only)
- Run a T2 skill in sandbox (write bounded)
- Verify outputs
- Emit ledger + replay

---

## 3) Repo conventions (hard)
- Each package exports only typed contracts and functions; no implicit cross-import side effects.
- All external IO is isolated in `tools-gateway` and `embodiment` adapters, always policy-gated.
- Every package includes:
  - `README.md` (purpose, boundaries, APIs)
  - `src/`
  - `tests/`
- Specs in `/spec/` are the source of truth. Code must reference spec sections via comments/ADR IDs.

---

## 4) What to scaffold next (coding-agent ready)
1. Generate `package.json` / `pnpm-workspace.yaml` (or `bun`) for TS packages
2. Generate `pyproject.toml` for Python packages if needed
3. Add minimal build/test CI:
   - lint
   - unit tests
   - contract tests for envelopes
   - replay tests for history ledger
4. Create a “Hello Kernel” sample:
   - one workflow template
   - two skills (T0 and T2)
   - one provider adapter stub
   - one hook plugin (security validation)

---

End.

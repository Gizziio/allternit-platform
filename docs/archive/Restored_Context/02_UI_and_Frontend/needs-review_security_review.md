# Security Review and Capability Enforcement Audit

## Scope

This review focuses on the WASM runtime, capsule packaging, cloud runner
execution path, and external gateway integration. It highlights gaps where
capabilities or integrity are not fully enforced yet.

## Findings

1) Capsule integrity is incomplete
- `packages/data/capsule/src/bundle.rs` verifies the content hash derived from
  the archive excluding `manifest.json` and `tool-abi.json`. This matches the
  current bundling algorithm, but it means metadata can be modified without
  invalidating the signature.
- Risk: capability declarations, safety tier, and schemas can be altered without
  triggering verification failure.

2) Capability grants not enforced end-to-end
- `packages/orchestration/cloud-runner/src/executor.rs` still uses a mock
  execution path and does not evaluate policy or pass grants into runtime.
- `packages/orchestration/wasm-runtime/src/host_functions.rs` checks capabilities
  only when the tool explicitly calls `host.check-capability`.
- Risk: policy decisions can be bypassed in paths that do not call host checks,
  and cloud-runner does not enforce grants at all yet.

3) Async runtime mismatch
- Runtime defaults to sync bindings; enabling async support without regenerating
  bindings will fail instantiation or create undefined behavior.
- Risk: configuration drift causes unexpected execution failures.

4) Python gateway bypasses policy
- `services/python-gateway` executes registered tools directly and does not
  enforce policy or capability checks.
- Risk: external tools can run with elevated privileges without audit gates.

## Recommended Remediations (Ordered)

1) Sign a canonical capsule manifest
- Include `manifest.json` and `tool-abi.json` in the signed hash, or sign a
  canonical manifest that includes the WASM hash, metadata, and capabilities.
- Update verification to validate the signed manifest or full archive.

2) Integrate policy evaluation in cloud-runner
- Add a policy evaluation step before runtime instantiation, and pass a
  `CapabilityGrant` to the WASM runtime for each execution.
- Fail closed on policy denial.

3) Enforce capabilities in host functions
- Ensure side-effect host APIs (filesystem/network/env) reject calls without
  grants, not just `check-capability`.
- Add tests for default-deny behavior per capability class.

4) Align async support
- If async runtime is required, regenerate bindings with `async: true` and make
  host imports async-safe; otherwise keep async disabled and document it.

5) Gate Python gateway with policy
- Require policy approvals before tool execution and emit audit events.
- Add allowlists for tool entrypoints and optional sandboxing.

## Suggested Tests

- Capsule signature tamper test (modify manifest -> verify fails).
- Cloud-runner integration test with policy deny.
- Host function capability tests for filesystem, network, env.

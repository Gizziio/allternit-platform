# Allternit Repo Spec Tree Bundle

This bundle is intended to be copied into the root of the Allternit repo.

## Files added/updated

- SOT.md
- CODEBASE.md
- spec/Baseline.md
- spec/AcceptanceTests.md
- spec/Deltas/0001-task-engine.md
- spec/Deltas/0002-memory-promotion.md
- spec/Contracts/*.json (WIH, ToolRegistry, BootManifest, Proposal, PromotionRules)
- spec/ADRs/ADR-0000-template.md
- agent/POLICY.md
- agent/promotion_rules.json
- tools/tool_registry.example.json

## Expected wiring

- Kernel boot (B0) must refuse to run if SOT/CODEBASE/Contracts are missing.
- PreToolUse must validate WIH against spec/Contracts/WIH.schema.json.
- Tool calls must reference agent tool registry and enforce safety.
- All outputs must be written under /.allternit/ and match WIH globs.

- spec/Deltas/0003-repo-cartography-ci.md
- spec/RCP-001_CODEBASE_GENERATOR.md
- spec/CI_GATES_SPEC.md
- spec/Deltas/0004-contract-root-security-receipts.md
- spec/Deltas/0005-capsule-runtime-mcp-host.md
- spec/Contracts/CapsuleManifest.schema.json
- spec/Contracts/MCPAppDescriptor.schema.json
- spec/Contracts/CapsuleBridgeEvent.schema.json
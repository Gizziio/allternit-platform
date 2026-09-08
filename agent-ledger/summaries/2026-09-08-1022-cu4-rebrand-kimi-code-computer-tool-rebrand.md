# Session cu4-rebrand — Allternit-branded computer tool contract

- Date: 2026-09-08 (swarm session, orchestrated by Kimi Code goal run)
- Branch: session/cu4-rebrand → PR #137 → merge 96fdf8f0a

## What was done
Per decision D3 (Allternit Computer Use branding; nothing user-facing says anthropicType):

- `sdk/allternit-sdk` computer-use capability emits vendor-neutral `allternitToolType: 'computer'` + `computerToolVersion` alongside legacy `anthropicType` (kept as transition adapter; value follows version).
- `toolVersion: '20250124' | '20251124'` switch (default unchanged); **computer_20251124** support: 17-action enum incl. `zoom`, `region: [x1,y1,x2,y2]` property, `enable_zoom` — verified against upstream docs and vendored `BetaToolComputerUse20251124` types (reference only).
- Rebuilt tracked dist for the capability.
- Tests: updated 20250124 case + new 20251124 case (metadata, 17 actions, region bounds, zoom execution, 20250124 never advertises zoom).
- All 5 docs files present the Allternit tool type as primary, upstream types framed as legacy-compat adapters.

## Verification
vitest tool-belt.test.ts: 24 passed, 2 failed (bash/code_execution injectable-runner — pre-existing on main, identical in shared checkout); tsc ai-runtime only pre-existing gen-codegen error; docs-lint PASS.

## Honest deferrals / incidents
- text-editor `anthropicType` refs intentionally untouched (out of scope).

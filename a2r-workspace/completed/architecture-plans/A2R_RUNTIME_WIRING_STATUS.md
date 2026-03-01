# A2R Runtime Wiring Status

## Architecture Alignment

| Component | Status | Location | Notes |
| :--- | :--- | :--- | :--- |
| **Governance Kernel** | ✅ Built | `2-governance/a2r-governor/` | Policy, WIH, Receipts |
| **Runtime Bridge** | ✅ Built | `3-adapters/a2r-runtime/` | Bridge to governance + execution |
| **Execution Facade** | ✅ Built | `5-ui/a2r-platform/src/integration/execution/exec.facade.ts` | UI → runtime entrypoint |
| **Event Bus** | ✅ Built | `5-ui/a2r-platform/src/integration/execution/exec.events.ts` | Single source of truth |
| **Run Trace UI** | ✅ Built | `5-ui/a2r-platform/src/views/code/runtime/RunTraceView.tsx` | Visualizes execution |

## Integration Gaps

1. **Browser Surface**: ✅ Mapped browser tool calls to browser runtime backend (see `integration/execution/browser.bridge.ts`).
2. **Legacy Widgets**: ✅ UITARS + VoiceOrb now bound to runtime events (see `shell/LegacyWidgets.tsx`).
3. **Cron/Scheduler**: Verify console wiring to scheduler registry.

## Invariant Checks

- [x] **Invariant A**: Models never execute (enforced by governance + bridge)
- [x] **Invariant B**: Every action returns a receipt (receipt schema)
- [x] **Invariant C**: Single tool registry source (bridge + adapters)

## Next Steps

1. Run `bin/verify-toolcall-flow.sh` to validate tool call + receipt flow.
2. Verify console wiring to scheduler registry.

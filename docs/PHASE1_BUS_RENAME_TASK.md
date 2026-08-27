# Phase 1 — Rename Internal Photon Bus

## Goal
End the naming collision between Allternit's internal messaging bus and Photon.codes. Rename internal "photon" references to "allternitBus" / "AllternitBus".

## Files to modify

1. `surfaces/ai.allternit.com/src/lib/messaging/photon.service.ts` → `allternit-bus.service.ts`
   - Rename `PhotonClient` references to `AllternitBusClient` where internal.
   - Keep the public API compatible.

2. `surfaces/ai.allternit.com/src/lib/bots/bot-photon.ts` → `bot-allternit-bus.ts`
   - Rename store and exports.

3. `surfaces/ai.allternit.com/src/lib/messaging/photon.types.ts` → `allternit-bus.types.ts`
   - Rename types.

4. `cmd/allternit-api/src/photon_routes.rs` → `allternit_bus_routes.rs`
   - Rename module and router function.
   - Keep route paths the same for backward compatibility.

5. `cmd/allternit-api/src/main.rs` and `cmd/allternit-api/src/lib.rs`
   - Update module imports.

6. Any consumers of the old names in the codebase.

## Constraints
- Do not change route paths or external API contracts.
- Do not run dev servers.
- Do run `cargo check --package allternit-api` and `pnpm exec tsc --noEmit` and fix errors.

## Deliverable
When done, write `docs/PHASE1_BUS_RENAME_NOTES.md` with YAML frontmatter:
```yaml
---
status: done
files_changed: []
findings: []
deviations: []
remaining: []
---
```

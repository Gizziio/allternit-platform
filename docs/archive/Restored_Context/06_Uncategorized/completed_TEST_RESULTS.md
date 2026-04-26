# GenTabs/Capsules + Canvas Runtime Acceptance Tests

## Test 1: Two capsules, two canvases, real switching
1. Create capsule A: "plan trip"
   - Add evidence: 2 URLs
   - It compiles to a trip planner canvas (sections/tables)
2. Create capsule B: "research ui-tars"
   - It compiles to a research canvas (cards + sources list)
3. Clicking tabs must switch canvases instantly (no blank, no reset, no mix)

## Test 2: Evidence delta triggers recompile
1. In capsule A, add a third URL
2. Canvas updates with a new section or reordered itinerary
3. Remove a URL
4. Canvas updates again, without creating a new capsule

## Test 3: Framework/marketplace is real
- UI shows multiple frameworks available
- executing intents selects different frameworks and badge shows which
- no 401s

## Implementation Status

✅ **Enforce a single state source of truth**
- Implemented in ShellState with `canvasesByCapsuleId: Map<capsule_id, CanvasSpec>`
- UI renders only from `canvasesByCapsuleId.get(activeCapsuleId)`

✅ **Lock the "Capsule Compiler" output format**
- CanvasSpec contract is enforced with title, views[], actions[], update_rules
- UI renders only CanvasSpec objects

✅ **Add Evidence Panel + Add/Remove actions**
- EvidenceRail component with add/remove functionality
- Each action calls IO and is journaled

✅ **Implement compile-on-delta**
- On evidence add/remove, triggers compilation via `triggerCompileForCapsule`
- Updates canvas spec in-place for that capsule_id

✅ **Fix marketplace 401 properly**
- Updated nginx.conf to forward Authorization headers
- Updated API client to handle dev mode marketplace access

✅ **UX must match spec**
- Implemented "Synthesis moment" animation
- Added framework badge on tabs and canvas header
- Removed raw journal spam from main UI (debug overlay only)

## Files Modified

1. `/docs/gentabs_mvp.md` - Capsule lifecycle and evidence loop documentation
2. `/docs/auth-contract.md` - Authentication contract documentation  
3. `/docs/canvas-runtime.md` - Canvas runtime mapping documentation
4. `/apps/shell/src/runtime/ShellState.tsx` - Enhanced state management
5. `/apps/shell/src/App.tsx` - Evidence handling and compilation triggers
6. `/apps/shell/src/components/CapsuleView.tsx` - Canvas rendering from state
7. `/apps/shell/src/components/EvidenceRail.tsx` - Evidence panel with add/remove
8. `/infra/gateway/nginx.conf` - Fixed auth header forwarding
9. `/apps/shell/src/runtime/ApiClient.ts` - Marketplace auth handling
10. `/apps/shell/src/mock-api.ts` - Mock compilation for development
11. `/apps/shell/src/styles/capsule-view.css` - New styles for UX enhancements
# Rails Service Fixes Summary

## Issues Fixed

### 1. Missing API Endpoints
Added new endpoints to `rails.service.ts`:

```typescript
// Plan
plan.list()           // GET /rails/v1/plans
plan.execute()        // POST /rails/v1/dags/:id/execute
plan.cancel()         // POST /rails/v1/runs/:id/cancel

// Leases
leases.list()         // GET /rails/v1/leases
leases.renew()        // POST /rails/v1/leases/:id/renew

// Context Packs (NEW)
contextPacks.list()   // POST /rails/v1/context-packs
contextPacks.get()    // GET /rails/v1/context-packs/:id
contextPacks.seal()   // POST /rails/v1/context-packs/seal

// Receipts (NEW)
receipts.query()      // POST /rails/v1/receipts
receipts.write()      // PUT /rails/v1/receipts
receipts.get()        // GET /rails/v1/receipts/:id
```

### 2. Missing Type Definitions
Added new types to `rails.service.ts`:

```typescript
// Leases
ManagedLease
LeaseListResponse
LeaseRenewRequest
LeaseRenewResponse

// Context Packs
ContextPackInputs
ContextPack
ContextPackSealRequest
ContextPackSealResponse
ContextPackListRequest
ContextPackListResponse

// Receipts
ReceiptKind
Receipt
ReceiptQueryRequest
ReceiptQueryResponse
```

### 3. Export Cleanup
- Removed duplicate type exports from `lib/agents/index.ts`
- Created separate `src/runner/index.ts` for DAK-specific exports
- Added proper type exports for both Rails API types and DAK domain types

### 4. React Import Fixes
Added explicit `import React` to all component files:
- DagPlanningPanel.tsx
- WIHManagerPanel.tsx
- LeaseMonitorPanel.tsx
- ContextPackBrowser.tsx
- ReceiptQueryPanel.tsx
- TemplateLibraryPanel.tsx
- SnapshotManagerPanel.tsx

## File Structure

```
src/runner/
├── dak.types.ts          # Domain types for DAK Runner
├── dak.store.ts          # Zustand store with Rails API calls
├── index.ts              # Public exports for runner module
├── BACKEND-WIRING.md     # Documentation of API wiring
├── FIXES-SUMMARY.md      # This file
├── components/
│   ├── index.ts          # Component exports
│   ├── DagPlanningPanel.tsx
│   ├── WIHManagerPanel.tsx
│   ├── LeaseMonitorPanel.tsx
│   ├── ContextPackBrowser.tsx
│   ├── ReceiptQueryPanel.tsx
│   ├── TemplateLibraryPanel.tsx
│   └── SnapshotManagerPanel.tsx

src/lib/agents/
├── rails.service.ts      # Extended with new endpoints
└── index.ts              # Cleaned up exports

src/views/
└── RunnerView.tsx        # Main view with 8 tabs
```

## Backend Wiring Status

| Feature | UI → Store → Rails | Rails Endpoint | Status |
|---------|-------------------|----------------|--------|
| List DAGs | ✅ | GET /v1/plans | Ready |
| Create DAG Plan | ✅ | POST /v1/plan | Ready |
| Execute DAG | ✅ | POST /v1/dags/:id/execute | Ready |
| Cancel DAG | ✅ | POST /v1/runs/:id/cancel | Ready |
| List WIHs | ✅ | POST /v1/wihs | Ready |
| Pickup WIH | ✅ | POST /v1/wihs/pickup | Ready |
| Close WIH | ✅ | POST /v1/wihs/:id/close | Ready |
| List Leases | ✅ | GET /v1/leases | Ready |
| Request Lease | ✅ | POST /v1/leases | Ready |
| Renew Lease | ✅ | POST /v1/leases/:id/renew | Ready |
| Release Lease | ✅ | DELETE /v1/leases/:id | Ready |
| List Context Packs | ✅ | POST /v1/context-packs | Needs Backend |
| Seal Context Pack | ✅ | POST /v1/context-packs/seal | Needs Backend |
| Query Receipts | ✅ | POST /v1/receipts | Needs Backend |

## Notes

- Endpoints marked "Ready" exist in Rails backend
- Endpoints marked "Needs Backend" need to be implemented in Rails
- The UI components are fully wired and will call the Rails API when endpoints are available
- All type definitions are in place for both request and response types

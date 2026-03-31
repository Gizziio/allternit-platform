# DAK Runner Backend Wiring

This document describes how the UI components are wired to the Rails backend.

## Architecture

```
UI Component → dak.store.ts → rails.service.ts → Rails API → Backend
```

## Wiring Status

### ✅ Fully Wired

| Feature | UI Tab | Store Method | Rails API | Backend Endpoint |
|---------|--------|--------------|-----------|------------------|
| **Health Check** | Status Bar | `checkHealth()` | `railsApi.health()` | `GET /rails/health` |
| **List DAGs** | DAG Plans | `fetchDags()` | `railsApi.plan.list()` | `GET /rails/v1/plans` |
| **Create DAG Plan** | DAG Plans | `createDagPlan()` | `railsApi.plan.new()` | `POST /rails/v1/plan` |
| **Refine DAG** | DAG Plans | `refineDag()` | `railsApi.plan.refine()` | `POST /rails/v1/plan/refine` |
| **Execute DAG** | DAG Plans | `executeDag()` | `railsApi.plan.execute()` | `POST /rails/v1/dags/:id/execute` |
| **Cancel DAG** | DAG Plans | `cancelDag()` | `railsApi.plan.cancel()` | `POST /rails/v1/runs/:id/cancel` |
| **List WIHs** | Work Items | `fetchWihs()` | `railsApi.wihs.list()` | `POST /rails/v1/wihs` |
| **Pickup WIH** | Work Items | `pickupWih()` | `railsApi.wihs.pickup()` | `POST /rails/v1/wihs/pickup` |
| **Close WIH** | Work Items | `closeWih()` | `railsApi.wihs.close()` | `POST /rails/v1/wihs/:id/close` |
| **List Leases** | Leases | `fetchLeases()` | `railsApi.leases.list()` | `GET /rails/v1/leases` |
| **Request Lease** | Leases | `requestLease()` | `railsApi.leases.request()` | `POST /rails/v1/leases` |
| **Renew Lease** | Leases | `renewLease()` | `railsApi.leases.renew()` | `POST /rails/v1/leases/:id/renew` |
| **Release Lease** | Leases | `releaseLease()` | `railsApi.leases.release()` | `DELETE /rails/v1/leases/:id` |
| **List Context Packs** | Context Packs | `fetchContextPacks()` | `railsApi.contextPacks.list()` | `POST /rails/v1/context-packs` |
| **Seal Context Pack** | Context Packs | `sealContextPack()` | `railsApi.contextPacks.seal()` | `POST /rails/v1/context-packs/seal` |
| **Query Receipts** | Receipts | `fetchReceipts()` | `railsApi.receipts.query()` | `POST /rails/v1/receipts` |
| **Gate Decision** | (Internal) | `submitGateDecision()` | `railsApi.gate.decision()` | `POST /rails/v1/gate/decision` |

### ⚠️ Partial / Local Only

| Feature | Status | Notes |
|---------|--------|-------|
| **Snapshots** | Local Only | Managed by DAK Runner locally, not Rails |
| **Templates** | Mock Data | Template library is client-side for now |
| **Gate Checks** | Partial | UI exists but backend polling not implemented |

### 🔌 API Endpoints Added to Rails Service

The following endpoints were added to `rails.service.ts`:

```typescript
// Plan
railsApi.plan.list()           // GET /rails/v1/plans
railsApi.plan.execute()        // POST /rails/v1/dags/:id/execute
railsApi.plan.cancel()         // POST /rails/v1/runs/:id/cancel

// Leases
railsApi.leases.list()         // GET /rails/v1/leases
railsApi.leases.renew()        // POST /rails/v1/leases/:id/renew

// Context Packs (NEW)
railsApi.contextPacks.list()   // POST /rails/v1/context-packs
railsApi.contextPacks.get()    // GET /rails/v1/context-packs/:id
railsApi.contextPacks.seal()   // POST /rails/v1/context-packs/seal

// Receipts (NEW)
railsApi.receipts.query()      // POST /rails/v1/receipts
railsApi.receipts.write()      // PUT /rails/v1/receipts
railsApi.receipts.get()        // GET /rails/v1/receipts/:id
```

## Backend Requirements

### Rails API Must Implement

For full functionality, the Rails backend needs these endpoints:

```
# Plans
GET    /v1/plans                          # List all DAGs
POST   /v1/dags/:dag_id/execute           # Execute a DAG
POST   /v1/runs/:run_id/cancel            # Cancel execution

# Leases
GET    /v1/leases                         # List active leases
POST   /v1/leases/:lease_id/renew         # Renew a lease

# Context Packs (if not implemented)
POST   /v1/context-packs                  # List packs
POST   /v1/context-packs/seal             # Seal new pack

# Receipts (if not implemented)
POST   /v1/receipts                       # Query receipts
```

### Existing Rails Endpoints (Verified)

These endpoints are confirmed to exist in the Rails service:

```
# Health
GET /rails/health

# Plans
POST /v1/plan
POST /v1/plan/refine
GET  /v1/plan/:dag_id
GET  /v1/dags/:dag_id/render

# WIHs
POST /v1/wihs
POST /v1/wihs/pickup
GET  /v1/wihs/:wih_id/context
POST /v1/wihs/:wih_id/sign
POST /v1/wihs/:wih_id/close

# Leases
POST   /v1/leases
DELETE /v1/leases/:lease_id

# Ledger
POST /v1/ledger/tail
POST /v1/ledger/trace

# Gate
GET  /v1/gate/status
POST /v1/gate/check
GET  /v1/gate/rules
POST /v1/gate/verify
POST /v1/gate/decision
POST /v1/gate/mutate

# Vault
POST /v1/vault/archive
GET  /v1/vault/status

# Index
POST /v1/index/rebuild
```

## Data Flow Example: Creating a DAG Plan

```
1. User clicks "Generate DAG Plan" in DagPlanningPanel.tsx
   ↓
2. Component calls createDagPlan({ text, dagId }) from dak.store.ts
   ↓
3. Store calls railsApi.plan.new({ text, dag_id: dagId })
   ↓
4. Rails service makes POST request to /rails/v1/plan
   ↓
5. Rails backend creates DAG and returns { dag_id, prompt_id, node_id }
   ↓
6. Store fetches DAG details via railsApi.plan.show(dag_id)
   ↓
7. Store updates state: dags = [...dags, newDag]
   ↓
8. UI re-renders with new DAG in the list
```

## Data Flow Example: Picking Up Work

```
1. User clicks "Pick Up" on a WIH in WIHManagerPanel.tsx
   ↓
2. Component calls pickupWih({ dagId, nodeId, agentId })
   ↓
3. Store calls railsApi.wihs.pickup({ dag_id, node_id, agent_id })
   ↓
4. Rails service makes POST request to /rails/v1/wihs/pickup
   ↓
5. Rails backend assigns WIH to agent and returns { wih_id, context_pack_path }
   ↓
6. Store updates wihs and myWihs state
   ↓
7. UI moves WIH from "Available" to "My Work" tab
```

## Error Handling

All store methods follow this error handling pattern:

```typescript
try {
  set({ isLoading: true, error: null });
  const response = await railsApi.someMethod();
  // Update state with response
  set({ isLoading: false });
} catch (err: any) {
  set({ error: err.message, isLoading: false });
  console.error("Operation failed:", err);
  throw err; // Re-throw for component to handle
}
```

UI components display errors via:
- `error` state in store (can be bound to toast notifications)
- Inline error messages in forms
- Console logging for debugging

## Testing the Wiring

To verify everything is wired correctly:

```bash
# 1. Start Rails backend
cd 2-governance/a2r-governor
rails server -p 3011

# 2. Start Gateway
cd 4-gateway/a2r-gateway
python -m uvicorn main:app --port 8013

# 3. Start UI
cd 5-ui/allternit-platform
npm run dev

# 4. Open browser to http://localhost:5177
# 5. Click "Runner" in left rail
# 6. Check browser console for API calls
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "404 Not Found" | Rails endpoint missing | Add endpoint to Rails backend |
| "Network Error" | Rails/Gateway not running | Start services on correct ports |
| Empty lists | No data in Rails | Create test data via Rails CLI |
| "Permission Denied" | Auth token missing | Add auth header to requests |
| UI not updating | State not syncing | Check React DevTools for state changes |

## Next Steps for Full Integration

1. **Backend**: Implement missing Rails endpoints (`/v1/plans`, `/v1/leases`, etc.)
2. **Auth**: Add JWT/API key auth to all requests
3. **WebSockets**: Real-time updates for DAG execution status
4. **Polling**: Implement proper execution status polling
5. **Error Retry**: Add retry logic with exponential backoff

# UI Actions Map

## Mapping UI Actions to Gateway Routes

| UI Action | Gateway Route | Receipt Type | Required Envelope Fields |
|-----------|---------------|--------------|--------------------------|
| Dashboard Refresh | GET:/api/dashboard | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| Create Run | POST:/api/runs | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| View DAG | GET:/api/graphs/{graph_id} | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| Inspect Node | GET:/api/nodes/{node_id} | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| View Receipts | GET:/api/receipts | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| Export Forensics | POST:/api/forensics/export | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| Replay Run | POST:/api/replay | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| View Memory Candidates | GET:/api/memory/candidates | UIReceipt | run_id, task_id, wih_id, session_id, user_id |
| Approve Memory Promotion | POST:/api/memory/promote | UIReceipt | run_id, task_id, wih_id, session_id, user_id |

## UI Actions in ui/ui_registry.json
Each UI action must correspond to an entry in ui/ui_registry.json with:
- action_id matching the action in this map
- gateway_route matching the route in this map
- allowed_methods matching the HTTP method in this map
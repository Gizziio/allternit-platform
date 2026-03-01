# A2R WIH Graph Update Proposal (Rekeyed to Existing Graphs)

Purpose: merge law‑layer tasks into the existing task DAGs (graph‑0000/0001/0002). No parallel LAW‑graph should exist.

---

## Graph‑0001 (Bootstrap) — Add/Update Nodes

### New nodes (security + receipts)
- **T0016** — Remove kernel auth bypass (B0 security gate)
  - blocked_by: `T0000`
  - acceptance: `AT-SEC-0001`
- **T0017** — Disable python exec / gate python‑gateway behind ToolGateway
  - blocked_by: `T0000`
  - acceptance: `AT-SEC-0002`
- **T0018** — Define `Receipt.schema.json` + enforce validation at tool/workflow boundaries
  - blocked_by: `T0000`
  - acceptance: `AT-RECEIPT-0001`, `AT-RECEIPT-0002`

### Modified existing nodes
- **T0009** — Run receipts
  - add dependency: `T0018`
  - add acceptance: `AT-RECEIPT-0001`

### Mapping from prior LAW nodes
- LAW‑0001 → `T0000` (boot artifacts) + `T0001` (boot manifest receipt)
- LAW‑0002 → `T0002` (WIH schema validation)
- LAW‑0003 → `T0002` + `T0008` (PreToolUse + registry enforcement)
- LAW‑0004 → `T0003` (output law)
- LAW‑0005 → `T0016` (auth bypass removal)
- LAW‑0006 → `T0017` (python exec removal)
- LAW‑0008 → `T0018` + `T0009` (receipt schema + receipts)

---

## Graph‑0002 (Gateway) — Tighten Port Discipline

### New nodes (capsule runtime + MCP host)
- **G0050** — Implement Thin Overlay Shell (global hotkey + minimal chat)
  - blocked_by: (none)
  - acceptance: `AT-NET-0001`
- **G0051** — Implement MCP Apps Host Renderer (sandboxed capsule runtime)
  - blocked_by: `G0050`
  - acceptance: `AT-CAP-0001`
- **G0052** — Implement Capsule Bridge (events + WIH enforcement + tool requests)
  - blocked_by: `G0051`
  - acceptance: `AT-CAP-0002`, `AT-CAP-0003`
- **G0053** — Capsule Permissioning + Approvals UI (manifest‑driven)
  - blocked_by: `G0052`
  - acceptance: `AT-CAP-0004`
- **G0054** — Browser Capsule (agent‑driven WebView + receipts)
  - blocked_by: `G0052`, `G0100`
  - acceptance: `AT-CAP-0005`
- **G0055** — Capsule receipts integration (bridge events → run receipts)
  - blocked_by: `G0052`, `G0202`
  - acceptance: `AT-IO-0003`

### Modified existing node
- **G0104** — Refactor port sprawl
  - expand write_scope to include:
    - `/infra/gateway/nginx.conf`
    - `/dev/run.sh`
    - `/infra/docker-compose/development.yml`
    - `/launchd/*.plist.template`
  - add acceptance: `AT-NET-0004` (single gateway endpoint)

### Mapping from prior LAW nodes
- LAW‑0007 → `G0104` (single endpoint + port consolidation)

### Delta‑0005 mapping
- `spec/Deltas/0005-capsule-runtime-mcp-host.md` → `G0050`..`G0055` (capsule runtime + MCP host + browser capsule)

---

## Graph‑0000 (Program) — Governance + CI Gates

### New nodes
- **P0203** — Security CI fail conditions (auth bypass list, python exec)
  - blocked_by: `P0201`
  - acceptance: `AT-SEC-0001`, `AT-SEC-0002`
- **P0204** — Contract‑root canon ADR (spec/Contracts; deprecate spec/1_contracts)
  - blocked_by: `P0200`
  - acceptance: `AT-LAW-0004`

### Modified existing node
- **P0201** — CI gates
  - add dependency: `P0204`

---

## Notes
- These updates preserve a single DAG system and avoid drift.
- Security gates are now explicit early nodes and CI fail conditions.

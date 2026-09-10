# Attestation — ao/cloud-computer-orgo-p5 (spec rq-20260909-004 Phase 5: distribution surface, FINAL)

**Agent family:** kimi (executor, 4 parallel subagent deliverables) + kimi orchestrator session (verification, review, fixes, merge)
**PR:** #222, merged `eece02ed6`

**What shipped (first-party only, no external API keys):**
1. Standalone computers MCP server `mcp/computers-server` (stdio, @modelcontextprotocol/sdk): 22 tools derived 1:1 from real /api/v1/computers routes; lifecycle tools also added to the API-hosted /mcp/server catalog (with fail-closed enforce_confirmation gating).
2. `allternit computers create/list/get/start/stop/restart/delete/resize/clone/ssh/drive` CLI (cmd/cli, existing --api-url/--token/--json globals).
3. SDK parity `sdk/computers/`: TS `@allternit/computers` + Python `allternit-computers-sdk` (stdlib-only) — first Python client for the computers plane; approval threading in both.
4. Embeddable widget: GET /computers/:id/status, /ws/computers/:id/vnc (purpose vnc/embed, read_only enforced by frame-drop), embed-token (15-min HMAC), self-contained noVNC viewer page, CSP frame-ancestors env, vendored noVNC (no CDN).

**Review (orchestrator, pre-merge):** verdict needs-changes → all fixed. H1 critical: embed VNC ws sat behind auth_middleware (anonymous iframe visitors got 401 — deliverable non-functional); fixed with a public token-only VNC router (purpose=embed = HMAC token is the credential; purpose=vnc still requires matching AuthUser). H2: purpose=vnc tokens unmintable; fixed — mintable read_only=true by default, read_only=false requires an enforce_confirmation approval grant (stricter than PTY, which has no mint gate). Plus MCP field semantics rename, TTL 1h→15min, --json fix, TS owner_type 'session', noVNC boot warn. **No approval-gate bypass found anywhere (fail-closed throughout).**

**Verification:** cargo check clean; computer_* 64/64 (9 new); CLI tsx --test 13/13; SDK vitest 28/28 + Python unittest 19/19; MCP build + stdio smoke PASS. Evidence: ~/.agent-orchestrator/evidence/cloud-computer-orgo-p5/.

**Incidents:** executor pane died ("Terminated: 15") after all 4 subagent deliverables completed but before committing D1/D2; orchestrator verified directly and committed milestones per repo escape.

**Honest deferrals (owed live smoke):** embed iframe render + VNC ws against a running computer; read_only=false vnc-token ACI handoff end-to-end; MCP CallTool against a live API (smoke covers tools/list only). Full-control VNC for humans intentionally behind approval grant at mint time.

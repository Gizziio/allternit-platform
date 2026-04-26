# Cookbook: Policy Injection

**Purpose:** Ensure AGENTS.md and policy bundles are injected at every context boundary.

## Injection Boundaries

Policy injection MUST occur at:

1. **Session Start**
   - New WIH pickup
   - Fresh context pack

2. **New Iteration**
   - Ralph loop cycle increment
   - Fix cycle retry

3. **Subagent Spawn**
   - Builder spawned by Orchestrator
   - Validator spawned by Orchestrator
   - Any worker spawn

4. **Post-Compaction**
   - Context compaction completed
   - Resume from summary

## Injection Contents

```yaml
injection_marker:
  timestamp: ISO8601
  agents_md_hash: sha256:...
  policy_bundle_id: pb_...
  role: builder|validator|orchestrator|...
  execution_mode: PLAN_ONLY|REQUIRE_APPROVAL|ACCEPT_EDITS|BYPASS_PERMISSIONS
  
policy_bundle:
  constraints:
    allowed_tools: [...]
    forbidden_tools: [...]
    write_scope:
      mode: run_scoped|lease_scoped
      allowed_globs: [...]
      forbidden_globs: [...]
    network_policy: none|restricted|full
    receipts_required: true
    max_fix_cycles: 3
    require_validator: true|false
```

## Procedure

### At Each Boundary:

```
1. Hash current AGENTS.md
2. Compare to last_injected_hash
   
3. IF hash differs OR boundary_type in [spawn, compact]:
   
   a. Load policy_bundle for role
   
   b. Construct injection envelope:
      ```
      ═══════════════════════════════════════════
      POLICY INJECTION
      
      You are operating under Allternit Agent Law v{version}
      
      Role: {role}
      Execution Mode: {execution_mode}
      
      Constraints:
      - Tools: {allowed_tools}
      - Write Scope: {write_scope}
      - Network: {network_policy}
      
      Invariants:
      - All tool calls gated through PreToolUse
      - No writes outside lease scope
      - Validator gates completion
      
      AGENTS.md Hash: {agents_md_hash}
      Policy Bundle: {policy_bundle_id}
      ═══════════════════════════════════════════
      ```
   
   c. Emit injection_marker receipt
   
   d. Update last_injected_hash

4. ELSE:
   - Skip injection (hash matches)
```

## Receipt Format

```json
{
  "receipt_id": "rcpt_...",
  "kind": "injection_marker",
  "provenance": {
    "agent_id": "...",
    "role": "...",
    "iteration_id": "..."
  },
  "payload": {
    "agents_md_hash": "sha256:...",
    "bundle_hash": "sha256:...",
    "role": "...",
    "timestamp": "..."
  }
}
```

## Verification

To verify injection occurred:

1. Check for `injection_marker` receipt at each boundary
2. Verify `agents_md_hash` matches current AGENTS.md
3. Verify `bundle_hash` matches active policy

## Failure Handling

If injection fails:
1. BLOCK all tool execution
2. Emit error receipt
3. Escalate to user
4. Do not proceed without valid injection

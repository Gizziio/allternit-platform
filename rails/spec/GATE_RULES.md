# Gate Rules (Enforcement)

## Gate 0 — Plan creation
Trigger: `allternit plan new` or equivalent.
Checks:
- PromptCreated exists (raw intent immutable)
- Create DagCreated + root node
- Link prompt → dag
- blocked_by edges remain acyclic
- mutations must include provenance (prompt delta or agent decision)
- prompt deltas and agent decisions must list linked mutation IDs (strict-mode enforcement ensures bidirectional traceability)

Emits:
- PromptCreated
- PromptDeltaAppended (initial baseline)
- DagCreated
- DagNodeCreated (root + initial structure)
- PromptLinkedToWork

## Gate 1 — WIH pickup/open
Trigger: `allternit wih pickup <node>`
Checks:
- target node status is READY
- role matches owner_role (unless override policy)
- no active WIH already bound to node (exclusive pickup)
- emit WIHPickedUp then require WIHOpenSigned before any tool/action
- if execution_mode is fresh, write ContextPack for the WIH
- record context_pack_path on WIHCreated for discovery

Emits:
- WIHCreated (if absent)
- WIHPickedUp
- (requires) WIHOpenSigned

## Gate 2 — PreToolUse
Trigger: any tool/action execution request
Checks:
- WIHOpenSigned is true
- tool is allowed by WIH policy
- if tool can write: lease must cover path(s)
- if merge/release: review approved if required
On denial: return structured error with gate id + reason.

## Gate 3 — PostToolUse
Trigger: tool/action completion
Checks:
- ReceiptWritten appended with content-addressed refs
- update derived status/evidence flags

## Gate 4 — WIH close
Trigger: `allternit wih close`
Checks:
- required evidence satisfied
- leases released or compatible with close policy
- node transition legal (RUNNING → DONE/FAILED)
Emits:
- WIHCloseRequested
- WIHClosedSigned (gate attestation)
- DagNodeStatusChanged

## Gate 5 — Vault pipeline
Trigger: WIHClosedSigned
Checks:
- receipt bundle integrity
- snapshots captured
Emits:
- WIHArchived
- VaultJobCreated → VaultJobCompleted

# Allternit Cowork Runtime — Acceptance Tests

This document defines end-to-end acceptance tests for the Cowork runtime. All tests must pass for V1 completion.

## Test Categories

- **T**: Terminal
- **W**: Web
- **D**: Desktop
- **S**: Scheduler
- **R**: Recovery
- **X**: Cross-cutting

---

## AT-T01: Start Cowork Run from Terminal

**Objective**: Verify that a cowork run can be started from the terminal.

### Prerequisites
- Allternit CLI installed and authenticated
- Backend API running and accessible

### Steps
1. Execute: `gizzi cowork start "List all Python files and count lines"`
2. Observe terminal output

### Expected Results
- [ ] Command returns immediately with run ID
- [ ] Terminal auto-attaches to run stream
- [ ] Live output displays as agent executes
- [ ] Run ID is displayed in the TUI header

---

## AT-T02: Detach Terminal, Run Continues

**Objective**: Verify that detaching the terminal does not stop the run.

### Prerequisites
- AT-T01 completed
- Run is active

### Steps
1. Press `Ctrl+D` or execute `gizzi cowork detach`
2. Wait 30 seconds
3. From another terminal: `gizzi cowork logs <run-id>`

### Expected Results
- [ ] Detach command succeeds immediately
- [ ] Run ID preserved in local recent-runs cache
- [ ] Logs show continued execution after detach
- [ ] Run status is `running` (not `cancelled`)

---

## AT-T03: Reattach and Replay Events

**Objective**: Verify that reattaching replays missed events.

### Prerequisites
- AT-T02 completed
- Run has progressed while detached

### Steps
1. Execute: `gizzi cowork attach <run-id>`
2. Observe terminal output

### Expected Results
- [ ] Reattach command succeeds
- [ ] Terminal displays events from detach point
- [ ] Replay completes, live stream continues seamlessly
- [ ] No duplicate events displayed

---

## AT-X01: Start in Terminal, View in Web

**Objective**: Verify cross-surface continuity.

### Prerequisites
- Allternit CLI and Web UI both accessible
- Same workspace authenticated

### Steps
1. Terminal: `gizzi cowork start "Long-running task"`
2. Note run ID
3. Open Web UI
4. Navigate to Cowork → Runs
5. Click on the run

### Expected Results
- [ ] Run appears in web run list
- [ ] Run details show correct status
- [ ] Event console displays live events
- [ ] Both terminal and web see same events

---

## AT-S01: Scheduled Job Fires Without Clients

**Objective**: Verify scheduled jobs run without connected clients.

### Prerequisites
- Scheduler daemon running
- No active client connections

### Steps
1. Create schedule: `gizzi cowork schedule create --name "test" --cron "* * * * *" --command "echo hello"`
2. Wait 2 minutes
3. Check schedule execution history

### Expected Results
- [ ] Schedule shows `enabled: true`
- [ ] Job enqueued within 1 minute of schedule time
- [ ] Job executed successfully
- [ ] Execution recorded in event log
- [ ] No client connection required

---

## AT-A01: Approval Pause and Resume

**Objective**: Verify approval workflow pauses and resumes correctly.

### Prerequisites
- Run with destructive action configured
- Policy requires approval for destructive actions

### Steps
1. Start run with destructive action: `gizzi cowork start "Delete production database"`
2. Observe approval request
3. From another terminal: `gizzi cowork approve <approval-id>`
4. Observe run continuation

### Expected Results
- [ ] Run pauses at destructive action
- [ ] Approval request event emitted
- [ ] Run shows `awaiting_approval` status
- [ ] Approval command succeeds
- [ ] Run resumes from pause point
- [ ] Action executes after approval

---

## AT-R01: Worker Crash Recovery

**Objective**: Verify run recovers from worker crash.

### Prerequisites
- Long-running job in progress
- Checkpoint created during execution

### Steps
1. Start long-running job
2. Wait for checkpoint creation (or trigger manually)
3. Kill the worker process (`kill -9 <pid>`)
4. Wait for lease timeout (30s)
5. Observe recovery

### Expected Results
- [ ] Worker process terminated
- [ ] Lease expires after timeout
- [ ] Recovery manager detects orphan
- [ ] Run state transitions to `recovering`
- [ ] Checkpoint restored
- [ ] Run resumes from checkpoint position
- [ ] No duplicate side effects observed

---

## AT-L01: Lease Expiry Recovery

**Objective**: Verify job is recovered when lease expires.

### Prerequisites
- Job running with lease
- Worker becomes unresponsive (no heartbeat)

### Steps
1. Start job with short lease timeout (10s)
2. Pause worker (SIGSTOP)
3. Wait for lease timeout
4. Resume worker (SIGCONT)
5. Observe job state

### Expected Results
- [ ] Lease expires after timeout
- [ ] Job state transitions to `queued` or `retry_backoff`
- [ ] Job is picked up by another worker
- [ ] Original worker lease rejected on resume
- [ ] Job completes successfully

---

## AT-X02: Multiple Clients Attach

**Objective**: Verify multiple clients can attach simultaneously.

### Prerequisites
- Active run
- Terminal, web, and desktop clients available

### Steps
1. Terminal: `gizzi cowork attach <run-id>`
2. Web: Open run detail page
3. Desktop: Open run detail view
4. Trigger an action in the run

### Expected Results
- [ ] All three clients show connected status
- [ ] All three clients receive same events
- [ ] Event order consistent across clients
- [ ] No client disconnects others
- [ ] Approvals can be triggered from any client

---

## AT-T04: Cancel Run from Terminal

**Objective**: Verify run can be cancelled.

### Prerequisites
- Active run

### Steps
1. `gizzi cowork cancel <run-id>`
2. `gizzi cowork ls`

### Expected Results
- [ ] Cancel command succeeds immediately
- [ ] Run state transitions to `cancelled`
- [ ] Worker receives cancellation signal
- [ ] Job state transitions to `cancelled`
- [ ] Run appears in list with cancelled status

---

## AT-S02: Misfire Policy Behavior

**Objective**: Verify misfire policies work correctly.

### Prerequisites
- Schedule created
- Scheduler stopped (simulating downtime)

### Steps
1. Create schedule with `skip` policy
2. Stop scheduler for 5 minutes
3. Start scheduler
4. Verify behavior
5. Repeat with `run_once`, `catch_up`, `coalesce` policies

### Expected Results (Skip)
- [ ] Missed runs not executed
- [ ] Next run scheduled normally

### Expected Results (Run Once)
- [ ] One job enqueued for missed period
- [ ] Normal schedule resumes

### Expected Results (Catch Up)
- [ ] Jobs enqueued for each missed execution (up to cap)

### Expected Results (Coalesce)
- [ ] Single job enqueued for all missed executions

---

## AT-X03: Tenancy Isolation

**Objective**: Verify workspace/tenant isolation.

### Prerequisites
- Two workspaces: A and B
- User access to both

### Steps
1. Workspace A: `gizzi cowork start "Task A"`
2. Note run ID
3. Workspace B: `gizzi cowork ls`
4. Workspace B: `gizzi cowork attach <run-id-from-A>`

### Expected Results
- [ ] Run from A not visible in B's list
- [ ] Attach from B fails with 404 or permission error
- [ ] No cross-workspace data leakage

---

## AT-X04: Secret Redaction

**Objective**: Verify secrets are redacted from logs/events.

### Prerequisites
- Run with secret in environment
- Secret pattern configured

### Steps
1. Start run with `SECRET_API_KEY=sk-12345` in env
2. Run executes `echo $SECRET_API_KEY`
3. Check event logs

### Expected Results
- [ ] Raw secret not in events
- [ ] Redacted pattern (e.g., `sk-***`) in events
- [ ] Redacted in stored logs
- [ ] Redacted in stream output

---

## AT-T05: Schedule Management

**Objective**: Verify schedule CRUD operations.

### Steps
1. `gizzi cowork schedule create --name "daily" --cron "0 9 * * *" --command "backup.sh"`
2. `gizzi cowork schedule ls`
3. `gizzi cowork schedule pause <id>`
4. `gizzi cowork schedule resume <id>`
5. `gizzi cowork schedule trigger <id>`
6. `gizzi cowork schedule delete <id>`

### Expected Results
- [ ] Create returns schedule ID
- [ ] List shows created schedule
- [ ] Pause disables automatic firing
- [ ] Resume re-enables
- [ ] Trigger executes immediately
- [ ] Delete removes schedule

---

## Test Execution Matrix

| Test | Sprint | Automated | Priority |
|------|--------|-----------|----------|
| AT-T01 | 4 | Yes | P0 |
| AT-T02 | 4 | Yes | P0 |
| AT-T03 | 4 | Yes | P0 |
| AT-X01 | 5 | Yes | P0 |
| AT-S01 | 3 | Yes | P0 |
| AT-A01 | 3 | Yes | P0 |
| AT-R01 | 6 | Yes | P0 |
| AT-L01 | 6 | Yes | P1 |
| AT-X02 | 5 | Yes | P1 |
| AT-T04 | 4 | Yes | P0 |
| AT-S02 | 3 | Yes | P1 |
| AT-X03 | 6 | Yes | P0 |
| AT-X04 | 6 | Yes | P1 |
| AT-T05 | 4 | Yes | P1 |

## Sign-off Criteria

All P0 tests must pass. At least 80% of P1 tests must pass.

---

*Last updated: 2026-03-09*

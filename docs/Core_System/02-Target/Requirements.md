# Allternit Cowork Runtime — Requirements Document

## Functional Requirements

### FR1. Run Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | Users can create cowork runs via terminal, web, or desktop | Must |
| FR1.2 | Runs have a unique ID and are addressable across all surfaces | Must |
| FR1.3 | Runs support three modes: interactive, cowork, scheduled | Must |
| FR1.4 | Run state transitions are explicit and validated | Must |
| FR1.5 | Runs can be paused, resumed, and cancelled | Must |
| FR1.6 | Run history and logs are retained for 30 days | Must |
| FR1.7 | Runs can be recovered from checkpoints after worker crash | Must |

### FR2. Client Attachment

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Multiple clients can attach to the same run simultaneously | Must |
| FR2.2 | Detaching a client does not affect run execution | Must |
| FR2.3 | Reattaching replays missed events from the detach point | Must |
| FR2.4 | Reconnect tokens enable secure reattachment | Must |
| FR2.5 | Clients can attach in read-only (observer) or operator mode | Should |
| FR2.6 | Attachment presence is visible to other clients | Should |

### FR3. Event Streaming

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | All significant actions emit durable events | Must |
| FR3.2 | Events are ordered per-run with monotonic sequence numbers | Must |
| FR3.3 | Events can be replayed from any cursor position | Must |
| FR3.4 | Event stream supports both WebSocket and SSE transports | Must |
| FR3.5 | Event payloads are typed and versioned | Must |
| FR3.6 | Event retention is configurable per workspace | Should |

### FR4. Scheduling

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | Users can create schedules with cron expressions | Must |
| FR4.2 | Scheduled jobs run without requiring connected clients | Must |
| FR4.3 | Schedules support enable/disable without deletion | Must |
| FR4.4 | Misfired schedules are handled per policy (skip/catchup/coalesce) | Must |
| FR4.5 | Next run times can be previewed before enabling | Should |
| FR4.6 | Schedules are scoped to workspace/tenant | Must |

### FR5. Approvals

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | Actions can be classified by safety level (read/write/destructive) | Must |
| FR5.2 | Destructive actions require approval by default | Must |
| FR5.3 | Approval requests pause execution cleanly | Must |
| FR5.4 | Users can approve/reject from any attached client | Must |
| FR5.5 | Approval requests timeout after configurable duration | Must |
| FR5.6 | Policy rules can auto-approve safe actions | Should |
| FR5.7 | All approvals are audited | Must |

### FR6. Checkpoints

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | Checkpoints capture execution state at defined boundaries | Must |
| FR6.2 | Checkpoints persist workspace state and cursor position | Must |
| FR6.3 | Runs can be resumed from any checkpoint | Must |
| FR6.4 | Checkpoints are stored durably (object storage) | Must |
| FR6.5 | Checkpoint retention policies prevent unbounded growth | Should |
| FR6.6 | Recovery from checkpoint does not repeat committed side effects | Must |

### FR7. Terminal Cowork

| ID | Requirement | Priority |
|----|-------------|----------|
| FR7.1 | `gizzi cowork start` creates and attaches to remote run | Must |
| FR7.2 | `gizzi cowork attach <id>` reattaches with replay | Must |
| FR7.3 | `gizzi cowork detach` detaches without stopping run | Must |
| FR7.4 | `gizzi cowork ls` lists active and recent runs | Must |
| FR7.5 | `gizzi cowork logs <id>` shows run history | Must |
| FR7.6 | `gizzi cowork pause/resume/cancel <id>` control runs | Must |
| FR7.7 | `gizzi cowork approvals` shows pending approvals | Must |
| FR7.8 | `gizzi cowork approve/reject <id>` resolves approvals | Must |
| FR7.9 | `gizzi cowork schedule *` manages schedules | Must |
| FR7.10 | TUI shows live event console with proper formatting | Must |

### FR8. Worker Execution

| ID | Requirement | Priority |
|----|-------------|----------|
| FR8.1 | Workers acquire jobs via atomic lease | Must |
| FR8.2 | Workers heartbeat leases to prevent expiration | Must |
| FR8.3 | Orphaned jobs (expired leases) are recovered | Must |
| FR8.4 | Job retries follow exponential backoff | Must |
| FR8.5 | Failed jobs go to dead-letter after max retries | Must |
| FR8.6 | Worker capacity is configurable per pool | Should |

## Non-Functional Requirements

### NFR1. Durability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1.1 | Run survives client disconnect | 99.9% |
| NFR1.2 | Run survives worker crash with checkpoint | 99.5% |
| NFR1.3 | No event loss during normal operation | 100% |
| NFR1.4 | Scheduled job execution rate | >99.5% |

### NFR2. Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR2.1 | Event replay latency (1000 events) | <100ms |
| NFR2.2 | Run creation to queued | <500ms |
| NFR2.3 | Client attach to first event | <1s |
| NFR2.4 | Schedule evaluation interval | 1 minute |

### NFR3. Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR3.1 | Active runs per workspace | 1000 |
| NFR3.2 | Events per run | 1M |
| NFR3.3 | Attached clients per run | 10 |
| NFR3.4 | Schedules per workspace | 1000 |

### NFR4. Security

| ID | Requirement |
|----|-------------|
| NFR4.1 | All runs isolated by tenant |
| NFR4.2 | Cross-workspace access is denied |
| NFR4.3 | Secrets redacted from events/logs |
| NFR4.4 | Reconnect tokens are signed and expiring |
| NFR4.5 | All mutations audited |

### NFR5. Observability

| ID | Requirement |
|----|-------------|
| NFR5.1 | Structured logs with trace correlation |
| NFR5.2 | Per-run tracing |
| NFR5.3 | Metrics: queue depth, active runs, failed runs |
| NFR5.4 | Metrics: scheduler lag, approval latency |
| NFR5.5 | Alertable states: stuck jobs, failing schedules |

## Constraints

1. **No in-memory production paths**: All durable state in PostgreSQL/object storage
2. **No fake schedulers**: Real cron evaluation, not OS cron dependence
3. **No UI-coupled lifecycle**: Runs survive all UI disconnects
4. **No placeholder implementations**: All production code is real

---

*Last updated: 2026-03-09*

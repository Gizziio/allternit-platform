# TUI OpenClaw Integration Task DAG

## Overview
Integrate key OpenClaw Control UI features into Allternit TUI to achieve parity for operational tasks.

## Critical Path (M0-M5)

```
M0: Foundation ───────────────────────────────────────────────────────────────►
    │
    ├── T0.1: API Client Extensions (KernelClient)
    │   ├── T0.1.1: Add cron.list() method
    │   ├── T0.1.2: Add cron.add/update/remove/run() methods  
    │   ├── T0.1.3: Add cron.history() method
    │   ├── T0.1.4: Add channels.list() method
    │   ├── T0.1.5: Add channels.status() method
    │   ├── T0.1.6: Add logs.tail() method
    │   └── T0.1.7: Add config.get/set/apply() methods
    │
    └── T0.2: Data Types
        ├── T0.2.1: Define CronJob struct
        ├── T0.2.2: Define Channel struct
        ├── T0.2.3: Define LogEntry struct
        └── T0.2.4: Define ConfigSnapshot struct

M1: Cron Jobs ────────────────────────────────────────────────────────────────►
    │
    ├── T1.1: New Overlay Types
    │   └── T1.1.1: Add CronJobs, CronJobDetail to Overlay enum
    │
    ├── T1.2: Slash Commands
    │   ├── T1.2.1: /cron list - show all cron jobs
    │   ├── T1.2.2: /cron add <name> <schedule> <command> - add new job
    │   ├── T1.2.3: /cron remove <id> - remove job
    │   ├── T1.2.4: /cron run <id> - trigger job now
    │   ├── T1.2.5: /cron enable <id> - enable job
    │   └── T1.2.6: /cron disable <id> - disable job
    │
    ├── T1.3: UI Components
    │   ├── T1.3.1: CronJobList widget (table view)
    │   ├── T1.3.2: CronJobDetail widget (job info + run history)
    │   └── T1.3.3: CronJobForm widget (add/edit job)
    │
    └── T1.4: Render Functions
        ├── T1.4.1: render_cron_jobs_overlay()
        └── T1.4.2: render_cron_job_detail()

M2: Channels ─────────────────────────────────────────────────────────────────►
    │
    ├── T2.1: New Overlay Types
    │   └── T2.1.1: Add Channels, ChannelDetail to Overlay enum
    │
    ├── T2.2: Slash Commands
    │   ├── T2.2.1: /channels list - show all channels
    │   ├── T2.2.2: /channels status <name> - show channel status
    │   └── T2.2.3: /channels login <name> - initiate QR/login flow
    │
    ├── T2.3: UI Components
    │   ├── T2.3.1: ChannelList widget (status indicators)
    │   ├── T2.3.2: ChannelDetail widget (config + QR display)
    │   └── T2.3.3: QRCode display component (ASCII art)
    │
    └── T2.4: Render Functions
        ├── T2.4.1: render_channels_overlay()
        └── T2.4.2: render_channel_detail()

M3: Skills Management ────────────────────────────────────────────────────────►
    │
    ├── T3.1: API Client Extensions
    │   ├── T3.1.1: Add skills.install(id) method
    │   ├── T3.1.2: Add skills.enable/disable(id) methods
    │   └── T3.1.3: Add skills.update_api_key(id, key) method
    │
    ├── T3.2: Slash Commands (extend existing /skills)
    │   ├── T3.2.1: /skills install <id> - install skill
    │   ├── T3.2.2: /skills enable <id> - enable skill
    │   ├── T3.2.3: /skills disable <id> - disable skill
    │   └── T3.2.4: /skills config <id> - edit skill config
    │
    ├── T3.3: UI Components
    │   ├── T3.3.1: Extend SkillList with install action
    │   └── T3.3.2: SkillConfig widget (API keys + settings)
    │
    └── T3.4: Render Functions
        └── T3.4.1: Extend render_skills_overlay()

M4: Live Logs ────────────────────────────────────────────────────────────────►
    │
    ├── T4.1: API Client Extensions
    │   └── T4.1.1: Add logs.tail(sources, filter, follow) method
    │
    ├── T4.2: Slash Commands
    │   ├── T4.2.1: /logs [sources...] - show recent logs
    │   ├── T4.2.2: /logs follow [sources...] - follow logs live
    │   └── T4.2.3: /logs filter <pattern> - filter logs
    │
    ├── T4.3: UI Components
    │   ├── T4.3.1: LogViewer widget (scrolling log view)
    │   ├── T4.3.2: LogFilter widget (source selection + search)
    │   └── T4.3.3: Live log streaming handler
    │
    ├── T4.4: Render Functions
    │   ├── T4.4.1: render_logs_overlay()
    │   └── T4.4.2: render_log_entry()
    │
    └── T4.5: State Management
        ├── T4.5.1: Add log_entries: VecDeque<LogEntry> to TuiApp
        └── T4.5.2: Add log_follow: bool, log_filter: String

M5: Config Editor ────────────────────────────────────────────────────────────►
    │
    ├── T5.1: API Client Extensions
    │   ├── T5.1.1: Add config.get(path) method
    │   ├── T5.1.2: Add config.set(path, value) method
    │   └── T5.1.3: Add config.apply() method
    │
    ├── T5.2: Slash Commands
    │   ├── T5.2.1: /config get [path] - get config value
    │   ├── T5.2.2: /config set <path> <value> - set config value
    │   ├── T5.2.3: /config edit - open config editor
    │   └── T5.2.4: /config apply - validate and apply changes
    │
    ├── T5.3: UI Components
    │   ├── T5.3.1: ConfigEditor widget (tree view)
    │   ├── T5.3.2: ConfigValueEditor widget (by type)
    │   └── T5.3.3: ConfigValidation display
    │
    └── T5.4: Render Functions
        ├── T5.4.1: render_config_overlay()
        └── T5.4.2: render_config_value_editor()

## Optional / Future Milestones

M6: Nodes Management (Lower Priority)
    ├── T6.1: API methods for node.list, node.caps
    ├── T6.2: /nodes list, /nodes caps <id>
    └── T6.3: Node list overlay

M7: Exec Approvals (Lower Priority)
    ├── T7.1: API methods for exec.approvals.get/set
    ├── T7.2: /approvals list, /approvals allow <host>
    └── T7.3: Approvals overlay

M8: Debug Console (Lower Priority)
    ├── T8.1: API method for raw RPC calls
    ├── T8.2: /rpc <method> [params...]
    └── T8.3: Debug overlay with request/response
```

## Task Dependencies

```
T0.1.* (API Client) ─────────────────────────────────────────────────────────►
    │
    ├──► T1.* (Cron) ──┐
    ├──► T2.* (Channels)
    ├──► T3.* (Skills) ─┤──► Integration Testing
    ├──► T4.* (Logs) ───┤
    └──► T5.* (Config) ─┘

T0.2.* (Data Types) ─────────────────────────────────────────────────────────►
    │
    ├──► T1.3 (Cron UI)
    ├──► T2.3 (Channel UI)
    ├──► T3.3 (Skills UI)
    ├──► T4.3 (Logs UI)
    └──► T5.3 (Config UI)
```

## File Structure Changes

```
cmd/cli/src/
├── commands/
│   └── tui/
│       ├── mod.rs                    # Existing
│       ├── app.rs                    # Split from tui.rs - main app logic
│       ├── overlays/
│       │   ├── mod.rs                # Overlay coordinator
│       │   ├── agents.rs             # Existing: agent overlay
│       │   ├── sessions.rs           # Existing: session overlay
│       │   ├── models.rs             # Existing: model overlay
│       │   ├── cron.rs               # NEW: cron jobs overlay
│       │   ├── channels.rs           # NEW: channels overlay
│       │   ├── logs.rs               # NEW: logs overlay
│       │   └── config.rs             # NEW: config overlay
│       ├── components/
│       │   ├── mod.rs
│       │   ├── table.rs              # Reusable table widget
│       │   ├── form.rs               # Reusable form widget
│       │   ├── log_viewer.rs         # NEW: scrollable log view
│       │   └── qrcode.rs             # NEW: ASCII QR display
│       └── slash_commands/
│           ├── mod.rs                # Command dispatcher
│           ├── handlers.rs           # Existing handlers
│           ├── cron.rs               # NEW: cron commands
│           ├── channels.rs           # NEW: channel commands
│           ├── logs.rs               # NEW: log commands
│           └── config.rs             # NEW: config commands
├── client.rs                         # Add T0.1.* methods
└── types/
    └── openclaw.rs                   # NEW: CronJob, Channel, etc.
```

## Implementation Order (Recommended)

### Phase 1: Foundation (Week 1)
1. T0.1.1-T0.1.3: Cron API methods
2. T0.2.1: CronJob struct
3. T1.1.1: Cron overlay enum
4. T1.2.1: /cron list command
5. T1.3.1: CronJobList widget
6. T1.4.1: render_cron_jobs_overlay()

### Phase 2: Cron Jobs Complete (Week 1-2)
1. T1.2.2-T1.2.6: All cron commands
2. T1.3.2-T1.3.3: Detail and Form widgets
3. T1.4.2: Detail render

### Phase 3: Live Logs (Week 2)
1. T4.1.1: logs.tail() API
2. T0.2.3: LogEntry struct
3. T4.2.1-T4.2.3: Log commands
4. T4.3.1-T4.3.3: Log UI components
5. T4.5.1-T4.5.2: Log state

### Phase 4: Skills Management (Week 3)
1. T3.1.1-T3.1.3: Skills API methods
2. T3.2.1-T3.2.4: Skills commands
3. T3.3.1-T3.3.2: Skills UI

### Phase 5: Channels (Week 3-4)
1. T0.1.4-T0.1.5: Channels API
2. T0.2.2: Channel struct
3. T2.1.1: Channels overlay
4. T2.2.1-T2.2.3: Channels commands
5. T2.3.1-T2.3.3: Channels UI

### Phase 6: Config Editor (Week 4)
1. T5.1.1-T5.1.3: Config API
2. T0.2.4: ConfigSnapshot struct
3. T5.2.1-T5.2.4: Config commands
4. T5.3.1-T5.3.3: Config UI

## Testing Checklist

- [ ] Cron: List jobs from kernel
- [ ] Cron: Add new job
- [ ] Cron: Remove job
- [ ] Cron: Run job manually
- [ ] Cron: Enable/disable job
- [ ] Cron: View job run history
- [ ] Logs: View recent logs
- [ ] Logs: Follow logs live
- [ ] Logs: Filter by source
- [ ] Logs: Search in logs
- [ ] Skills: Install from marketplace
- [ ] Skills: Enable/disable
- [ ] Skills: Configure API keys
- [ ] Channels: List all channels
- [ ] Channels: View status
- [ ] Channels: QR login flow
- [ ] Config: Get config value
- [ ] Config: Set config value
- [ ] Config: Edit full config
- [ ] Config: Apply changes

## API Endpoints Reference

| Feature | Endpoint | Method | Status |
|---------|----------|--------|--------|
| Cron List | /v1/cron | GET | TBD |
| Cron Add | /v1/cron | POST | TBD |
| Cron Update | /v1/cron/{id} | PATCH | TBD |
| Cron Remove | /v1/cron/{id} | DELETE | TBD |
| Cron Run | /v1/cron/{id}/run | POST | TBD |
| Cron History | /v1/cron/{id}/history | GET | TBD |
| Channels List | /v1/channels | GET | TBD |
| Channel Status | /v1/channels/{id}/status | GET | TBD |
| Channel Login | /v1/channels/{id}/login | POST | TBD |
| Logs Tail | /v1/logs/tail | GET | TBD |
| Config Get | /v1/config | GET | TBD |
| Config Set | /v1/config | PATCH | TBD |
| Config Apply | /v1/config/apply | POST | TBD |
| Skills Install | /v1/skills/{id}/install | POST | TBD |
| Skills Enable | /v1/skills/{id}/enable | POST | TBD |
| Skills Disable | /v1/skills/{id}/disable | POST | TBD |

## Notes

1. **API Availability**: Verify each endpoint exists in kernel before implementing
2. **Fallback Behavior**: If API unavailable, show graceful error message
3. **Keybindings**: Consider adding key shortcuts (e.g., F5 for logs, F6 for cron)
4. **Performance**: Use pagination for large lists (cron jobs, log entries)
5. **Security**: Config editor should mask sensitive values (API keys)

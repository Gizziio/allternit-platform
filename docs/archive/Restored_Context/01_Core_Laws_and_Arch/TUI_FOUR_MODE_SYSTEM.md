# Allternit TUI - Four-Mode System

## Overview

The allternit TUI implements a **four-mode interface** inspired by modal editors like Vim. Each mode provides a specialized context for different types of operations, with distinct visual themes and command sets.

## Mode Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│  CHAT (Blue)   │  WORK (Amber)   │  OPS (Green)   │  SYS (Cyan) │
├─────────────────────────────────────────────────────────────────┤
│  Conversation  │  Task Execution │  Monitoring    │  Configure  │
│  Mode          │  Mode           │  Mode          │  Mode       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mode Descriptions

### **CHAT Mode** 🔵
**Purpose:** Primary conversation interface with AI agents

**Visual Theme:** Blue accent colors

**Key Features:**
- Interactive chat with AI agents
- Session management
- Agent switching
- File attachments
- Thinking mode control

**Commands:**
```
/help              Show help
/status            Show system status
/agent <id>        Switch agent
/agents            Open agent picker
/session <key>     Switch session
/sessions          Open session picker
/model <id>        Set model
/models            Open model picker
/skills            List marketplace skills
/think <level>     Set thinking level
/abort             Abort active run
/work               → Switch to WORK mode
/ops                → Switch to OPS mode
/sys                → Switch to SYS mode
```

---

### **WORK Mode** 🟠
**Purpose:** Execute complex tasks via Agent Rails (DAG/WIH system)

**Visual Theme:** Amber/Yellow accent colors

**Key Features:**
- Create and manage execution plans (DAGs)
- Pick up and execute work items (WIHs)
- Gate validation and checkpoints
- File leasing for safe concurrent access
- Event ledger tracking

**Commands:**
```
/chat               → Return to CHAT mode
/ops                → Switch to OPS mode
/sys                → Switch to SYS mode

/plan new "<goal>"           Create new plan/DAG
/plan show [dag_id]          Show DAG structure
/plan refine <dag_id>        Refine existing plan

/wih list [dag_id]           List work items
/wih pickup <node_id>        Pick up work item
/wih status                  Show active WIH
/wih close                   Close current WIH

/gate status                 Show gate configuration
/gate check                  Run gate checks

/lease request <paths>       Request file lease
/lease release               Release active lease

/ledger tail [n]             Tail event ledger
```

**Concepts:**
- **DAG (Directed Acyclic Graph):** Execution plan with dependencies
- **WIH (Work Item Handler):** Individual unit of work within a DAG
- **Gate:** Validation checkpoint before execution
- **Lease:** Exclusive file access lock for safe concurrent operations

---

### **OPS Mode** 🟢
**Purpose:** System operations, monitoring, and maintenance

**Visual Theme:** Green accent colors

**Key Features:**
- Cron job scheduling and management
- Log aggregation and tailing
- Channel (integration) management
- Real-time monitoring

**Commands:**
```
/chat               → Return to CHAT mode
/work               → Switch to WORK mode
/sys                → Switch to SYS mode

/cron list                   List cron jobs
/cron add <name> <schedule> <cmd>  Add cron job
/cron remove <id>            Remove cron job
/cron run <id>               Trigger job now
/cron enable <id>            Enable cron job
/cron disable <id>           Disable cron job

/logs [sources...]           Show recent logs
/logs follow [sources...]    Follow logs live
/logs filter <pattern>       Filter logs

/channels list               List channels
/channels status <id>        Show channel status
/channels login <id>         Initiate channel login
```

**Concepts:**
- **Cron Jobs:** Scheduled tasks with cron expressions
- **Channels:** External service integrations (Discord, Slack, etc.)
- **Logs:** Aggregated system logs from all services

---

### **SYS Mode** 🔵
**Purpose:** System configuration and administration

**Visual Theme:** Cyan accent colors

**Key Features:**
- Configuration management
- System health checks
- Session administration
- Metrics and monitoring

**Commands:**
```
/chat               → Return to CHAT mode
/work               → Switch to WORK mode
/ops                → Switch to OPS mode

/config get [path]           Get config value
/config set <path> <value>   Set config value
/config apply                Validate and apply changes

/health                      Detailed health check
/sessions                    List all sessions
/sessions cleanup            Clean inactive sessions
/metrics                     Show system metrics
```

**Concepts:**
- **Config Paths:** Dot-notation paths (e.g., `kernel.url`, `logging.level`)
- **Validation:** Type checking and constraint validation
- **Persistence:** Config saved to `~/.allternit/system/config.json`

---

## Mode Switching

### **Commands:**
All modes support switching via slash commands:
```
/chat    → CHAT mode (conversation)
/work    → WORK mode (task execution)
/ops     → OPS mode (monitoring)
/sys     → SYS mode (configuration)
```

### **Keyboard Shortcuts:**
```
Ctrl+1   → CHAT mode
Ctrl+2   → WORK mode
Ctrl+3   → OPS mode
Ctrl+4   → SYS mode
```

---

## Visual Indicators

### **Status Bar:**
The bottom status bar shows the current mode with color coding:
```
[CHAT]  Blue indicator
[WORK]  Amber indicator
[OPS]   Green indicator
[SYS]   Cyan indicator
```

### **Context Display:**
When switching modes, a splash screen shows:
- Mode name and color
- Active context (e.g., current DAG, WIH, log sources)
- Available commands with status markers

### **Command Status Markers:**
```
✓  Wired     - Fully implemented and working
○  Stub      - UI exists, API may be limited
◌  Pending   - Not yet available
```

---

## Architecture

### **Client-Server Communication:**
```
TUI (CLI)        HTTP REST        API Service        Native Services
   │                  │                  │                  │
   │  /api/v1/cron    │                  │                  │
   ├──────────────────►│                  │                  │
   │                  │  CronJobRequest  │                  │
   │                  ├──────────────────►│                  │
   │                  │                  │  execute()       │
   │                  │                  ├──────────────────►│
   │                  │                  │                  │
```

### **Native Services:**
All backend services are implemented in native Rust:

| Service | Purpose | Location |
|---------|---------|----------|
| `CronSystemService` | Job scheduling | `native_cron_system.rs` |
| `LogService` | Log aggregation | `native_log_service.rs` |
| `ConfigSystemService` | Configuration | `native_config_system.rs` |
| `SessionManagerService` | Session management | `native_session_manager.rs` |
| `ChannelAbstractionService` | Channel integrations | `native_channel_abstraction.rs` |

---

## Configuration

### **Default Config Values:**
```json
{
  "kernel": {
    "url": "http://127.0.0.1:3004",
    "timeout_seconds": 30,
    "retry_attempts": 3
  },
  "api": {
    "bind_address": "127.0.0.1:3000",
    "cors_enabled": true,
    "rate_limit_requests": 100
  },
  "logging": {
    "level": "info",
    "stdout": true,
    "file_enabled": true,
    "retention_days": 7
  },
  "agent": {
    "default_model": "claude-3-5-sonnet",
    "max_iterations": 10,
    "timeout_seconds": 120
  },
  "workspace": {
    "auto_save": true,
    "backup_interval_minutes": 5
  }
}
```

---

## Tips & Best Practices

### **1. Quick Context Switching:**
```
# In CHAT mode, quickly check logs
/ops
/logs kernel 20
/chat
```

### **2. Workflow Integration:**
```
# Create plan → Execute → Monitor
/work
/plan new "Implement feature X"
/wih pickup node-1
# ... do work ...
/wih close
/ops
/logs follow
```

### **3. Configuration Management:**
```
# Check and update config
/sys
/config get agent.default_model
/config set agent.timeout_seconds 300
/config apply
```

### **4. Maintenance Tasks:**
```
# Regular maintenance in OPS/SYS modes
/ops
/cron list
/sessions cleanup
/sys
/metrics
```

---

## API Reference

### **New Endpoints by Mode:**

#### WORK Mode:
```
POST   /api/v1/rails/plan
GET    /api/v1/rails/plan/:id
GET    /api/v1/rails/dag/:id/render
GET    /api/v1/rails/wihs
POST   /api/v1/rails/wihs/pickup
POST   /api/v1/rails/wihs/close
GET    /api/v1/rails/gate/status
POST   /api/v1/rails/gate/check
POST   /api/v1/rails/lease/request
POST   /api/v1/rails/lease/release
GET    /api/v1/rails/ledger/tail
```

#### OPS Mode:
```
GET    /api/v1/cron
POST   /api/v1/cron
DELETE /api/v1/cron/:id
POST   /api/v1/cron/:id/run
POST   /api/v1/cron/:id/enable
POST   /api/v1/cron/:id/disable
GET    /api/v1/cron/status
GET    /api/v1/logs
GET    /api/v1/logs/sources
GET    /api/v1/logs/stream
GET    /api/v1/channels
GET    /api/v1/channels/:id/status
POST   /api/v1/channels/:id/login
```

#### SYS Mode:
```
GET    /api/v1/config
PATCH  /api/v1/config
POST   /api/v1/config/validate
POST   /api/v1/config/apply
GET    /api/v1/config/history
GET    /api/v1/config/keys
POST   /api/v1/config/reset
POST   /api/v1/sessions/cleanup
GET    /metrics
```

---

## Troubleshooting

### **Mode switch not working:**
- Check API service is running: `GET /health`
- Verify TUI client can connect to API

### **Commands showing "✗ Failed":**
- Check specific service status in `/health`
- Review API logs for errors

### **Config changes not persisting:**
- Run `/config apply` to validate and save
- Check file permissions on `~/.allternit/system/config.json`

---

## Future Enhancements

- [ ] Custom color themes per mode
- [ ] Mode-specific key bindings
- [ ] Split-screen mode (show two modes simultaneously)
- [ ] Mode transition animations
- [ ] Custom command aliases per mode

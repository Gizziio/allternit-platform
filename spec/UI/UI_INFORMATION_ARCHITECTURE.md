# UI Information Architecture

## Navigation Structure
```
├── Dashboard
│   ├── System Overview
│   └── Quick Actions
├── Runs
│   ├── Active Runs
│   ├── Run History
│   └── Create New Run
├── DAG Explorer
│   ├── Graph Selection
│   ├── Visual DAG
│   └── Node Inspector
├── Receipts
│   ├── Receipt Browser
│   ├── Filter Options
│   └── Receipt Details
├── Forensics
│   ├── Export Forensics
│   ├── Replay Manager
│   └── Provenance Timeline
├── Memory
│   ├── Candidates
│   ├── Promotions
│   └── Retention Policy
└── Settings
    ├── Preferences
    └── Connections
```

## Screen Definitions

### Dashboard
- System health overview
- Recent activity feed
- Quick access to common actions

### Runs
- List of all runs with status indicators
- Ability to create new runs from presets
- Detailed run inspection

### DAG Explorer
- Interactive visualization of execution graphs
- Node detail inspection
- Dependency tracing

### Receipts
- Comprehensive receipt browser
- Filtering by type, run, node
- Detailed receipt inspection

### Forensics
- Export run forensics
- Replay run deterministically
- Provenance timeline visualization

### Memory
- View memory candidates
- Approve/reject promotions
- Manage retention policies

## Conversations and Agent Mode

The shell now needs a distinct separation between:

- `Conversations`: active work surfaces and their session inventories
- `Agents`: agent customization, control, and orchestration

Active agent sessions do not live under `Agents`.

They are conversation sessions with extra agent capabilities and should open inside the same surface they originated from:

- chat agent session
- cowork agent session
- code agent session
- browser agent session

The canonical design and implementation guidance for this lives in:

- `spec/UI/AGENT_MODE_SESSION_ARCHITECTURE.md`

# Allternit Workspace

This workspace contains multiple related projects centered around the Allternit Agentic Operating System.

## Projects

### 1. Allternit (Main Project)
**Location:** `allternit/`
**Status:** ✅ Active Development (Phase 11+)
**Purpose:** Unix-first Agentic OS for autonomous agents

**Key Components:**
- Kernel (port 3000) - Core orchestration
- Voice Service (port 8001) - TTS/VC
- WebVM Service (port 8002) - Browser-based Linux VM
- Browser Session (port 8000) - WebRTC + Playwright
- AGUI Gateway (port 8010) - Event streaming
- Copilot Runtime (port 8011) - CopilotKit API
- A2A Gateway (port 8012) - Agent discovery

**Quick Start:**
```bash
cd allternit
make dev              # Start all services
./target/release/allternit tui  # Launch TUI Cockpit
```

**Tech Stack:** Rust (services), TypeScript/React (shell), Python (voice)

### 2. AlphaTrader (Dexter)
**Location:** `alpha-trader/`
**Status:** ⚡ Active (Production - Zynth Upgrade)
**Purpose:** Autonomous trading research and execution platform

**Key Components:**
- Multi-agent 5-phase pipeline (OBSERVE → THINK → PLAN → CONTROL → EXECUTE)
- Broker integrations: Schwab, OANDA, Kalshi, Polymarket
- Risk governance and portfolio management
- TUI/CLI for trade approval

**Quick Start:**
```bash
cd alpha-trader
python cli.py --help
```

**Tech Stack:** Python 3.14, SQLite, FastAPI (gateway)

**Integration with Allternit:**
Designed to be ported to Allternit patterns. YAML schemas match allternit JSON schemas 1:1.

### 3. Project Gizzi
**Location:** `Project Gizzi/`
**Status:** 📦 Paused
**Purpose:** Gizziio platform (multiple sub-projects)

**Sub-projects:**
- `gizzi-legacy/` - Original implementation
- `gizzi-runtime/` - Runtime environment
- `gizzi-sdk/` - SDK for integrations
- `gizzi-mc2/` - MC2 platform
- `gizziio-code/` - Core codebase
- `gizzi-docs/` - Documentation

**Tech Stack:** Mixed (Rust, TypeScript, Python)

**Note:** Currently paused. May be archived or resumed independently.

### 4. Architecture
**Location:** `Architecture/`
**Status:** 📋 Documentation
**Purpose:** Architecture specifications, backlog, and acceptance criteria

**Contents:**
- BACKLOG/ - Feature backlog
- UI/ - UI specifications
- INTEGRATIONS/ - Third-party integrations
- LAW/ - Legal/Compliance docs

---

## Workspace Cleanup Complete ✅

This workspace has been reorganized. Key changes:
- **40+ duplicate/obsolete files** archived to `archive/for-deletion/`
- **5 vault files** created in `archive/learnings/` preserving key decisions and learnings
- **24 actionable tasks** extracted to `archive/tasks/TASKS_INDEX.md`
- **Documentation consolidated** to `allternit/docs/`

### Archive Structure
```
archive/
├── for-deletion/     # Original files ready for deletion
├── learnings/         # Vault files (decisions, research, sessions)
└── tasks/             # Extracted actionable items
```

### What Was Preserved
- All implementation knowledge and decisions
- Key learnings from completed phases
- Actionable backlog for future development
- Clean, navigable project structure

### What Was Removed
- Duplicate roadmap files (consolidated)
- Old phase completion reports (extracted to vault)
- Scattered documentation (consolidated to docs/)
- Redundant planning files (tasks extracted)

---

## Quick Reference

### Port Assignments( need updating)
| Service | Port |
|---------|------|
| Kernel | 3000 |
| Framework | 3003 |
| Voice Service | 8001 |
| WebVM Service | 8002 |
| Browser Session | 8000 |
| AGUI Gateway | 8010 |
| Copilot Runtime | 8011 |
| A2A Gateway | 8012 |
| Shell UI | 5173 |

### Common Commands

**Allternit:**
```bash
cd allternit
make dev              # Start all services
make build            # Build everything
make test             # Run tests
make stop             # Stop all services
./target/release/allternit --help
```

**AlphaTrader:**
```bash
cd alpha-trader
python cli.py --help
python cli.py run morning_report
```

---

## Getting Help

- Allternit: See `allternit/README.md`
- AlphaTrader: See `alpha-trader/DESIGN.md` and `alpha-trader/HOW_IT_WORKS.md`

---

## Workspace Maintenance

This workspace is being reorganized. See [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) for ongoing improvements.

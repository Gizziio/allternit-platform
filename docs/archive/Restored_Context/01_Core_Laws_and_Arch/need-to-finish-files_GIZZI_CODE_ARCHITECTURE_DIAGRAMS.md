# Gizzi-Code Architecture Visual Diagrams

## Current Architecture (Before Decoupling)

```
┌─────────────────────────────────────────────────────────────────┐
│                    @allternit/gizzi-code (560MB)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    CLI Layer                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Commands   │  │     TUI      │  │  Bootstrap   │  │   │
│  │  │   (15 cmds)  │  │  (SolidJS)   │  │   (21-phase) │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↕                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Runtime Layer                          │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │   │
│  │  │ Kernel │ │ Skills │ │ Memory │ │Providers│ │ Server │ │   │
│  │  │        │ │        │ │        │ │ (23x)  │ │ (Hono) │ │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │   │
│  │  │Database│ │  MCP   │ │  ACP   │ │ Tools  │ │Context │ │   │
│  │  │(Drizzle)│ │        │ │        │ │        │ │        │ │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↕                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Workspace Packages                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │ @allternit/sdk │  │@allternit/util │ │@allternit/plugin│ │@allternit/script│ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  External Dependencies: 80+ direct, 258k+ files total          │
│  - AI Providers: 23 packages (@ai-sdk/*, ai)                   │
│  - Cloud SDKs: AWS, Azure, Google                              │
│  - Protocols: MCP, ACP, GitHub, GitLab                         │
│  - UI: OpenTUI, SolidJS, Clack                                 │
│  - Database: Drizzle ORM                                       │
│  - Web: Hono framework                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Target Architecture (After Decoupling)

```
┌─────────────────────────────────────────────────────────────────┐
│                    @allternit/gizzi-code TUI (50MB)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    UI Layer ONLY                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Commands   │  │     TUI      │  │  Bootstrap   │  │   │
│  │  │ (Thin Wrappers│ │  (SolidJS)   │  │   (Allternit 21)   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↕ (calls @allternit/runtime)             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    @allternit/runtime (500MB)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Allternit 5-Layer Architecture                    │   │
│  │                                                          │   │
│  │  Layer 1: Cognitive Persistence                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │ BRAIN.md   │ │ MEMORY.md  │ │Checkpoints │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │                                                          │   │
│  │  Layer 2: Identity Stabilization                         │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │ IDENTITY.md│ │  SOUL.md   │ │  USER.md   │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │                                                          │   │
│  │  Layer 3: Governance & Decision                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │ AGENTS.md  │ │ POLICY.md  │ │ TOOLS.md   │          │   │
│  │  │ (Constitution)│(Overrides) │ (Registry) │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │                                                          │   │
│  │  Layer 4: Modular Skills                                 │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │   Skills   │ │  Contracts │ │  Registry  │          │   │
│  │  │  (SKILL.md)│ │(contract.json)│ (Index)  │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │                                                          │   │
│  │  Layer 5: Business Topology                              │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │  Clients   │ │  Projects  │ │  Tenants   │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Runtime Services                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │    AI    │  │ Database │  │   Web    │  │Protocols │ │   │
│  │  │Providers │  │(Drizzle) │  │ (Hono)   │  │MCP/ACP   │ │   │
│  │  │  (23x)   │  │          │  │          │  │          │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                  Allternit Kernel (Rust - Future)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Governance │ │    IAM     │ │   Audit    │ │    Risk    │  │
│  │  Engine    │ │ (Tenancy)  │ │   Ledger   │ │ Assessment │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Allternit 21-Phase Boot Sequence

```
B0 - Deterministic Boot Order
═══════════════════════════════════════════════════════════════

PHASE 1: SYSTEM INITIALIZATION (Steps 1-3)
─────────────────────────────────────────────────────────────
1. Lock Acquisition
   └─> .allternit/state/locks/workspace.lock
   └─> TTL-based advisory lock with heartbeat

2. Load Manifest
   └─> .allternit/manifest.json
   └─> Validate versions, policies

3. Crash Recovery
   └─> memory/active-tasks.md
   └─> .allternit/state/taskgraph.json
   └─> Reconcile state

PHASE 2: IDENTITY & GOVERNANCE (Steps 4-7)
─────────────────────────────────────────────────────────────
4. Load IDENTITY.md
   └─> Agent name, nature, vibe, avatar

5. Load AGENTS.md (Constitution)
   └─> Binding operational law
   └─> Permissions, safety, workflow

6. Load SOUL.md (Style Profile)
   └─> Non-binding guidelines
   └─> Tone, personality

7. Load USER.md (User Contract)
   └─> Preferences, assumptions

PHASE 3: ENVIRONMENT & TOOLS (Steps 8-11)
─────────────────────────────────────────────────────────────
8. Load TOOLS.md
   └─> Commands, repo roots, test runners

9. Load SYSTEM.md
   └─> Hardware constraints, rate limits

10. Load CHANNELS.md
    └─> Multi-channel setup

11. Load POLICY.md
    └─> Runtime overrides

PHASE 4: MEMORY HYDRATION (Steps 12-16)
─────────────────────────────────────────────────────────────
12. Load MEMORY.md (Curated)
13. Load memory/YYYY-MM-DD.md (Daily logs)
14. Load memory/active-tasks.md
15. Load memory/lessons.md
16. Load memory/self-review.md

PHASE 5: CAPABILITIES (Steps 17-19)
─────────────────────────────────────────────────────────────
17. Index Skills
    └─> Scan skills/ directory
    └─> Build skills.index.json

18. Load Tool Registry
    └─> tools.registry.json
    └─> Validate schemas

19. Load Provider Config
    └─> Model configurations
    └─> API credentials

PHASE 6: CONTEXT BUILD (Steps 20-21)
─────────────────────────────────────────────────────────────
20. Build Context Pack
    └─> Compile bundle
    └─> Emit pack.current.json
    └─> Hash and sign

21. Resume Work
    └─> Continue from active-tasks.md
    └─> WITHOUT asking "what are we doing?"

═══════════════════════════════════════════════════════════════
```

## Dependency Flow (Before vs After)

### BEFORE: Monolithic Dependencies

```
User Input
    ↓
┌───────────────────────────────────────┐
│  TUI (SolidJS, OpenTUI)               │
│       ↕ (direct access)               │
│  Runtime Logic                        │
│       ↕ (direct access)               │
│  AI Providers (23 packages)           │
│       ↕                               │
│  Database (Drizzle)                   │
│       ↕                               │
│  Web Server (Hono)                    │
│       ↕                               │
│  Protocols (MCP, ACP)                 │
└───────────────────────────────────────┘
    ↓
External APIs

Problem: Everything is coupled together
```

### AFTER: Layered Dependencies

```
User Input
    ↓
┌───────────────────────────┐
│  @allternit/gizzi-code TUI      │  (50MB)
│  - UI Components          │
│  - CLI Commands           │
│  - Bootstrap              │
└───────────────────────────┘
    ↓ (RPC/Function calls)
┌───────────────────────────┐
│  @allternit/runtime             │  (500MB)
│  - Allternit 5-Layer Arch       │
│  - AI Provider Router     │
│  - Skills System          │
│  - Memory Management      │
└───────────────────────────┘
    ↓ (FFI Bridge)
┌───────────────────────────┐
│  Allternit Kernel (Rust)        │
│  - Governance Engine      │
│  - Policy Enforcement     │
│  - Audit Ledger           │
└───────────────────────────┘
    ↓
External APIs

Benefit: Clear boundaries, replaceable layers
```

## Migration Path

```
Current State (Week 0)
    │
    ├─ Sprint 1-2: Foundation
    │  ├─ Create Allternit directory structure
    │  ├─ Implement 21-phase boot
    │  └─ Build context pack system
    │
    ├─ Sprint 3-4: Decoupling
    │  ├─ Create @allternit/runtime package
    │  ├─ Move runtime logic
    │  └─ Update dependencies
    │
    ├─ Sprint 5-6: Allternit Layers
    │  ├─ Implement Layer 1-3
    │  ├─ Implement Layer 4-5
    │  └─ Write integration tests
    │
    ├─ Sprint 7-8: Kernel Sync
    │  ├─ Design Rust FFI
    │  ├─ Implement receipt emission
    │  └─ Build audit ledger
    │
    └─ Sprint 9-10: Optimization
       ├─ Lazy load providers
       ├─ Tree shake utilities
       └─ Performance tuning

Target State (Week 10)
    ↓
✅ TUI: 50MB (down from 560MB)
✅ Runtime: Separate package
✅ Allternit 5-Layer compliant
✅ 21-phase boot sequence
✅ Rust kernel integration
✅ Skills marketplace ready
```

## Allternit File Structure

```
workspace/
│
├── AGENTS.md                 # Constitution (binding law)
├── SOUL.md                   # Style profile (non-binding)
├── USER.md                   # User contract
├── IDENTITY.md               # Agent identity
├── TOOLS.md                  # Environment profile
├── SYSTEM.md                 # System constraints
├── CHANNELS.md               # Channel config
├── POLICY.md                 # Dynamic policies
├── HEARTBEAT.md              # Automation spec
├── MEMORY.md                 # Curated memory
│
├── memory/
│   ├── YYYY-MM-DD.md         # Daily logs
│   ├── active-tasks.md       # Crash recovery
│   ├── lessons.md            # Policy feedstock
│   └── self-review.md        # Self-audit
│
├── skills/
│   ├── _template/
│   │   ├── SKILL.md
│   │   └── contract.json
│   └── {skill-name}/
│       ├── SKILL.md
│       ├── contract.json
│       └── tests/
│
└── .allternit/                     # Machine-managed
    ├── manifest.json
    ├── state/
    │   ├── taskgraph.json
    │   ├── checkpoints.jsonl
    │   └── locks/
    ├── contracts/
    │   ├── tools.registry.json
    │   ├── skills.index.json
    │   └── schemas/
    ├── context/
    │   ├── pack.current.json
    │   └── pack.history/
    └── memory/
        └── receipts.jsonl
```

## Key Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TUI Package Size | 560MB | 50MB | 91% reduction |
| Dependencies (direct) | 80+ | 15 | 81% reduction |
| Boot Time | ~5s | <2s | 60% faster |
| Memory (idle) | ~500MB | <200MB | 60% reduction |
| Test Coverage | ~40% | >80% | 2x improvement |
| Build Time | ~60s | <30s | 50% faster |

---

**Generated:** March 6, 2026  
**Purpose:** Visual reference for Gizzi-Code → Allternit Native migration

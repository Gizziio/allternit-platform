# Rail Consolidation Mapping

Date: 2026-03-02
Purpose: Document where removed rail items are accessible after consolidation

## Overview

Chat mode rail reduced from ~45 items across 13 sections to **3 tabs** (Chat, Agent, Conversations).

---

## ✅ Left Rail (3 Tabs)

| Tab | Items | Access |
|-----|-------|--------|
| **🏠 Chat** | New Chat | Main surface |
| **🤖 Agent** | Agent Hub (consolidated view) | Agent hub |
| **💬 Conversations** | Chat tab (with Projects) / Agents tab | Dynamic sessions |

---

## 🎛️ Console Drawer (8 Tabs)

| Tab | Content | Purpose |
|-----|---------|---------|
| **Queue** | Kanban board | Active tasks/workflows |
| **Terminal** | Unified terminal | Command line access |
| **Logs** | Output streaming | Execution logs |
| **Context** | Knowledge graph | IVKGE, Ontology, Context Control |
| **Changes** | ChangeSet review | Pending diffs |
| **Agents** | Orchestration view | Running agents overview |
| **Swarm** | Swarm Monitor | Multi-agent orchestration |
| **Policy** | Policy Manager | Governance rules |
| **Security** | Security Dashboard | Security overview |
| **Executions** | Runs view | Execution history |
| **Receipts** | Evidence log | Transaction receipts |
| **Scheduler** | Scheduler view | Cron/task scheduling |
| **DAG** | (Coming soon) | Workflow visualization |

---

## ⚙️ Settings (Gear Icon)

Settings organized into sections:

| Section | Items | Status |
|---------|-------|--------|
| **General** | Theme, shortcuts | ✅ Built |
| **Appearance** | Colors, fonts | ✅ Built |
| **Models** | Model management | ✅ Built |
| **API Keys** | Credentials | ✅ Built |
| **Infrastructure** | Cloud Deploy, Node Management | ⚠️ Placeholder UI |
| **Security** | Policy Gating, Purpose Binding | ⚠️ Placeholder UI |
| **Agents** | Evaluation Harness, ACF, GC Agents | ⚠️ Placeholder UI |
| **OpenClaw** | OpenClaw Control | ⚠️ Placeholder UI |
| **Advanced** | Hooks System, Checkpointing | ⚠️ Placeholder UI |

---

## ⌨️ Command Palette (Cmd+K)

All views accessible via command palette until proper homes are built:

| View | Command | Final Destination |
|------|---------|-------------------|
| A2R-IX Renderer | "Open A2R-IX" | Inline message renderer |
| Form Surfaces | "Open Form Surfaces" | Inline form renderer |
| Tambo UI Gen | "Open Tambo" | Agent Studio integration |
| Canvas Protocol | "Open Canvas" | Visual workflow builder |
| Evolution Layer | "Open Evolution" | Agent Studio > Advanced |
| Memory Kernel | "Open Memory Kernel" | Agent > Memory sub-view |
| Autonomous Code Factory | "Open ACF" | Agent > ACF sub-view |
| Task Executor | "Open Tasks" | Console Drawer > Queue |
| Ontology Viewer | "Open Ontology" | Console Drawer > Context |
| Directive Compiler | "Open Directive" | Console Drawer > Context |
| Evaluation Harness | "Open Evaluation" | Settings > Agents |
| DAG WIH | "Open DAG WIH" | Console Drawer > DAG |
| Checkpointing | "Open Checkpoints" | Background service |
| Browser View | "Open Browser" | Browser Mode widget |
| DAG Integration | "Open DAG" | Console Drawer > DAG |
| Multimodal | "Open Multimodal" | Chat input mode |

---

## 🗑️ Deleted

| Item | Reason |
|------|--------|
| **Elements Lab** | Demo-only, never production |
| **Browser (rail)** | Use Browser Mode widget |

---

## 📋 Action Items

### High Priority (Missing UI)
1. Build Settings > Infrastructure section
2. Build Settings > Security section  
3. Build Settings > Agents section
4. Build Swarm Monitor UI (currently placeholder)
5. Build Policy Manager UI (currently placeholder)
6. Build Security Dashboard UI (currently placeholder)

### Medium Priority (Inline Renderers)
7. Wire A2R-IX to render in chat messages
8. Wire Form Surfaces to render in chat messages
9. Integrate Tambo into Agent Studio

### Low Priority (Nice to Have)
10. Build DAG Graph visualization
11. Build Trace viewer
12. Build Browser Chat tab

---

## Notes

- **GC Agents** runs automatically as background service
- **Checkpointing** is automatic, restore UI not critical
- **Placeholder views** show "Backend implemented, UI placeholder" status
- All placeholder views are accessible via Command Palette

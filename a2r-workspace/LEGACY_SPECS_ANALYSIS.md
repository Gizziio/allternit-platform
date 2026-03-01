# Legacy Specs Analysis Log

**Directory:** archive/legacy-specs/
**Total Files:** 283
**Started:** 2026-02-24
**Analyst:** Agent

---

## Analysis Method

Files will be analyzed in batches:
1. Read first 20-30 lines to determine content type
2. Check if implemented in codebase
3. Categorize and move to appropriate location

---

## BATCH 1: Files 1-20


### FILE 1/99: A2R_ACP_V2_PATCH_PLAN.md
- **Type:** Production implementation plan
- **Status:** CLAIMS COMPLETE (2026-02-16)
- **Content:** ACP driver + provider runtime implementation
- **Location:** 1-kernel/infrastructure/
- **Verdict:** VERIFY - check if ACP implementation matches this spec

### FILE 2/99: A2R_Agent_Rails_Assessment.md
- **Type:** Comparative analysis
- **Status:** ASSESSMENT
- **Content:** A2R Agent Rails vs DIY IPC analysis
- **Verdict:** completed/architecture-plans/ - reference material

### FILE 3/99: A2R_KIMI_SWARM_PROMPT.md
- **Type:** Agent prompt
- **Status:** OPERATIONAL
- **Content:** Multi-session agent swarm instructions
- **Verdict:** completed/architecture-plans/ - operational guide

### FILE 4/99: a2r_marketplace_research.md
- **Type:** Research findings
- **Status:** RESEARCH
- **Content:** Claude plugin system architecture analysis
- **Verdict:** completed/architecture-plans/ - background research

### FILE 5/99: a2r_marketplace_studio_plan.md
- **Type:** Implementation plan
- **Status:** PLANNED
- **Content:** Marketplace & Studio features (3 week plan)
- **Verdict:** active/needs-review/ - check implementation status

### FILE 6/99: A2R_OPENCLAW_CODEBASE_SKELETON.md
- **Type:** Architecture mapping
- **Status:** PRE-INTEGRATION
- **Content:** OpenClaw integration structure
- **Verdict:** completed/architecture-plans/ - integration guide

### FILE 7/99: A2R_OPENCLAW_CONTROLLED_FORK_GUIDE.md
- **Type:** Integration guide
- **Status:** OPERATIONAL
- **Content:** Fork management, upstream compatibility
- **Verdict:** completed/architecture-plans/ - ongoing reference

### FILE 8/99: A2R_OPENCLAW_EXECUTION_QUEUE.md
- **Type:** Execution plan
- **Status:** QUEUED
- **Content:** Phase 0→1 execution tasks
- **Verdict:** archive/historical-roadmaps/ - superseded

### FILE 9/99: A2R_OPENCLAW_PHASED_PLAN.md
- **Type:** Phased plan
- **Status:** DRAFT
- **Content:** Integration phases with WIH/DAGs
- **Verdict:** completed/architecture-plans/ - planning reference

### FILE 10/99: A2R_OPENCLAW_UI_CONCEPTS.md
- **Type:** UI design
- **Status:** CONCEPTUAL
- **Content:** Dark mode, terminal aesthetic wireframes
- **Verdict:** completed/architecture-plans/ - design reference

### FILE 11/99: A2R_RUNTIME_CONTRACT_NOTES.md
- **Type:** Architecture notes
- **Status:** DOCUMENTATION
- **Content:** Two-kernel structure (Execution + Governance)
- **Verdict:** completed/architecture-plans/ - core architecture

### FILE 12/99: A2R_RUNTIME_WIRING_STATUS.md
- **Type:** Status report
- **Status:** CLAIMS COMPLETE
- **Content:** Runtime bridge, event bus, Run Trace UI
- **Key claims:** Governance Kernel ✅, Runtime Bridge ✅, Event Bus ✅
- **Verdict:** VERIFY - check against actual implementation

### FILE 13/99: A2R_SHELL_QUICKSTART.md
- **Type:** User guide
- **Status:** DOCUMENTATION
- **Content:** Installation and basic usage
- **Verdict:** completed/ - documentation

### FILE 14/99: A2R_SHELL_UI_RECOVERY_PLAN.md
- **Type:** Recovery plan
- **Status:** POST-SALVAGE
- **Content:** Fix browser capsules, glass design system
- **Key issues:** Browser spawning extra windows, navigation state
- **Verdict:** active/needs-review/ - check if fixes applied

### FILE 15/99: A2R_SHELL_UI.md
- **Type:** Architecture spec
- **Status:** DOCUMENTATION
- **Content:** Terminal-based REPL interface design
- **Verdict:** completed/architecture-plans/ - implemented design

### FILE 16/99: A2R_UI_ANALYSIS.md
- **Type:** Analysis
- **Status:** ASSESSMENT
- **Content:** UI architecture assessment, missing onboarding
- **Verdict:** completed/architecture-plans/ - assessment reference

### FILE 17/99: A2R_UI_ARCHITECTURE.md
- **Type:** Architecture doc
- **Status:** DOCUMENTATION
- **Content:** Multi-layer UI (Electron, Terminal, Web)
- **Verdict:** completed/architecture-plans/ - architecture reference

### FILE 18/99: A2R_UI_DESIGN_SPEC.md
- **Type:** Design spec
- **Status:** PRODUCTION DESIGN
- **Content:** Glass morphism, three-mode nav (Chat/Cowork/Code)
- **Key gap:** Three-mode navigation not evident in current UI
- **Verdict:** active/needs-review/ - design partially implemented

### FILE 19/99: A2R_UI_REFACTOR_PLAN.md
- **Type:** Refactor plan
- **Status:** PLANNED
- **Content:** Professional polish, toggle-based disclosure
- **Verdict:** active/needs-review/ - check if refactor done

### FILE 20/99: ACCEPTANCE_TESTS_ELECTRON.md
- **Type:** Test plan
- **Status:** PENDING
- **Content:** Electron migration acceptance tests
- **Verdict:** active/needs-review/ - tests may need execution


### FILE 21/99: ACP_IMPLEMENTATION_PLAN.md
- **Type:** Implementation plan
- **Status:** IMPLEMENTED
- **Content:** ACP-first architecture (JSON-RPC 2.0 over stdio)
- **Key change:** PTY-first → ACP-first
- **Verdict:** completed/architecture-plans/ - implemented protocol

### FILE 22/99: acp.md
- **Type:** Code documentation
- **Status:** IMPLEMENTED
- **Content:** AcpProtocolDriver code with registry commands
- **Supports:** OpenCode, Gemini, Kimi, Qwen, Claude Code
- **Verdict:** completed/architecture-plans/ - implementation reference

### FILE 23/99: AGENT_HANDOFF_PACKAGE.md
- **Type:** Handoff package
- **Status:** OPERATIONAL
- **Content:** Agent briefing with audit prompt
- **Verdict:** completed/architecture-plans/ - ongoing reference

### FILE 24/99: agent-runner-dag-plan.md
- **Type:** DAG plan
- **Status:** PLANNED
- **Content:** Agent Runner execution with Rails control plane
- **Key components:** Bridge contract, topological sort, gate evaluation
- **Verdict:** active/needs-review/ - check DAK implementation

### FILE 25/99: agent-runner-GAPS.md
- **Type:** Gap analysis
- **Status:** ADDRESSED
- **Content:** DAG schema, WIH parsing, PFS v1 gaps identified
- **Verdict:** completed/ - gaps were addressed per summary

### FILE 26/99: agent-runner-handoff.md
- **Type:** Handoff doc
- **Status:** OPERATIONAL
- **Content:** DAK runner state, key documents list
- **Verdict:** completed/architecture-plans/ - reference

### FILE 27/99: agent-runner-IMPLEMENTATION-SUMMARY.md
- **Type:** Completion report
- **Status:** CLAIMS COMPLETE
- **Content:** DAG execution, WIH parsing, 13 prompt packs
- **Verdict:** VERIFY - check if DAK fully implemented

### FILE 28/99: auth-contract.md
- **Type:** Contract spec
- **Status:** DOCUMENTATION
- **Content:** UI/Gateway/Service auth flow
- **Verdict:** completed/architecture-plans/ - auth specification

### FILE 29/99: brain-ui-tars-integration.md
- **Type:** Architecture spec
- **Status:** DESIGN
- **Content:** UI-TARS desktop automation integration
- **Key:** Vision model switching for desktop automation
- **Verdict:** active/needs-review/ - check if implemented

### FILE 30/99: BROWSER_CAPSULE_GOLD_STANDARD.md
- **Type:** Gold standard spec
- **Status:** SPECIFICATION
- **Content:** Browser Capsule (INSPECT/LIVE modes, tab management)
- **Verdict:** completed/architecture-plans/ - specification

### FILE 31/99: BROWSER_GOLD_STANDARD.md
- **Type:** Gold standard spec (duplicate-ish)
- **Status:** SPECIFICATION
- **Content:** Similar to above, slightly different structure
- **Verdict:** completed/architecture-plans/ - specification variant

### FILE 32/99: BROWSER_SERVICE_README.md
- **Type:** Implementation doc
- **Status:** IMPLEMENTED
- **Content:** WebRTC-based browser streaming service
- **Verdict:** completed/architecture-plans/ - implementation guide

### FILE 33/99: BROWSER_TEST_CHECKLIST.md
- **Type:** Test plan
- **Status:** PENDING
- **Content:** Manual testing steps for Browser Capsule
- **Verdict:** active/needs-review/ - tests need execution

### FILE 34/99: canvas-runtime.md
- **Type:** Technical mapping
- **Status:** DOCUMENTATION
- **Content:** CapsuleState → CanvasSpec mapping
- **Verdict:** completed/architecture-plans/ - technical reference

### FILE 35/99: CAPSULE_SDK_ARCHITECTURE.md
- **Type:** Architecture spec
- **Status:** IMPLEMENTED
- **Content:** Headless SDK (lifecycle, capabilities, guardrails)
- **Key principle:** SDK defines WHERE/WHEN, not WHAT
- **Verdict:** completed/architecture-plans/ - core architecture

### FILE 36/99: CAPSULE_SDK_INTEGRATION.md
- **Type:** Work summary
- **Status:** IMPLEMENTED
- **Content:** Capsule SDK v0.1 creation summary
- **Verdict:** completed/architecture-plans/ - implementation record

### FILE 37/99: CAPSULE_SDK_SETUP.md
- **Type:** Setup guide
- **Status:** DOCUMENTATION
- **Content:** Workspace configuration for SDK
- **Verdict:** completed/ - setup documentation

### FILE 38/99: chatui-api-wiring-locked.md
- **Type:** Locked instructions
- **Status:** PROTOCOL
- **Content:** ChatUI/API wiring to ACP kernel
- **Key:** Kernel owns routing, API only wires
- **Verdict:** completed/architecture-plans/ - protocol spec

### FILE 39/99: chatui-api-wiring-task.md
- **Type:** Task specification
- **Status:** IMPLEMENTED
- **Content:** ACP-first session model wiring
- **Verdict:** completed/architecture-plans/ - task complete


### FILE 40/99: chatui-wiring-executable.md
- **Type:** Task spec
- **Status:** IMPLEMENTED
- **Content:** Auth wizard + runtime model selection
- **Verdict:** completed/architecture-plans/ - wiring complete

### FILE 41/99: chatui-wiring-final.md
- **Type:** Task spec
- **Status:** IMPLEMENTED
- **Content:** Provider auth status endpoint
- **Verdict:** completed/architecture-plans/ - implementation guide

### FILE 42/99: chatui-wiring-model-discovery.md
- **Type:** Design spec
- **Status:** IMPLEMENTED
- **Content:** Runtime model discovery (no hardcoded lists)
- **Verdict:** completed/architecture-plans/ - design principle

### FILE 43/99: chatui-wiring-prompt.md
- **Type:** Agent prompt
- **Status:** IMPLEMENTED
- **Content:** Model picker + session payload wiring
- **Verdict:** completed/architecture-plans/ - operational guide

### FILE 44/99: CLAUDE_CODE_PARITY_ANALYSIS.md
- **Type:** Comparative analysis
- **Status:** RESEARCH
- **Content:** Claude Code CLI architecture analysis
- **Verdict:** completed/architecture-plans/ - competitive analysis

### FILE 45/99: claude-integration-plan.md
- **Type:** Integration plan
- **Status:** PLANNED
- **Content:** Remote monitor, conversation monitor, plugin dashboard
- **Verdict:** active/needs-review/ - check implementation status

### FILE 46/99: claude-telemetry-contract.md
- **Type:** Contract spec
- **Status:** DOCUMENTATION
- **Content:** Claude CLI analytics → A2R MonitorView mapping
- **Verdict:** completed/architecture-plans/ - data contract

### FILE 47/99: CLEANUP_PLAN_TAURI_REMOVAL.md
- **Type:** Cleanup plan
- **Status:** PENDING
- **Content:** Tauri removal checklist, acceptance tests
- **Verdict:** active/needs-review/ - check if Tauri fully removed

### FILE 48/99: CLEANUP_TAURI_PHASE.md
- **Type:** Status report
- **Status:** PHASE A COMPLETE
- **Content:** Electron BrowserView operational
- **Verdict:** completed/ - cleanup phase done

### FILE 49/99: cli-tui-hybrid.md
- **Type:** Architecture spec
- **Status:** DESIGN
- **Content:** Hybrid CLI/TUI system with IO Runner
- **Verdict:** completed/architecture-plans/ - architecture design

### FILE 50/99: CORRECTED_AGENT_PROMPT.md
- **Type:** Agent prompt
- **Status:** OPERATIONAL
- **Content:** Corrected requirements for PTY, OpenWork, UI-TARS
- **Verdict:** completed/architecture-plans/ - operational guide

### FILE 51/99: DAK-RAILS-ANALYSIS.md
- **Type:** Analysis report
- **Status:** ANALYSIS COMPLETE
- **Content:** DAK Runner ↔ Rails integration assessment
- **Verdict:** completed/architecture-plans/ - integration analysis

### FILE 52/99: DEBUG_ELECTRON_BROWSERVIEW.md
- **Type:** Debug report
- **Status:** DEBUG SESSION
- **Content:** Git status, changed files for BrowserView
- **Verdict:** completed/ - debug session record

### FILE 53/99: DEBUGGING_SUMMARY.md
- **Type:** Debug report
- **Status:** RESOLVED
- **Content:** Kernel compilation fixes
- **Verdict:** completed/ - debugging log

### FILE 54/99: demo-parity.md
- **Type:** Checklist
- **Status:** DEMO READY
- **Content:** UI-TARS demo parity checklist (6 items)
- **Verdict:** completed/ - parity achieved

### FILE 55/99: development_utilities.md
- **Type:** Documentation
- **Status:** DOCUMENTATION
- **Content:** dev-utils.sh usage guide
- **Verdict:** completed/ - utility documentation

### FILE 56/99: DIFF_MAP.md
- **Type:** Technical mapping
- **Status:** PLANNING
- **Content:** Browser Capsule + Stage Slot changes
- **Verdict:** completed/architecture-plans/ - change mapping

### FILE 57/99: ELECTRON_HOST_PLAN.md
- **Type:** Implementation plan
- **Status:** PHASE 1
- **Content:** Electron Main Process architecture
- **Verdict:** completed/architecture-plans/ - implementation guide

### FILE 58/99: ELECTRON_IPC_CONTRACT.md
- **Type:** Contract spec
- **Status:** PHASE 2 READY
- **Content:** IPC namespace, channels, patterns
- **Verdict:** completed/architecture-plans/ - contract specification


### FILE 59/99: gentabs_mvp.md
- **Type:** Implementation guide
- **Status:** MVP
- **Content:** Capsule lifecycle, GenTabs implementation
- **Verdict:** completed/architecture-plans/ - implementation guide

### FILE 60/99: gmksession.md
- **Type:** Design document
- **Status:** CONCEPT
- **Content:** Temporal knowledge graph + summarization pipeline
- **Verdict:** completed/architecture-plans/ - design concept

### FILE 61/99: implementation-summary.md
- **Type:** Completion report
- **Status:** ✅ COMPLETE
- **Content:** Kernel brain driver split + API wiring
- **Verdict:** completed/ - implementation record

### FILE 62/99: INTEGRATION.md
- **Type:** Status report
- **Status:** BLOCKED
- **Content:** 4 high-priority issues implemented but not verified
- **Verdict:** active/needs-review/ - blocked items need resolution

### FILE 63/99: KERNEL_FILEPATH_FIX.md
- **Type:** Fix documentation
- **Status:** RESOLVED
- **Content:** Kernel code location correction
- **Verdict:** completed/ - fix record

### FILE 64/99: kernel-brain-session-contract.md
- **Type:** Contract spec
- **Status:** DRAFT (Pending)
- **Content:** API/ChatUI ↔ Kernel session interface
- **Verdict:** active/needs-review/ - contract may need finalization

### FILE 65/99: MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
- **Type:** Agent prompt
- **Status:** OPERATIONAL
- **Content:** Master agent audit + execution instructions
- **Verdict:** completed/architecture-plans/ - operational guide

### FILE 66/99: MASTER_HANDOFF_PROMPT.md
- **Type:** Agent prompt
- **Status:** OPERATIONAL
- **Content:** 5 deliverables end-to-end for new agent
- **Verdict:** completed/architecture-plans/ - operational guide

### FILE 67/99: MODEL_DISCOVERY_TUI.md
- **Type:** Design spec
- **Status:** DESIGN
- **Content:** Runtime-owned model discovery pattern
- **Verdict:** completed/architecture-plans/ - design spec

### FILE 68/99: MODEL_PICKER_TUI_README.md
- **Type:** Implementation doc
- **Status:** IMPLEMENTED
- **Content:** 2-layer model picker for ChatUI
- **Verdict:** completed/architecture-plans/ - implementation guide

### FILE 69/99: OPENCLAW_SESSION_INTEGRATION.md
- **Type:** Integration record
- **Status:** COMPLETE
- **Content:** OpenClaw UI to native session manager
- **Verdict:** completed/ - integration complete

### FILE 70/99: operator-console.md
- **Type:** Documentation
- **Status:** DOCUMENTATION
- **Content:** Operator Console observability surface
- **Verdict:** completed/ - feature documentation

### FILE 71/99: prompt-pack-service-handoff.md
- **Type:** Handoff doc
- **Status:** SPEC CREATED
- **Content:** Prompt Pack Service (port 3005) spec
- **Verdict:** active/needs-review/ - check if service implemented

### FILE 72/99: prompt-pack-service-spec.md
- **Type:** Service spec
- **Status:** SPECIFICATION
- **Content:** Versioned prompt templates service
- **Verdict:** active/needs-review/ - implementation needed

### FILE 73/99: publisher-key-registration.md
- **Type:** Security spec
- **Status:** DOCUMENTATION
- **Content:** Publisher key identity and signing
- **Verdict:** completed/architecture-plans/ - security architecture

### FILE 74/99: QA_BROWSER_STAGE.md
- **Type:** Test checklist
- **Status:** PENDING
- **Content:** Browser Capsule QA checklist
- **Verdict:** active/needs-review/ - tests pending

### FILE 75/99: RELEASE_PIPELINE.md
- **Type:** Pipeline doc
- **Status:** DOCUMENTATION
- **Content:** GitHub Actions build/release pipeline
- **Verdict:** completed/ - CI/CD documentation

### FILE 76/99: RELEASE_RUNBOOK.md
- **Type:** Runbook
- **Status:** DOCUMENTATION
- **Content:** Release engineering checklist
- **Verdict:** completed/ - operational runbook

### FILE 77/99: RUNTIME_ENGINE_RESEARCH_REPORT.md
- **Type:** Research report
- **Status:** RESEARCH COMPLETE
- **Content:** 5 runtime engines analyzed, Rig+RMCP recommended
- **Verdict:** completed/architecture-plans/ - research findings

### FILE 78/99: runtime-execution-flow.md
- **Type:** Architecture doc
- **Status:** DOCUMENTATION
- **Content:** System architecture flow (ChatUI→API→Kernel)
- **Verdict:** completed/architecture-plans/ - architecture reference

### FILE 79/99: security_review.md
- **Type:** Security audit
- **Status:** AUDIT
- **Content:** WASM runtime, capsule packaging, gateway gaps
- **Verdict:** active/needs-review/ - security gaps identified


### FILE 80/99: semantic memory injection.md
- **Type:** Design doc
- **Status:** UNKNOWN
- **Content:** (File had spaces in name, not found in batch)
- **Verdict:** CHECK SEPARATELY

### FILE 81/99: SESSION_SUMMARY.md
- **Type:** Session report
- **Status:** COMPLETE (Blocked on env)
- **Content:** 4 high-priority bead issues closed
- **Verdict:** completed/ - session record

### FILE 82/99: SHELL_UI_INTEGRATION_DAG_WEEKS_21_24_COMPLETE.md
- **Type:** Integration plan
- **Status:** COMPLETE DAG
- **Content:** 4-week UI integration plan (Q→B→D→G→C methodology)
- **Verdict:** completed/architecture-plans/ - integration methodology

### FILE 83/99: STAGE_SLOT_SPEC.md
- **Type:** Architecture spec
- **Status:** SPECIFICATION
- **Content:** GPU-accelerated content region (Stage)
- **Key gap:** One Stage per workspace, explicit sizing
- **Priority:** HIGH
- **Verdict:** active/critical-unimplemented/ - STAGE COMPONENT NOT FOUND

### FILE 84/99: TAURI_TO_ELECTRON_LEDGER.md
- **Type:** Migration ledger
- **Status:** IN PROGRESS
- **Content:** Tauri → Electron codepaths inventory
- **Verdict:** completed/architecture-plans/ - migration reference

### FILE 85/99: TEST_RESULTS.md
- **Type:** Test report
- **Status:** ACCEPTANCE TESTS
- **Content:** GenTabs/Capsules + Canvas Runtime tests
- **Verdict:** completed/ - test documentation

### FILE 86/99: TUI_HANDOFF_2026-02-13.md
- **Type:** Handoff doc
- **Status:** HANDOFF COMPLETE
- **Content:** TUI polish, slash commands, cost tracking
- **Verdict:** completed/ - handoff record

### FILE 87/99: TUI_UPGRADE_ANALYSIS.md
- **Type:** Analysis report
- **Status:** RESEARCH COMPLETE
- **Content:** 15+ CLI/TUI tools analyzed, gaps identified
- **Verdict:** completed/architecture-plans/ - research findings

### FILE 88/99: UI_ARCHITECTURE_CORRECTION.md
- **Type:** Architecture correction
- **Status:** CORRECTED
- **Content:** Terminal UI repositioned as service management
- **Verdict:** completed/architecture-plans/ - architecture evolution

### FILE 89/99: ui-flow-explanation.md
- **Type:** Documentation
- **Status:** DOCUMENTATION
- **Content:** ChatUI protocol-separated architecture
- **Verdict:** completed/ - flow documentation

### FILE 90/99: ui-implementation-summary.md
- **Type:** Implementation record
- **Status:** SUMMARY
- **Content:** ProviderAuthService, model picker implementation
- **Verdict:** completed/ - implementation record

### FILE 91/99: ui-tars-integration.md
- **Type:** Integration spec
- **Status:** SPECIFICATION
- **Content:** UI-TARS real integration (Proposal Law)
- **Verdict:** active/needs-review/ - check integration status

### FILE 92/99: voice-webvm-integration.md
- **Type:** Architecture doc
- **Status:** DOCUMENTATION
- **Content:** Voice Service + WebVM Service architecture
- **Verdict:** completed/architecture-plans/ - service architecture


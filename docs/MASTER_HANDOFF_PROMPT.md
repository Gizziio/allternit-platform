# 🤖 MASTER AGENT HYDRATION & HANDOFF PROMPT

**Instructions for any incoming AI Agent or Human Engineer:**
Read this document immediately upon entering the workspace. It contains the exact context, rules, and file pointers required to pick up execution without duplicating work, hallucinating old architecture, or destroying the unified codebase.

---

## 1. 🛑 CRITICAL DIRECTIVES (Do Not Skip)
1. **The Architecture has been Reverse-Mapped:** The codebase is the source of truth. The documentation in `docs/Core_System/01-Reality` describes *what is currently running*. The documentation in `docs/Core_System/02-Target` describes *what you are building towards*. 
2. **Never Mix Old and New:** Over 1,000 legacy files were moved to `docs/Archive/`. **Do not read them** unless explicitly instructed. They contain deprecated "numbered layer" systems (e.g., `1-kernel`, `7-apps`) that will pollute your context.
3. **The `IMPLEMENTATION_DAG.md` is the Master Plan:** Do not invent tasks. Read `docs/IMPLEMENTATION_DAG.md` to see the exact 23-Phase roadmap.
4. **Follow SYSTEM LAW:** Read `docs/Core_System/02-Target/SYSTEM_LAW.md`. It forbids silent state mutations, placeholders, and ad-hoc UI components.

---

## 2. 📂 THE MAP (Where Everything Lives)
Before you write code, know where you are. 

### Active Codebase Domains:
*   `api/gateway/`: The routing endpoints (Stdio, HTTP, AGUI) bridging the outside world to the kernel.
*   `domains/kernel/allternit-agent-system-rails/`: The core execution engine (The Rails system). Handles bus, ledger, gate, and WIH.
*   `services/memory/data/ars-contexta/`: The active memory engine (Knowledge Graph, Vector Store, Decay).
*   `services/tools/`: The ToolABI implementations (Kernel tools in Rust, Gateway tools in TypeScript).
*   `services/orchestration/`: Workflow DAG compiler and Policy Engine.
*   `surfaces/allternit-platform/`: The React-based "Allternit OS" web shell.

### Documentation Domains:
*   `docs/MASTER_INDEX.md`: The directory for the documentation.
*   `docs/CODEBASE_DAG_CROSS_REFERENCE.md`: The exact mapping of physical code folders to DAG phases.
*   `docs/Core_System/01-Reality/`: How the code actually works today.
*   `docs/Core_System/02-Target/`: The foundational laws and target specs you are building toward.
*   `docs/Core_System/03-Gaps/`: Technical debt and migration plans.

---

## 3. 🛠️ HOW TO RESUME WORK (Handoff Protocol)

If you are an agent picking up a task, execute the following steps exactly:

**Step 1: Hydrate Your Context**
Run the following commands to understand the current state:
```bash
cat docs/IMPLEMENTATION_DAG.md | grep -B 2 -A 10 "\[ \]" | head -n 20
```
*This shows you the next uncompleted tasks in the DAG.*

**Step 2: Read the Relevant Law**
Before touching a subsystem, read its target spec. For example, if you are touching UI, read `docs/Core_System/02-Target/UNIFIED_UI_IMPLEMENTATION.md`. If you are touching execution, read `docs/Core_System/02-Target/SPEC-Subsystem-Kernel.md`.

**Step 3: State Your Intent**
Do not write code silently. Tell the user: "I am picking up Task [X.X] from the IMPLEMENTATION_DAG. I have read the relevant spec in [File]. My plan is to modify [Files]."

**Step 4: Execute and Update**
When you complete a task:
1. Update the code.
2. Mark the task as `[x]` in `docs/IMPLEMENTATION_DAG.md`.
3. **CRITICAL:** If your code changes how the system works, you MUST update the corresponding `01-Reality` documentation file to ensure the docs do not drift from the code (Phase 23 requirement).

---

## 4. ⚠️ KNOWN PITFALLS TO AVOID
*   **Do not re-implement OpenClaw from scratch:** Phase 0 embeds it. Phase 1 builds it natively as GizziClaw. Check the DAG to see which phase the user wants.
*   **Do not build standard chat UIs:** Phase 18 mandates A2UI (Agent-to-User Interface) where agents emit JSON and the renderer builds GenTabs.
*   **Do not bypass the Gate:** All agent actions must route through `domains/kernel/allternit-agent-system-rails/src/gate/` for policy enforcement.

**Proceed to `docs/IMPLEMENTATION_DAG.md` to begin execution.**
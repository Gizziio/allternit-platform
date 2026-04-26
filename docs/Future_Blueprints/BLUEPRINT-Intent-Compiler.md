# BLUEPRINT: Intent OS & Task Compiler

**Date:** April 18, 2026
**Status:** PROPOSED / STRATEGY

---

## 1. Core Philosophy: Universal Execution Infrastructure

Allternit is not just an "AI Agent" or "Automation" platform. It is an **Intent Operating System (Intent OS)**. 
Every task reduces to:
`Intent → Decomposition → Tool Execution → Verification → Completion`

Allternit solves execution reliability through its existing primitives (DAG orchestration, WIH, Rails, Tools, Persistence). The goal is to abstract this upward into a **Task Compiler** for real-world work.

---

## 2. Layered Product Model

### Layer 1 — Core Engine
- Orchestration, Agents, Tools, Policies (Already built in Allternit).

### Layer 2 — Execution Primitives
- Reusable building blocks: "Call API", "Control Browser", "Control Desktop", "Communicate", "Extract Data".

### Layer 3 — Intent Templates (The Scale Layer)
- **Capture:** Handle inbound requests.
- **Schedule:** Coordinate time/resources.
- **Qualify:** Filter inputs.
- **Execute Task:** Perform multi-step work.
- **Follow-up:** Persistence loop.
- **Optimize:** Improve over time.

### Layer 4 — Domain Packs
- Map templates to specific industries (e.g., Dentists, HVAC, Logistics) for immediate revenue, keeping the core universal and the edge specific.

---

## 3. The Task Compiler Architecture

To translate intent into a deployable system rapidly, the system requires an **Auto-Compiler Layer**:

```
Intent
  ↓
Intent Compiler (Takes plain English)
  ↓
Executable DAG (WIH structured + Roles + Tools + UI config)
  ↓
Agent Execution (Rails)
  ↓
Verification + Evidence (Proving the task was completed)
```

### Critical Components to Build:
1. **Intent → DAG Generator:** Converts natural language into structured WIH and DAG workflows.
2. **Tool Auto-Mapping:** Automatically maps required tasks to available plugins/tools in the registry.
3. **Agent Role Generator:** Automatically assigns roles (Planner, Executor, Validator).
4. **Verification Layer:** Defines what "done" means and how to empirically check it, producing enterprise-grade evidence of work.

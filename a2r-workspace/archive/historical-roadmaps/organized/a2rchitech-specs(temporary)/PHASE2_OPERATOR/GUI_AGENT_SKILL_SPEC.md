# GUI_AGENT_SKILL_SPEC.md
**GUI Agent Skills: Observation, Proposal, Execution**
_version 2.0 — simplified for MVP_

---

## 0. Purpose

This document defines the 3 atomic skills that enable GUI automation.
They conform to the **Proposal Law**: Models propose, IO executes.

**Workflow:**
1. `gui.observe` → get screenshot
2. `model.ui_tars.propose` → get list of proposed actions
3. IO evaluates policy
4. `gui.execute` → perform side effect

---

## 1. Skill: gui.observe

**Purpose:** Capture the current state of the visual surface (KMS/X11 canvas).

### Signature

```typescript
// skill: gui.observe
interface ObserveInput {
  region?: { x: number; y: number; width: number; height: number }; // Optional crop
}

interface ObserveOutput {
  screenshot_id: string;   // Content-addressed hash (e.g., "sha256:...")
  width: number;
  height: number;
  artifact_path: string;   // Relative to project root
  timestamp: string;       // ISO 8601
}
```

**Behavior:**
- Captures raw pixels from the authorized display surface.
- Stores image as an immutable artifact.
- Journals the capture event.

---

## 2. Skill: model.ui_tars.propose

**Purpose:** Ask the Vision-Language Model (UI-TARS) what to do next.

### Signature

```typescript
// skill: model.ui_tars.propose
interface ProposeInput {
  screenshot_id: string;   // From gui.observe
  task: string;            // Natural language goal
  history?: string[];      // Summary of previous steps
}

interface ProposeOutput {
  proposals: ActionProposal[];
  confidence: number;      // 0.0 to 1.0
  reasoning: string;       // Chain-of-thought explanation
}

interface ActionProposal {
  type: "click" | "type" | "scroll" | "wait" | "done";
  params: Record<string, any>; // {x: 100, y: 200} or {text: "hello"}
  description: string;         // Human-readable summary
}
```

**Behavior:**
- **Pure function:** No side effects on the GUI.
- Runs via **Remote API** (MVP) or WebGPU (Later).
- Does **not** execute the action.

---

## 3. Skill: gui.execute

**Purpose:** Execute a specific, validated low-level input event.

### Signature

```typescript
// skill: gui.execute
interface ExecuteInput {
  action_type: "click" | "type" | "scroll" | "wait";
  params: Record<string, any>;
  capsule_id: string;      // Required for authorization context
}

interface ExecuteOutput {
  action_id: string;       // Unique execution ID
  status: "success" | "failed";
  screenshot_after?: string; // Optional confirmation screenshot
}
```

**Behavior:**
- **Policy Check:** IO checks `capsule_id` permissions before running.
- **Journaling:** Records exactly what was executed (coordinates, keys).
- **Side Effect:** Injects event into the WebVM/System input stream.

---

## 4. Execution Flow Example

```json
// 1. Observe
IO -> gui.observe({})
   <- { "screenshot_id": "scr_123", ... }

// 2. Propose
IO -> model.ui_tars.propose({ "screenshot_id": "scr_123", "task": "Click Login" })
   <- { "proposals": [{ "type": "click", "params": { "x": 50, "y": 80 } }] }

// 3. Policy Check (Internal IO Logic)
// If policy.allows("click", {x:50, y:80}) == true:

// 4. Execute
IO -> gui.execute({ "action_type": "click", "params": { "x": 50, "y": 80 }, "capsule_id": "cap_1" })
   <- { "status": "success", "action_id": "act_999" }
```
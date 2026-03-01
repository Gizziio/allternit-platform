# UI-TARS Real Integration Spec

## 1. Overview
This document defines the real integration of UI-TARS (ByteDance) into the A2rchitech OS stack. It follows the **Proposal Law**: models propose actions, and the IO Runner executes them after policy validation.

## 2. Architecture
The integration consists of:
- **Service**: `services/ui-tars-operator` (Python FastAPI)
- **Skill**: `gui.operator.propose`
- **Execution**: IO Runner via `gui.execute`

## 3. Skill Interface: gui.operator.propose
The skill is callable by the IO Runner.

**Input:**
```json
{
  "session_id": "abc",
  "task": "Log into X and open settings",
  "screenshot": "data:image/png;base64,...",
  "viewport": { "w": 1440, "h": 900 },
  "constraints": { "max_steps": 5 }
}
```

**Output (Action Proposal):**
```json
{
  "proposals": [
    { "type": "click", "x": 420, "y": 188, "confidence": 0.72, "target": "Settings button" }
  ],
  "model": "ui-tars-7b-bytedance",
  "latency_ms": 820
}
```

## 4. Implementation (services/ui-tars-operator)
The operator service runs a Python bridge that interfaces with the real ByteDance UI-TARS model.
- **Location**: `services/ui-tars-operator/src/main.py`
- **Port**: 3007 (proxied via Nginx gateway at `:3000/v1/model/ui_tars/`)

## 5. Journaling Requirements
Every UI-TARS interaction MUST emit the following events to the journal:
1. `gui.observe.captured`: Initial GUI state capture.
2. `gui.proposal.generated`: UI-TARS model proposals.
3. `policy.decision`: Allow/Deny decision by the IO Runner.
4. `gui.execute.performed`: Actual execution by IO.
5. `gui.observe.captured`: Post-execution verification capture.

## 6. How to Run
1. Ensure Python 3.10+ is installed.
2. Run `./bin/dev-up` to start the services via launchd.
3. The UI-TARS operator will be available at `http://localhost:3000/v1/model/ui_tars/`.

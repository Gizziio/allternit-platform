# GIZZI_PRESENCE_LAYER.md
**Gizzi Presence Layer: Orb, Narration, and User Interaction**
_version 1.0 — visual/auditory feedback_

---

## 0. Purpose

Gizzi is the **Presence Layer** that subscribes to IO events to render the "soul" of the system.
Gizzi does not execute; it narrates execution.

---

## 1. Orb States

The Orb is the primary visual indicator of system status.

| State | Color/Animation | Trigger Condition |
|-------|-----------------|-------------------|
| **Idle** | Breathing Blue | No active skills or plans. |
| **Thinking** | Pulsing Purple | Kernel planning, Model inference. |
| **Acting** | Rotating Green | `gui.execute` or side-effect active. |
| **Waiting** | Steady Amber | Awaiting User Input / Approval. |
| **Done** | Flash White -> Idle | Goal completed successfully. |
| **Error** | Static Red | Runtime failure or block. |

---

## 2. Event Subscriptions

Gizzi listens to the IO event stream (`io.events`):

| Event | Gizzi Reaction |
|-------|----------------|
| `skill.started` | Transition to **Acting** or **Thinking** (depends on skill). |
| `skill.completed` | Transition to **Idle** (if plan done) or next step. |
| `capsule.updated` | Update UI context (show evidence/artifacts). |
| `policy.blocked` | Transition to **Waiting** (for approval) or **Error**. |
| `model.thinking` | Transition to **Thinking**. |

---

## 3. Narration Triggers

Gizzi speaks (text-to-speech or text bubble) based on journal events.

**Rules:**
- **Don't** narrates every click.
- **Do** narrate intent and outcome.

**Examples:**
- *Good:* "I'm checking the flight prices on Google Flights."
- *Bad:* "I am clicking x=200, y=400."
- *Good:* "I found three options. The cheapest is $300."
- *Bad:* "Skill search.web returned success."

---

## 4. Approval UI Contract

When IO hits a `policy.blocked` or `requires_approval` state:

1. **IO emits:** `io.request_approval { action_id, reason, risk_level }`
2. **Gizzi renders:** Approval Card (Allow / Deny / Edit).
3. **Orb state:** **Waiting** (Amber).
4. **User acts:** Clicks "Allow".
5. **Gizzi sends:** `admin.approve { action_id }` to IO.
6. **IO resumes:** Execution continues.

---

## 5. Voice Hooks (Placeholder)

Future integration for Realtime API (WebRTC):

- **Input:** User voice -> STT -> `shell.input`
- **Output:** Gizzi text -> TTS -> Audio
- **Interrupt:** User speaking -> IO pauses -> Gizzi listens

*Detailed spec deferred to Phase 2.*

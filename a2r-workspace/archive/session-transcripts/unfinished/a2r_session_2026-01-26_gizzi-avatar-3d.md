---
topic: "gizzi-avatar-3d integration"
date: 2026-01-26
timezone: America/Chicago
session_type: a2rchitech
source_links:
  - https://github.com/0xGF/avatar-3d
artifacts:
  - a2r_session_2026-01-26_gizzi-avatar-3d.md
---

# A2rchitech Session Summary — Gizzi Avatar (avatar-3d)

## Context
This session focused on whether the GitHub repo `0xGF/avatar-3d` can be used to build **Gizzi’s 3D avatar** inside the **A2rchitech productivity OS / agentic platform**.

- Proposed input repo: `avatar-3d` (Three.js-based 3D avatar rendering / control in browser)  
- Target platform: A2rchitech (Electron shell + capsule system; HUMAN vs AGENT renderer separation)

## Decisions and Positioning
### 1) Role of `avatar-3d` in A2rchitech
**Use it as a presentation-layer primitive only**:
- The repo is suitable as a **browser-safe 3D humanoid renderer** (Three.js + glTF/rigged avatar pipeline).
- It is *not* an “avatar system” for an agent by itself (no cognition, state model, speech sync, identity, or orchestration).
- Therefore it should be integrated as a **Capsule** that subscribes to agent state, never generating agent decisions.

**Architecture principle**: *Avatar renders; agent thinks.*

### 2) Boundary rule: no feedback loop
The avatar must not “think” or influence agent reasoning directly. It should be a **pure subscriber** to an intent/state bus.

- Agent Core emits: intent + speech timing + status
- Avatar Capsule renders: animation, pose, visemes, idle/thinking/speaking states
- The avatar never becomes a control plane.

This preserves deterministic orchestration and avoids recursion / coupling failures.

## Proposed Integration Design
### Placement in repo
Suggested structure (capsule-first):
```
/apps/shell
  /capsules
    /gizzi-avatar
      AvatarCanvas.tsx
      AvatarController.ts
      assets/ (gltf/vrm, animations)
      README.md
      contract/
        avatar.intent.schema.json
```

### Runtime mode
- **Runs under HUMAN renderer** (Electron BrowserView / UI surface).
- Subscribes to agent events; does not execute agent tools.
- Must be isolated from AGENT Playwright automation surface to avoid tool confusion and stage bounds/render issues.

### Control Contract (Intent Bus)
Minimum intent types (example set):
- idle
- thinking
- listening
- speaking (with intensity + timing hooks)
- ack
- error

This becomes a formal JSON schema so other components (voice engine, agent state machine) can target it consistently.

## Gaps (Non-Optional Work Still Required)
`avatar-3d` alone does **not** provide:

1. **Speech sync (visemes / phonemes)**
   - Need mapping from TTS output timing → mouth shapes (viseme blendshapes) or bone-based jaw/mouth rigs.
   - Requires a TTS engine that can output word/phoneme timestamps, or an approximation layer.

2. **Emotion/affect abstraction**
   - Must define a symbolic affect state (e.g., calm/confident/uncertain/alert) and map it to animation blends.
   - Avoid “emotion = facial expression” naive mapping. Keep it controlled and minimal.

3. **Performance gating**
   - FPS throttling, idle sleep, reduced update loops when minimized, GPU fallback.
   - Deterministic bounds and DPR handling inside Electron (important in A2rchitech due to windowed capsule system).

4. **Avatar identity spec**
   - Gizzi should be stylized with consistent geometry, palette, motion constraints.
   - Decide: GLTF-only vs VRM-only pipeline (VRM often simplifies humanoid + visemes, but adds constraints).

## A2rchitech Mapping
### A2rchitech Tier / Layer Mapping
- **UI / Presentation Layer**: avatar-3d (Three.js renderer) lives here.
- **Capsule Layer**: `gizzi-avatar` capsule encapsulates rendering, assets, controller.
- **State/Intent Bus**: subscribes to agent state emitted by Brain Runtime (or equivalent).
- **Agent Core**: emits intent; does not import avatar logic.
- **Voice Layer**: provides TTS + timestamp info to drive speaking animation.

### Law Layer / Guardrails Alignment (implicit)
- Treat avatar capsule as **read-only UI** with a strict contract.
- Changes to contract go through /spec Deltas and acceptance tests (if you choose to formalize).
- Avoid “UI thinking” and prevent cross-layer coupling.

## Action Plan (Concrete Next Steps)
1. **Fork** `0xGF/avatar-3d` into A2rchitech-owned namespace (or vendor it as a submodule).
2. Build `capsules/gizzi-avatar` wrapper:
   - Minimal render loop
   - Asset loading
   - Animation controller
3. Define and commit `avatar.intent.schema.json` (contract for intent events).
4. Integrate with A2rchitech event bus:
   - Subscribe to `agent_state` / `speech_state` events
   - Map to avatar intents
5. Decide avatar asset pipeline:
   - Pick rig format (VRM recommended if visemes are a priority; GLTF acceptable if you own the rig + blendshapes)
6. Add performance + Electron considerations:
   - DPR normalization
   - Resize handling
   - Idle sleep when hidden/minimized
7. Add acceptance checks:
   - Contract conformance tests (schema validation)
   - Basic render smoke test
   - Deterministic intent → animation mapping tests

## Open Questions (Tracked, Not Blocking)
- Should Gizzi avatar be:
  - a) Always-on sidebar presence, or
  - b) A summonable capsule window (recommended: summonable to reduce GPU load)?
- Do we prioritize:
  - a) stylized minimal face (low uncanny risk), or
  - b) higher realism with visemes (higher engineering + uncanny risk)?

## Output Artifact
This session is saved as:
- `a2r_session_2026-01-26_gizzi-avatar-3d.md`

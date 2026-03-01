# A2rchitech Session Summary — AgentOps Extension (A2R)
**Date:** 2026-01-26
**Topic:** AgentOps extension; Browser tab + dynamic miniapp capsules; remote-browser transport; CopilotKit/AG-UI/A2A integration; web agents.

---

## 1) UI IA Decision (keep tabs minimal)
**Keep existing essential tabs:**
- Chat
- Console
- Studio (multimodal / ComfyUI / agentic builders)
- Registry
- Marketplace
- Browser (in development)

**No extra “Mission Control” tab list.**  
Any additional complexity must live as **toggle modes within existing tabs**, especially Console and Browser.

---

## 2) Console as AgentOps Surface (modes inside Console)
Console is not “just logs”; it is the operational surface for agents + tools + workflows with internal modes:
- **Observe:** event/log/trace view (filtered by context)
- **Command:** terminal + command palette + quick actions (spawn/bind/run)
- **Visual:** abstract/RTS-like visualization of agent actions (optional)

**Rule:** One underlying state/event spine; multiple renderers.

---

## 3) Chat Tab Direction
Chat should remain **human-first** (conversation surface), not overloaded with separate “Direct/Delegate/Review” modes as a primary concept.
Instead: **context binding** (chat target pill) such as:
- Human → System
- Human → Agent
- Human → Workflow Run
This implies direct vs review vs delegate without adding visible mode clutter.

---

## 4) Studio Deep Dive (agentic builders + multimodal)
Studio is for **authoring** (not live operations):
- **Agent Builder** (definitions, permissions, bindings)
- **Workflow Builder** (DAG, versions, simulate/dry-run)
- **Multimodal/ComfyUI pipelines** (graphs that produce artifacts + reusable pipeline defs)
- **Artifacts & Templates** (outputs + reusable defs)

Studio outputs versioned definitions → **Registry**; execution/monitoring happens in **Console**.

---

## 5) End-to-End Flow (Browser → Studio → Registry → Console)
1. **Browser**: browse/search; capture page snapshots/clips; cite sources
2. **Studio**: convert artifacts into agents/workflows/pipelines
3. **Registry**: publish versioned definitions + permissions
4. **Console**: run workflows; observe/command/visualize; record runs + artifacts

---

## 6) Browser Tab Goals (miniapp capsules + gentabs-like clustering)
Browser must be a **real browsing surface** while supporting:
- **Clustered miniapp capsules** (Option A): “project/task clusters” that group pages + tools + agents
- **Overlay miniapps** (Option B): contextual cards on top of current page

**Decision leaning:** Option A (clustered) as primary organization, with Option B overlays as secondary behavior.

**Mockups produced:**
- browser_mockup_option_A.png
- browser_mockup_option_B.png

---

## 7) Core Problem: web-only browser not loading pages
If current approach is iframe/fetch-render, many sites won’t load due to CSP/X-Frame-Options and cross-origin constraints.
A “real browser engine” must render pages, either:
- embedded native webview (Electron/Tauri), or
- remote browser service streamed to the web app.

---

## 8) Remote Browser Transport Options (wrapper approach)
**Option 1:** screenshot-per-action (fast, but choppy)  
**Option 2:** WebSocket frame streaming (10–15 FPS; simpler than WebRTC)  
**Option 3:** WebRTC streaming (best UX; most complex ops)

**User preference:** Option 3 (WebRTC) long-term.

**Recommendation for de-risking:** implement **Option 2 first** on macOS (local service), then upgrade transport to WebRTC once stable.

---

## 9) CopilotKit, but proprietary (no Copilot branding)
Three levels:
- **A) Use core/runtime only** and build your own UI (no Copilot UI components) — best balance.
- **B) Fork/vendor CopilotKit** into internal packages (white-label, more maintenance).
- **C) Skip CopilotKit** if AG-UI/A2UI already covers requirements.

---

## 10) WebVM Consideration (Linux WASM VM in repo)
Potential simplification if WebVM provides a **usable GUI framebuffer** that can be drawn to canvas at practical FPS.
If WebVM is headless-only, it won’t replace the remote browser surface for interactive browsing.

Decision hinge:
- A) WebVM exposes interactive GUI framebuffer → WebVM-first plan viable
- B) Headless/CLI only → proceed with local browser-session-service streaming

---

## 11) Required Agent Types for Browser
All agents operate on the same **browser sessionId**:
- **Text Web Agent:** extract readable text/links/citations (server-side extraction)
- **Vision Web Agent:** interpret snapshots/keyframes for what’s actually rendered
- **Computer-Use Agent:** UI automation (UI-TARS widget already present in repo)

---

## 12) Planned Services (implementation gameplan)
Create:
- `services/browser-session-service/` (Playwright + streaming + input replay)
- `services/agui-gateway/` (AG-UI routing to capsules/sessions)
- `services/copilot-runtime/` (self-hosted CopilotKit runtime)
- `services/a2a-gateway/` (Agent2Agent discovery/tasks/artifacts bridging)

Frontend:
- `apps/shell/src/tabs/Browser/` (WebRTC/WS client + `<video>`/`<canvas>` surface)
- `apps/shell/src/capsules/` (AG-UI client surfaces for dynamic miniapp capsules)

---

## 13) Downloads / Installs (captured)
Frontend:
- `@copilotkit/react-core` (and optionally `@copilotkit/react-ui` only if needed)
- `@ag-ui/client`, `@ag-ui/core`

Backend:
- `@copilotkit/runtime`
- `playwright`, `express`, `ws`, `cors`
- WebRTC lib (e.g. `werift`) OR later SFU stack

A2A:
- `@a2a-js/sdk`

UI-TARS:
- already downloaded/in repo.

---

## 14) Key Open Decisions / Next Actions
1. Confirm runtime: web-only vs electron/tauri (affects whether streaming is required)
2. Confirm WebVM capability: GUI framebuffer vs headless-only
3. Choose MVP transport: **WebSocket streaming first** vs jumping directly to WebRTC
4. Implement Browser clusters (Option A) with **dynamic AG-UI capsules**:
   - capsules subscribe to streams
   - emit actions/tool calls
   - spawn agents/workflows via Console/Registry definitions

---

**End of session summary.**

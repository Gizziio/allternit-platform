# Agent Mode and Session Architecture

> Status: Draft for implementation
> Scope: `6-ui/a2r-platform` shell, session routing, surface rendering, and agent-specific UI modules
> Date: 2026-02-28

## Why This Spec Exists

The current UI has the right raw ingredients, but the wrong composition:

- agent mode exists as a surface toggle
- agent selection is starting to exist in the composer
- agent sessions exist as backend session records
- a generic `NativeAgentView` was added as a standalone destination

That last part is the main design failure.

An agent session should not feel like a different product with a generic fallback workspace. It should feel like the same surface the user started in, with an "agent engaged" state layered on top of it.

The target model is:

- `Chat` can become a `Chat Agent Session`
- `Cowork` can become a `Cowork Agent Session`
- `Code` can become a `Code Agent Session`
- `Browser` can become a `Browser Agent Session`

The session stays in its originating surface. The shell should never force the operator into a fifth, generic "agent workspace" just because the session is agent-backed.

---

## Product Positioning

The shell needs two distinct concepts:

### Conversations

This is where active work happens.

- chat sessions
- cowork sessions
- code sessions
- browser sessions
- their agent-backed variants
- project grouping
- recent vs archived history

### Agents

This is where agent systems are configured and controlled.

- agent definitions
- identity
- tools
- rails and policy posture
- templates
- automations
- advanced orchestration

`Agents` is not where day-to-day agent conversations should live.

`Agent mode` is also not a top-level destination. It is a mode inside the working surfaces.

---

## Core Principles

1. Agent sessions stay in the surface they were started from.
2. Agent mode is selected in the input/composer, not in a detached control page.
3. The UI delta between regular and agent sessions is additive, not a replacement.
4. Surface identity stays intact.
5. Agent-specific controls are contextual utilities, not a giant all-purpose dashboard.
6. The shell rail should launch and organize sessions, not become the workspace itself.
7. `Agents` in the left rail means customization and control, not active conversation inventory.

---

## Current Truth

The current implementation is partially wired, not fully finished.

### What already works

- The mode store is already surface-aware in `src/stores/agent-surface-mode.store.ts`.
- The stream adapter can already carry agent context such as `agentId`, `agentName`, `agentProvider`, `agentModel`, and `agentSessionKey`.
- `ChatView`, `CoworkRoot`, and `CodeCanvas` are already starting to pass agent context into send/regenerate flows.
- The composer already has the beginning of an agent toggle plus agent selection model.

### What is still incomplete or wrong

- Agent sessions are still rendered through a generic `NativeAgentView`, which breaks surface continuity.
- Browser agent mode is still the weakest implementation and still contains placeholder response behavior.
- The agent registry is not reliably available in the local environment, so selection can degrade into offline state.
- The session create contract does not yet fully persist origin-surface identity in a first-class way.
- The current generic agent workspace styling does not match the a2r brand language or the source surfaces.

Conclusion:

Agent mode is not fake, but it is not end-to-end complete yet. It is best described as "partially real, with real transport wiring and incomplete surface architecture."

---

## Target Information Architecture

## Left Rail

### Conversations

This becomes the primary work entry for all live sessions.

Contents:

- compact search
- top utility widget for recent vs archived
- projects section at the top
- chats subsection
- agent sessions subsection

Rules:

- projects stay mounted at the top
- history does not consume a whole row section; it lives as a compact icon widget
- empty state hints appear only when a subsection has zero items
- once sessions exist, the empty hint disappears

The subsection labels should read like inventory, not like cards:

- `Chats`
- `Agent Sessions`
- `Projects`

### Agents

This sits below `Conversations` and is strictly for configuration/control surfaces:

- Agent Studio
- Agent System
- templates
- tools
- policy and rails
- automations

It does not own active conversation sessions.

---

## Session Taxonomy

Every session needs two axes:

### 1. Origin surface

- `chat`
- `cowork`
- `code`
- `browser`

### 2. Runtime mode

- `regular`
- `agent`

This yields:

- regular chat session
- chat agent session
- regular cowork session
- cowork agent session
- regular code session
- code agent session
- regular browser session
- browser agent session

This metadata should be stored with the session record.

Recommended metadata shape:

```json
{
  "origin_surface": "chat",
  "session_mode": "agent",
  "agent_id": "agent-123",
  "agent_name": "Research Operator",
  "project_id": "project-456",
  "workspace_scope": "agent:agent-123",
  "agent_features": {
    "workspace": true,
    "tools": true,
    "automation": true
  }
}
```

If backend session creation cannot persist this at creation time yet, the UI should patch it immediately after session creation rather than falling back to a separate route.

---

## Entry Flow

## Regular Session

1. User opens `Chat`, `Cowork`, `Code`, or `Browser`.
2. Composer is in standard mode.
3. Session behaves exactly like the existing surface.

## Agent Session

1. User opens one of the four working surfaces.
2. User toggles `Agent On` in the composer.
3. User chooses an agent from the adjacent agent selector.
4. On first send, the system creates or upgrades a session with:
   - origin surface
   - agent mode
   - selected agent identity
5. The current surface stays in place.
6. The UI shifts into an agent-engaged version of that same surface.

There should be no redirect into a generic `NativeAgentView` after step 4.

---

## Shared Interaction Model

All four surfaces should share the same agent activation pattern.

## Composer Controls

The composer row should contain:

- agent mode toggle
- agent selector
- model selector
- normal send controls

Rules:

- if `Agent On` is selected and no agent is chosen, send is blocked with a clear inline reason
- selected agent stays scoped per surface
- selected agent is visible before the first message and throughout the session

## After First Agent Message

Once the session becomes agent-backed, the source surface keeps its layout but gains a small set of shared agent modules:

- `Agent Context Strip`
- `Workspace Drawer`
- `Tools Drawer`
- `Automation Drawer`
- `Session Status Chip`

These modules should feel native to the surface, not stapled on top of it.

---

## Shared Agent Modules

These are reusable UI modules, but they are rendered inside each surface.

## 1. Agent Context Strip

A compact strip near the top of the transcript/workspace that shows:

- selected agent identity
- live state: idle, running, paused, local draft, offline
- current workspace scope
- active project
- last checkpoint or last tool activity

This is not a hero banner. It should be one row, compact, and brand-consistent.

## 2. Workspace Drawer

Purpose:

- show agent workspace files
- highlight recent artifacts
- expose open/edit/download actions

Content:

- identity files
- memory files
- governance files
- active artifacts created during the session

Behavior:

- hidden by default
- opens as a drawer, sheet, or side utility depending on surface
- file presence is visible via count or badge even when collapsed

## 3. Tools Drawer

Purpose:

- show tool posture and recent tool activity

Content:

- enabled tools
- blocked tools
- last tool calls
- tool receipts or result snippets

Behavior:

- compact by default
- transcript cards link into it when tool activity occurs

## 4. Automation Drawer

Purpose:

- cron jobs
- recurring tasks
- watch conditions
- scheduled runs

Content:

- next run time
- schedule status
- last run status
- quick pause/resume

This does not need to dominate the UI. It should feel like an operator utility, not the main conversation surface.

## 5. Session Status Chip

This is the always-visible compact state indicator.

It should expose:

- connected or local draft
- runtime mode
- checkpoint presence
- unsynced changes when relevant

---

## Surface-Specific Rendering

## Chat Agent Session

Base:

- keep the current chat background and transcript rhythm
- keep the current composer placement

Agent-specific additions:

- agent context strip above transcript or below page title
- workspace drawer as a right-side utility or slide-over
- tool events rendered inline as elegant trace cards
- automation accessible from a compact utility button

Visual delta:

- subtle perimeter gradient sweep when agent mode is enabled
- agent-colored accent ring around the composer
- transcript cards gain richer tool and artifact affordances

This should still feel like chat, not like an admin console.

## Cowork Agent Session

Base:

- keep the existing chat-first center column
- keep the existing right rail concept

Agent-specific additions:

- fold workspace, tools, and automation into the existing right rail
- preserve cowork progress/checklist semantics
- show agent identity and run state at the top of the rail

This surface is the natural home for long-running operational agent sessions.

## Code Agent Session

Base:

- keep the current code workspace, editor, and transcript relationship
- keep model/workspace/session switching native to code mode

Agent-specific additions:

- workspace files become a first-class utility because code sessions naturally produce artifacts
- tool trace should emphasize file edits, shell work, diagnostics, and checkpoints
- automation should be secondary, behind a utility toggle

The code surface should feel like "paired engineering with an agent", not "chat with a code-themed wrapper."

## Browser Agent Session

Base:

- keep the browser viewport and sidecar chat relationship

Agent-specific additions:

- task goal strip
- action history
- extracted findings
- browser tool summary
- optional automation/watch state

This should feel like browser control with an agent companion, not a standalone chat box.

Browser is currently the least complete surface and needs direct implementation work, not just styling.

---

## Visual System and Brand Direction

The a2r brand language in the working surfaces already leans warm, tactile, and editorial rather than generic enterprise dashboards. Agent sessions should intensify that language, not abandon it.

Rules:

- do not switch to a generic blue-gray control panel look
- do not create a new universal agent background that overrides the source surface
- keep each source surface's palette and materials
- add agent state through motion, accent light, and utility components

## Agent Activation Motion

When `Agent On` is toggled or when the first agent message is sent:

- a soft perimeter sweep should travel around the full active surface
- the composer should receive a short-lived agent accent halo
- the surface should settle into its agent-engaged state with no hard scene cut

This motion is the state change signal the user asked for. It should feel closer to a captured-focus or screenshot flash than to a loud celebratory animation.

## Suggested Accent Logic

The accent should be surface-relative, not arbitrary:

- chat: warm sand / ember
- cowork: amber / editorial brass
- code: burnished copper / graphite highlight
- browser: muted teal / sand blend

The base surface stays recognizable. The accent only signals agent engagement.

---

## What Happens to `NativeAgentView`

`NativeAgentView` should stop being the primary destination for agent sessions.

Recommended role after redesign:

- short-term: keep it as a development bridge and migration surface
- medium-term: extract its useful pieces into shared modules
- long-term: remove it from primary shell navigation for active work

Likely reusable pieces:

- message/tool rendering utilities
- canvas/file/action primitives
- session patching helpers
- sync status logic

The view itself should not remain the canonical user experience.

---

## Backend and Contract Requirements

The current backend is close, but a few contracts need to become explicit.

## Session metadata

Every agent session needs:

- origin surface
- session mode
- selected agent id
- selected agent display name
- project id when relevant

## Agent workspace data

The UI needs stable access to:

- workspace root
- file tree or artifact list
- checkpoints
- tool activity
- automation schedules

If the backend does not expose all of these yet, the UI should not fake a full workspace dashboard. It should render only the modules backed by real data.

## Known current gaps

- `create_session` currently accepts `agent_id` and `model` but does not visibly use them in the Rust route implementation.
- Browser-side agent chat still contains placeholder response logic.
- Agent registry availability is still environment-dependent.
- Automation/cron is not yet exposed as a first-class runtime-backed UI contract in this surface set.

---

## Implementation Plan

## Phase 1: Remove the generic product split

Goal:

Stop routing active agent work into a standalone generic agent page.

Work:

- keep session inventory in `Conversations`
- open agent sessions back into their origin surface
- persist `origin_surface` and `session_mode`
- make composer-based agent selection the only entry into new agent sessions

Primary files:

- `src/views/ChatView.tsx`
- `src/views/cowork/CoworkRoot.tsx`
- `src/views/code/CodeCanvas.tsx`
- `src/capsules/browser/BrowserChatPane.tsx`
- `src/views/chat/ChatComposer.tsx`
- `src/stores/agent-surface-mode.store.ts`
- `src/lib/agents/native-agent.store.ts`
- `src/lib/agents/native-agent-api.ts`
- shell rail and navigation files

## Phase 2: Build shared agent modules

Goal:

Extract small, reusable agent UI parts instead of keeping one giant agent page.

Modules:

- `AgentContextStrip`
- `AgentWorkspaceDrawer`
- `AgentToolsDrawer`
- `AgentAutomationDrawer`
- `AgentStatusChip`

These should live in shared UI folders and be composed differently per surface.

## Phase 3: Surface-native integration

Goal:

Make each surface feel like itself in agent mode.

Work:

- chat agent session integration
- cowork rail integration
- code workspace integration
- browser sidecar integration

## Phase 4: Contract hardening

Goal:

Make the UI fully truthful.

Work:

- session metadata persistence
- real workspace file endpoints
- real automation/cron endpoints
- reliable agent registry availability
- browser agent event stream parity

---

## Acceptance Criteria

The redesign is successful when all of these are true:

1. Starting agent mode in `Chat` keeps the user in the chat surface.
2. Starting agent mode in `Cowork` keeps the user in the cowork surface.
3. Starting agent mode in `Code` keeps the user in the code surface.
4. Starting agent mode in `Browser` keeps the user in the browser surface.
5. Agent sessions appear in `Conversations`, not under `Agents`.
6. `Agents` only contains customization and control surfaces.
7. Each agent session clearly shows agent-specific state, tools, and workspace utilities without losing the original surface identity.
8. No generic fallback agent page is required for normal daily use.
9. If backend capabilities are unavailable, the UI degrades honestly instead of pretending the feature exists.

---

## Recommended Immediate Next Slice

The next implementation slice should be:

1. route existing agent sessions back into their source surface
2. demote `NativeAgentView` from primary navigation
3. add a compact shared `AgentContextStrip`
4. add a first real `Workspace Drawer` in `Chat` and `Code`
5. leave automation as a compact placeholder until the runtime contract is real

That gets the product shape right before more visual polish is layered on top.

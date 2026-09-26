# Allternit Subscription Capability Fabric

## Agent Handoff Specification

**Status:** Initial architecture lock / implementation handoff  
**Date:** 2026-09-25  
**Project:** Allternit  
**Purpose:** Turn underused capabilities from paid consumer AI subscriptions into a normalized, provider-agnostic capability layer that Allternit Bots and Threads can invoke programmatically.

---

# 1. Executive Summary

Most AI subscriptions expose significantly more value than a single chat box. A paid account may include some combination of:

- high-limit chat
- reasoning models
- image generation and editing
- research
- file analysis
- document generation
- presentation generation
- spreadsheet generation
- website/app generation
- projects/workspaces
- scheduled tasks
- coding surfaces
- artifact creation and editing

Users often do not consume the full value of these subscriptions because they must manually visit each provider website and use each capability separately.

Allternit should introduce a **Subscription Capability Fabric** that treats these paid subscription features as addressable entitlements.

The core idea:

```text
User's paid subscriptions
        ↓
Provider adapters
        ↓
Entitlement + capability registry
        ↓
Capability Router
        ↓
Allternit Bots / Threads / Agents
```

This is not merely a `/chat` wrapper. It is a normalized execution layer for subscription-backed capabilities and the artifacts those capabilities create.

The desired end state is that an Allternit Bot can request:

```text
"generate an image"
"build a website"
"create a deck"
"make a spreadsheet"
"run deep research"
"continue this chat thread"
"create a document"
```

without needing to know which provider UI implements the task.

The router selects the best available entitlement already paid for by the user before falling back to metered API usage.

---

# 2. Problem Statement

A user may pay for several subscriptions such as:

- ChatGPT
- Claude
- Kimi
- Gemini
- Grok
- other AI/productivity subscriptions

The problem is not simply model access.

The problem is that valuable subscription entitlements are trapped behind separate web or desktop interfaces.

Examples:

- ChatGPT may expose normal chat, reasoning, image generation, file analysis, research and other tools.
- Claude may expose normal chat, artifacts, projects, research and coding-related features.
- Kimi may expose chat, websites, documents, presentations, spreadsheets, research, projects and coding-related features.

A user may have large unused capacity in one surface while paying metered API costs somewhere else.

Allternit should reclaim this stranded value.

---

# 3. Product Thesis

The unit of value is not the model.

The unit of value is the **entitlement**.

Represent the system as:

```text
ACCOUNT
  └── SUBSCRIPTION
        └── ENTITLEMENT
              ├── capability
              ├── quota
              ├── reset window
              ├── restrictions
              ├── provider surface
              └── execution adapter
```

Allternit should route work based on required capability, economic cost, quality, quota availability and execution reliability.

---

# 4. Core Architecture

```text
                         ALLTERNIT
                Subscription Capability Fabric

                              │
                       Capability Router
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
   ChatGPT                Claude                  Kimi
   Adapter                Adapter                 Adapter
       │                      │                      │
       ▼                      ▼                      ▼
  Paid Account           Paid Account            Paid Account
       │                      │                      │
  chat/images/etc.      chat/artifacts/etc.    chat/web/docs/etc.
```

Allternit Bots should not directly know provider-specific mechanics.

Bots request capabilities.

Example:

```json
{
  "capability": "image.generate",
  "provider": "auto",
  "prompt": "Create a prestige magazine cover illustration."
}
```

or:

```json
{
  "capability": "website.create",
  "provider": "auto",
  "prompt": "Build a landing page for this project."
}
```

or:

```json
{
  "capability": "presentation.create",
  "provider": "auto",
  "prompt": "Create a 12-slide strategy deck from this research."
}
```

The router chooses the entitlement.

---

# 5. Provider Adapter Principle

Each provider should have a replaceable adapter.

```text
Allternit Capability API
        │
        └── Provider Adapter
                │
                └── Provider Surface
```

Adapters must be disposable.

A UI change in one provider must not require changes to the Bot/Thread layer.

Example:

```text
KimiAdapter v1 → breaks due to UI change
KimiAdapter v2 → replaces it
```

No caller changes.

---

# 6. Execution Interfaces

Adapters can use different execution mechanisms.

Each capability should record its execution mode.

## 6.1 Supported machine interface

Examples:

- official API
- official CLI
- official connector
- documented automation interface

Tag:

```yaml
interface: official
```

## 6.2 Subscription UI bridge

Examples:

- browser automation
- desktop app automation

Tag:

```yaml
interface: ui_bridge
```

UI bridges are less stable and may have provider-specific terms or restrictions. They should never be treated as equivalent to a supported API.

Allternit should store a reliability/risk score per adapter.

---

# 7. Why Web Automation Is Usually Better Than Desktop Automation

For consumer subscription access, browser automation is generally the preferred first implementation when the provider has a capable web app.

## Web advantages

- inspectable DOM
- browser lifecycle events
- persistent profiles
- URL/thread IDs
- cookies/session state
- Playwright/CDP support
- deterministic selectors
- easier text extraction
- easier multi-session isolation
- easier screenshots and file downloads

## Desktop advantages

- local-file integration
- OS permissions
- access to desktop-only features
- potentially richer local agent capabilities

## Desktop disadvantages

- accessibility-tree dependence
- focus/window-state dependence
- keyboard shortcut dependence
- harder text/state extraction
- more brittle UI state

Recommended order:

```text
1. official machine interface
2. provider web bridge
3. desktop bridge only where the desktop surface exposes unique value
```

---

# 8. Local Gateway

Run one local daemon rather than one browser per Bot.

```text
Bot A ─┐
Bot B ─┼──► Subscription Gateway ─► Provider workers
Bot C ─┘
```

Suggested local base URL:

```text
http://127.0.0.1:7788
```

Suggested API surface:

```text
POST   /v1/tasks
GET    /v1/tasks/{task_id}
POST   /v1/chat
POST   /v1/research
POST   /v1/images
POST   /v1/documents
POST   /v1/presentations
POST   /v1/spreadsheets
POST   /v1/websites
POST   /v1/code
POST   /v1/projects
GET    /v1/artifacts/{artifact_id}
GET    /v1/providers
GET    /v1/providers/{provider}/capabilities
GET    /v1/entitlements
```

---

# 9. Capability Taxonomy

Do not normalize everything to `/chat`.

Define capability names directly.

## Chat

```text
chat.thread.create
chat.thread.continue
chat.message
chat.thread.list
```

## Images

```text
image.generate
image.edit
image.variations
image.download
```

## Research

```text
research.run
research.continue
research.export
```

## Documents

```text
document.create
document.edit
document.export
```

## Presentations

```text
presentation.create
presentation.edit
presentation.export
```

## Spreadsheets

```text
spreadsheet.create
spreadsheet.edit
spreadsheet.analyze
spreadsheet.export
```

## Websites / Apps

```text
website.create
website.modify
website.preview
website.publish
website.export
```

## Projects

```text
project.create
project.open
project.list
project.attach_file
project.continue
```

## Files

```text
file.upload
file.download
file.analyze
```

## Generic tasks

```text
task.create
task.status
task.cancel
```

---

# 10. Provider Capability Manifest

Every adapter must expose a machine-readable capability manifest.

Example:

```yaml
provider: kimi
adapter_version: 1
interface: ui_bridge

capabilities:
  chat:
    thread_create: true
    thread_continue: true

  research:
    run: true

  document:
    create: true
    export:
      - docx
      - pdf

  presentation:
    create: true
    export:
      - pptx

  spreadsheet:
    create: true
    export:
      - xlsx

  website:
    create: true
    modify: true
    publish: true

  project:
    persistent: true

quota:
  pool: membership
  visibility: estimated

reliability:
  score: 0.70
```

Example ChatGPT manifest:

```yaml
provider: chatgpt
adapter_version: 1
interface: ui_bridge

capabilities:
  chat:
    thread_create: true
    thread_continue: true

  reasoning:
    available: true

  image:
    generate: true
    edit: true

  research:
    run: true

  files:
    upload: true
    analyze: true

  projects:
    persistent: true

quota:
  dynamic: true
  exact_remaining_unknown: true
```

Never hard-code a capability as unlimited unless the provider explicitly guarantees unlimited use.

---

# 11. Entitlement Model

Suggested internal structure:

```json
{
  "provider": "chatgpt",
  "account_id": "acct_local_01",
  "subscription": "plus_or_pro",
  "entitlements": [
    {
      "capability": "chat.message",
      "available": true,
      "pool": "chat",
      "remaining": null,
      "reset_at": null,
      "remaining_unknown": true
    },
    {
      "capability": "image.generate",
      "available": true,
      "pool": "image",
      "remaining": null,
      "remaining_unknown": true
    }
  ]
}
```

Quota information can come from:

- documented provider rules
- account UI
- observed usage
- local counters
- error responses

Unknown values must remain unknown rather than being fabricated.

---

# 12. Router Policy

The router chooses providers based on policy.

Suggested default priority:

```text
1. already-paid subscription entitlement
2. local compute
3. bundled/remaining provider credits
4. metered API
```

Selection should consider:

- capability support
- quota availability
- expected quality
- context requirements
- artifact support
- latency
- provider reliability
- task privacy requirements
- subscription cost already sunk
- incremental cost
- thread continuity

Example:

```text
Request: image.generate

Available:
ChatGPT subscription   ✓
Kimi subscription      ✓
OpenAI API             ✓
Local model            ✓

Policy:
Use already-paid subscription first unless reliability/quality requirements force another route.
```

---

# 13. Artifact System

Artifacts must be first-class objects.

A provider task should never collapse an output such as a website or PPT into only text saying "done."

Example response:

```json
{
  "task_id": "tsk_7182",
  "provider": "kimi",
  "capability": "website.create",
  "status": "completed",
  "artifacts": [
    {
      "artifact_id": "art_91ab",
      "type": "website",
      "title": "Allternit Architecture",
      "provider_artifact_id": "provider_specific_id",
      "preview_url": "provider_or_local_preview",
      "editable": true,
      "downloadable": true
    }
  ]
}
```

Supported canonical artifact types should include:

```text
text
image
document
pdf
presentation
spreadsheet
website
code_project
archive
video
audio
```

Artifact metadata:

```text
artifact_id
provider
provider_artifact_id
capability
type
mime_type
title
created_at
thread_id
project_id
preview_url
download_path
editable
export_formats
source_task_id
```

---

# 14. Artifact Normalization

Normalize provider outputs into Allternit artifacts.

Examples:

```text
ChatGPT generated image
        ↓
Artifact(type=image)
```

```text
Claude HTML artifact
        ↓
Artifact(type=website or html_app)
```

```text
Kimi presentation
        ↓
Artifact(type=presentation, format=pptx)
```

```text
Kimi spreadsheet
        ↓
Artifact(type=spreadsheet, format=xlsx)
```

Allternit surfaces should be able to render, download, reopen and continue working on these artifacts where provider behavior allows it.

---

# 15. Thread Mapping

Allternit Bots use durable Threads.

Each Allternit thread can map to a real provider conversation or project.

Example:

```text
Allternit Thread
thr_a91c

      ↓ provider mapping

ChatGPT conversation
provider_thread_id = abc123
```

Suggested mapping object:

```json
{
  "thread_id": "thr_a91c",
  "provider": "chatgpt",
  "provider_thread_id": "abc123",
  "provider_url": "https://chatgpt.com/c/...",
  "last_used_at": "...",
  "status": "active"
}
```

This enables:

- conversation continuity
- provider context retention
- project continuity
- reusing generated artifacts
- reduced repeated prompting

---

# 16. Relationship to Bots

Target architecture:

```text
Project
  ├── Coordinator Thread
  │
  └── Bot
       ├── Thread
       ├── Thread
       └── Thread
            │
            ▼
       Capability Router
            │
       ┌────┼────┐
       ▼    ▼    ▼
   ChatGPT Claude Kimi
```

Bots should request intent/capability, not providers.

Preferred:

```text
"I need an image"
```

instead of:

```text
"Call ChatGPT"
```

Provider forcing remains available when needed:

```json
{
  "provider": "chatgpt",
  "capability": "image.generate"
}
```

---

# 17. Provider Worker Model

Do not launch one independent browser per request.

Use persistent provider workers.

```text
Subscription Gateway
   │
   ├── ChatGPTWorker
   ├── ClaudeWorker
   └── KimiWorker
```

Each worker should manage:

- authenticated persistent profile/session
- request queue
- active task state
- thread tabs/pages
- downloads
- generated artifacts
- retries
- provider-specific selectors
- quota detection
- error detection

---

# 18. Suggested Browser Stack

Preferred implementation stack for UI bridges:

```text
Python or TypeScript service
        ↓
Playwright
        ↓
Persistent Chromium profile
        ↓
Provider website
```

Chromium DevTools Protocol can be used where Playwright is insufficient.

Important:

- Do not store user passwords in Allternit.
- Allow the user to log in interactively.
- Reuse the authenticated persistent browser profile.
- Prefer provider-visible normal authentication.
- Avoid bypassing authentication, quota enforcement or service restrictions.

---

# 19. Queueing and Concurrency

Consumer subscription UIs are generally not API-grade concurrency surfaces.

Start conservatively.

Per-provider queue:

```text
ChatGPT queue
Claude queue
Kimi queue
```

Default concurrency:

```text
1 active UI task per provider worker
```

Increase only after verifying stability.

Tasks must expose state:

```text
queued
running
waiting_provider
streaming
artifact_ready
completed
failed
cancelled
```

---

# 20. Task Object

Suggested task schema:

```json
{
  "task_id": "tsk_001",
  "capability": "presentation.create",
  "provider": "auto",
  "thread_id": "thr_optional",
  "project_id": "prj_optional",
  "prompt": "Create a strategy deck",
  "inputs": [],
  "options": {
    "format": "pptx"
  },
  "status": "queued",
  "created_at": "..."
}
```

---

# 21. Generic Request Example

```http
POST /v1/tasks
```

```json
{
  "capability": "document.create",
  "provider": "auto",
  "prompt": "Turn the attached research into a formal report.",
  "inputs": [
    {
      "type": "file",
      "path": "/workspace/research.md"
    }
  ],
  "options": {
    "preferred_format": "docx"
  }
}
```

Response:

```json
{
  "task_id": "tsk_8021",
  "status": "queued"
}
```

---

# 22. Provider Selection Example

Router receives:

```json
{
  "capability": "website.create",
  "provider": "auto"
}
```

Evaluation:

```text
Kimi subscription
- capability available: yes
- subscription already paid: yes
- current entitlement available: yes
- estimated incremental cost: $0
- reliability: medium

Claude subscription
- capability available through artifact path: maybe
- subscription already paid: yes
- reliability: medium

API provider
- capability available: yes
- metered cost: > $0
```

Default result:

```text
Select Kimi subscription adapter.
```

---

# 23. Observability

All subscription-backed tasks should be observable like Bots.

Record:

```text
task ID
provider
capability
selected entitlement
thread/project mapping
queued_at
started_at
completed_at
status
artifact outputs
retry count
failure reason
quota signal
estimated avoided API cost
```

This should appear in Allternit observability surfaces.

---

# 24. Economic Accounting

The router should measure both actual cost and avoided cost.

Example:

```json
{
  "provider": "chatgpt_subscription",
  "incremental_cost": 0,
  "estimated_equivalent_api_cost": 0.42,
  "avoided_cost": 0.42
}
```

This is useful because the purpose of the fabric is partly to reclaim value from subscriptions that would otherwise go unused.

Do not imply a subscription task is literally free. It is prepaid/sunk-cost capacity with potentially limited quota.

---

# 25. Security

Requirements:

- bind local gateway to localhost by default
- require local auth token if exposed beyond localhost
- never log provider passwords
- never persist sensitive cookies outside controlled profile storage
- encrypt account/session metadata at rest
- isolate provider profiles
- redact secrets from screenshots/logs
- provide session revoke/disconnect controls
- allow user to open provider session manually

Do not attempt to bypass provider security systems.

---

# 26. Terms / Reliability Boundary

Consumer subscription UIs are not automatically equivalent to supported APIs.

The system must clearly distinguish:

```text
OFFICIAL
provider-supported programmatic execution

UI_BRIDGE
browser/desktop automation of a user-facing subscription surface
```

The system should not:

- bypass usage limits
- defeat captchas or anti-abuse controls
- circumvent paid access
- misrepresent account ownership
- harvest other users' sessions
- automate accounts the user does not control

If a provider disallows a specific form of automation, its adapter should be disabled or restricted accordingly.

---

# 27. MVP Scope

Do not build every provider and every capability at once.

## Phase 1 — Core fabric

Build:

- local gateway
- task schema
- provider interface
- capability registry
- entitlement registry
- artifact model
- provider selection router
- SQLite/Postgres state store
- basic observability

No provider-specific complexity in core.

## Phase 2 — ChatGPT web adapter

Implement:

- authenticated persistent browser session
- create chat thread
- continue chat thread
- send prompt
- detect streaming/completion
- extract response text
- map Allternit thread ↔ provider thread
- basic image-generation path if stable
- artifact download where exposed

## Phase 3 — Kimi web adapter

Prioritize artifact-producing capabilities:

- chat
- research
- document creation
- presentation creation
- spreadsheet creation
- website creation
- artifact capture/download

## Phase 4 — Claude web adapter

Implement:

- chat
- thread continuation
- artifacts
- projects where practical
- research/tool surfaces where practical

## Phase 5 — Router intelligence

Add:

- capability ranking
- entitlement awareness
- quota estimation
- reliability scores
- policy controls
- fallback chain
- avoided-cost tracking

## Phase 6 — Allternit UI

Expose:

- subscriptions page
- provider connection state
- capability inventory
- task history
- artifacts
- entitlement status
- estimated unused capacity
- economic savings

---

# 28. Recommended Repository Layout

```text
subscription-fabric/
├── apps/
│   └── gateway/
├── core/
│   ├── capabilities/
│   ├── entitlements/
│   ├── router/
│   ├── tasks/
│   ├── artifacts/
│   └── observability/
├── adapters/
│   ├── chatgpt/
│   ├── claude/
│   └── kimi/
├── browser/
│   ├── profiles/
│   ├── playwright/
│   └── selectors/
├── storage/
├── tests/
└── docs/
```

---

# 29. Adapter Interface

Suggested interface:

```ts
interface SubscriptionAdapter {
  provider: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<AdapterHealth>;

  capabilities(): Promise<CapabilityManifest>;
  entitlements(): Promise<EntitlementState[]>;

  execute(task: CapabilityTask): Promise<TaskResult>;
  cancel(taskId: string): Promise<void>;

  listArtifacts?(threadId?: string): Promise<Artifact[]>;
  downloadArtifact?(artifactId: string): Promise<ArtifactFile>;
}
```

Provider-specific behavior must remain behind this interface.

---

# 30. Capability Router Interface

```ts
interface CapabilityRouter {
  resolve(task: CapabilityTask): Promise<RouteDecision>;
}
```

Example result:

```json
{
  "provider": "kimi",
  "adapter": "kimi_web_v1",
  "capability": "presentation.create",
  "reason": "prepaid entitlement available; supports PPTX artifact; no metered cost",
  "fallbacks": [
    "claude_web_v1",
    "openai_api"
  ]
}
```

---

# 31. Failure Handling

Adapters must classify failures.

```text
auth_required
quota_exhausted
rate_limited
provider_ui_changed
selector_not_found
provider_error
artifact_generation_failed
download_failed
network_error
user_intervention_required
unsupported_capability
```

Fallback example:

```text
Kimi presentation.create
      ↓ quota exhausted
Claude artifact path
      ↓ unsupported export
Paid API fallback
```

Fallback should honor user policies.

---

# 32. User Policy Controls

Users should be able to set rules such as:

```yaml
routing:
  prefer_prepaid_subscriptions: true
  allow_metered_api_fallback: false

providers:
  chatgpt:
    enabled: true
  kimi:
    enabled: true
  claude:
    enabled: true

privacy:
  local_only_for_sensitive_tasks: true
```

Potential additional rules:

```text
never use provider X for source code
use ChatGPT first for images
use Kimi first for presentations/websites
use Claude first for long-form artifact editing
API fallback requires confirmation
```

---

# 33. Quota Strategy

Consumer providers often do not expose precise remaining quota.

Therefore quota state supports:

```text
known
estimated
unknown
exhausted
```

Use a hybrid method:

1. provider-visible limit information
2. documented reset windows
3. local usage counters
4. observed warnings
5. observed hard failures

Do not attempt to evade provider limits.

---

# 34. Session Handling

Each provider should use a dedicated profile.

Example:

```text
~/.allternit/subscriptions/chatgpt/profile
~/.allternit/subscriptions/claude/profile
~/.allternit/subscriptions/kimi/profile
```

First connection flow:

```text
allternit subscriptions connect chatgpt
        ↓
opens visible browser
        ↓
user signs in normally
        ↓
session stored in persistent browser profile
        ↓
adapter health becomes READY
```

No password capture.

---

# 35. Suggested CLI

```bash
allternit subs list
allternit subs connect chatgpt
allternit subs connect kimi
allternit subs connect claude

allternit caps list
allternit caps list --provider kimi

allternit task run image.generate --provider auto --prompt "..."
allternit task run website.create --provider kimi --prompt "..."

allternit artifacts list
allternit artifacts open art_91ab
```

---

# 36. Example Allternit Bot Usage

```ts
const result = await capabilities.run({
  capability: "presentation.create",
  provider: "auto",
  prompt: "Turn the attached market research into a 12-slide deck.",
  inputs: [researchFile],
  options: {
    outputFormat: "pptx"
  }
});
```

Bot receives normalized artifact metadata rather than provider UI details.

---

# 37. Product UI Concept

## Subscriptions page

Show:

```text
ChatGPT       Connected
Claude        Connected
Kimi          Connected
Gemini        Not connected
```

For each provider:

```text
Capabilities
- Chat
- Images
- Research
- Documents
- Websites
...

Execution method
- Official / UI bridge

Quota
- available / estimated / unknown / exhausted
```

## Artifact shelf

All generated subscription-backed artifacts should appear in a unified Allternit shelf.

Filters:

```text
provider
type
project
bot
thread
date
```

---

# 38. Non-Goals for MVP

Do not initially attempt:

- unrestricted parallel browser farming
- bypassing rate limits
- reverse engineering private provider APIs as a dependency
- defeating anti-bot systems
- headless-only operation where login/security flows require user interaction
- supporting every provider
- perfectly predicting quota
- replacing official APIs for production-critical high-throughput workloads

---

# 39. Success Criteria

The MVP is successful when:

1. A user can connect at least one paid AI subscription without entering their password into Allternit.
2. Allternit can enumerate that provider's supported capabilities.
3. A Bot can request a capability without knowing the provider implementation.
4. The router can select a prepaid subscription entitlement.
5. A provider worker can execute the task through the connected subscription surface.
6. Chat threads can persist across calls.
7. Generated artifacts can be captured and normalized.
8. Artifact metadata is visible to the caller.
9. Failures and quota signals are observable.
10. Metered API fallback can be disabled.

---

# 40. First Implementation Milestone

Build one vertical slice:

```text
Bot
 ↓
Capability Router
 ↓
chat.message
 ↓
ChatGPT Web Adapter
 ↓
regular ChatGPT subscription chat
 ↓
normalized response
```

Required endpoints:

```text
POST /v1/chat/threads
POST /v1/chat/threads/{id}/messages
GET  /v1/chat/threads/{id}
```

Then add the first artifact-producing vertical slice:

```text
Bot
 ↓
image.generate
 ↓
ChatGPT subscription adapter
 ↓
generated image
 ↓
Allternit Artifact
```

Then Kimi artifact production:

```text
presentation.create
website.create
document.create
spreadsheet.create
```

This sequence validates both text/thread execution and rich artifact execution.

---

# 41. Agent Build Order

An implementation agent should proceed in this order:

1. Create core schemas: Capability, Entitlement, Task, Artifact, Provider, RouteDecision.
2. Create the SubscriptionAdapter interface.
3. Create local gateway service.
4. Create SQLite state store.
5. Create capability registry.
6. Create routing policy engine.
7. Create provider-worker queue abstraction.
8. Implement ChatGPT web adapter for chat only.
9. Implement thread mapping.
10. Add observability/event log.
11. Add artifact abstraction.
12. Implement one ChatGPT artifact path.
13. Implement Kimi adapter with artifact-heavy capabilities.
14. Implement Claude adapter.
15. Add quota estimation and entitlement state.
16. Add fallback routing.
17. Add Allternit UI surfaces.
18. Add tests against mocked provider interfaces and UI fixture pages.

---

# 42. Engineering Rule

The core system must never depend on provider DOM selectors.

Only adapters may know things such as:

```text
textarea selector
send button selector
artifact download button
conversation URL pattern
streaming response DOM
```

Provider-specific selectors belong under:

```text
adapters/{provider}/selectors
```

This separation is mandatory.

---

# 43. Long-Term Vision

The concept can expand beyond AI chat subscriptions.

Potential future entitlement sources:

- Adobe
- Canva
- Figma
- Google Workspace
- Microsoft 365
- Notion
- GitHub
- Linear
- Runway
- Higgsfield
- ElevenLabs
- other paid SaaS products

The generic model remains:

```text
Subscription
      ↓
Entitlements
      ↓
Capabilities
      ↓
Adapters
      ↓
Allternit Capability Router
```

Allternit becomes an operating layer over the software and AI capabilities the user already pays for.

---

# 44. Final Architecture Lock

Use this terminology going forward:

**System:** Subscription Capability Fabric  
**Core router:** Capability Router  
**Provider implementation:** Subscription Adapter  
**Paid feature:** Entitlement  
**Executable function:** Capability  
**Generated output:** Artifact  
**Long-running execution:** Task  
**Provider runtime:** Provider Worker  
**Local service:** Subscription Gateway

The central invariant:

> Bots request capabilities. The fabric chooses entitlements. Adapters execute them. Artifacts come back normalized.


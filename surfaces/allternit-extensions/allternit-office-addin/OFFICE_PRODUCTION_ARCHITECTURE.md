# Office Production Architecture

Date: 2026-05-14
Status: Required for production

## Non-Negotiable Constraint

The real Microsoft Word, Excel, and PowerPoint runtimes are hosted by Microsoft Office, not by the Allternit platform shell.

This means:

- The Office add-in taskpane is the production connector surface.
- The Allternit platform can be a companion and control surface.
- The platform must not pretend to be the host Office runtime.

## Production Surface Model

### 1. Office Add-in Surface

Runs inside:

- Word desktop / web
- Excel desktop / web
- PowerPoint desktop / web

Responsibilities:

- Read live document/workbook/presentation context through Office.js
- Execute real host operations through Office.js
- Authenticate user/org against Allternit backend
- Bind Office document identity to Allternit workspace/project/session state
- Stream agent responses and actions from backend

### 2. Allternit Platform Companion Surface

Runs inside:

- `surfaces/ai.allternit.com`

Responsibilities:

- Project setup and orchestration
- Artifact review and editing
- Session history
- Connector health and status
- Suggested actions and generated outputs
- Launch into Office desktop/web and show current add-in state

Not responsible for:

- Hosting the authoritative Office document runtime
- Emulating Word/Excel/PowerPoint as if they were the same surface

### 3. Native Office Workspace Surface

Runs inside:

- `OfficeWorkspace.tsx`

Responsibilities:

- Platform-native editing and document exploration
- Design/content workflows that benefit from an Allternit-native canvas/editor

This surface is real, but it is not the Microsoft add-in runtime.

## Production Runtime Topology

```text
Microsoft Office Host
  -> loads Allternit taskpane from production HTTPS URL
  -> Office.js bridge reads/writes host document state

Allternit Taskpane
  -> authenticates user
  -> opens/joins Allternit workspace binding
  -> calls backend APIs for AI/session/artifacts

Allternit Backend
  -> owns users, orgs, projects, workspace bindings, sessions, artifacts
  -> broadcasts taskpane/platform state changes

Allternit Platform Web App
  -> reads same backend state
  -> shows companion view of Office session and outputs
```

## Required Backend Contracts

### Document Binding

Need a canonical binding record:

- `bindingId`
- `userId`
- `organizationId`
- `officeHost`: `word | excel | powerpoint`
- `documentExternalId`
- `documentTitle`
- `workspaceId`
- `projectId`
- `activeSessionId`
- `createdAt`
- `updatedAt`

`documentExternalId` should come from a stable Office-side identity when available.

### Session State

Need backend session records shared by:

- taskpane runtime
- platform companion

Must include:

- session id
- current task
- tool/activity timeline
- host context snapshot
- generated artifacts
- pending approvals/questions

### Artifact State

Artifacts generated from Office work must be persisted server-side and linked to:

- workspace
- project
- Office binding
- originating session

## Authentication Requirements

Production add-in cannot rely on local dev assumptions.

Must support:

- real Allternit auth against production backend
- org/user identity shared with platform shell
- token refresh in taskpane runtime

Recommended direction:

- taskpane authenticates directly to Allternit backend
- backend returns workspace/session/binding context
- platform companion reads same records under same user/org identity

## Deployment Requirements

### Manifest

Need environment-aware production manifest generation:

- production HTTPS app domain
- production icons
- production support URL
- correct `AppDomains`
- no `localhost`

### Microsoft 365 Distribution

Need:

- Integrated Apps / Microsoft 365 admin center deployment for internal org installs
- optional marketplace path later

## What The Current Repo Already Has

- A real Office add-in manifest shape
- Office.js host detection
- Minimal Office bridges for context and text insertion
- Taskpane UI shell
- Platform companion iframe view

## What Is Still Missing

### 1. Production manifest/config pipeline

Current manifest is hard-coded to localhost.

### 2. Real auth/session bootstrap

The taskpane is not yet production-bound to Allternit identity/session state.

### 3. Real document binding model

No canonical Office document <-> Allternit workspace/project/session binding exists yet.

### 4. Real backend sync

Current platform bridge uses `BroadcastChannel` / `postMessage` for local mirroring.
That is not the production sync architecture.

### 5. Host-specific operations

Current bridges only prove the pattern. They do not cover the actual production command surface.

### 6. Platform semantics

Platform Office views still need to be explicitly framed as companion surfaces, not substitute Office hosts.

## Implementation Order

1. Add production manifest templating and env-driven URLs.
2. Define backend document-binding schema and API.
3. Implement taskpane auth/session bootstrap against production backend.
4. Replace local-only bridge assumptions with backend-backed sync.
5. Expand Word/Excel/PowerPoint bridges into real host actions.
6. Update platform Office views to consume binding/session state from backend.
7. Add deep-link/open-in-host flows for desktop and Office web.

## Explicit Product Rule

If the user wants the real Office document, they must be in Microsoft Office or Office for the web.

If the user is in the Allternit platform, they are in:

- a companion surface, or
- a platform-native workspace surface.

Those are both valid, but they are not the same runtime.

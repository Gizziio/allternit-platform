# Allternit Office developer-product deployment

Allternit for Word, Allternit for Excel, and Allternit for PowerPoint are three separate developer-mode products. They share the Allternit platform harness, but they do not share an identity, manifest, installation state, or task-pane experience.

## Runtime topology

The task-pane application is a static web application hosted at an HTTPS path such as:

```text
https://ai.allternit.com/office-addins/
```

Developer manifests point to host-specific URLs:

```text
/office-addins/src/taskpane/index.html?product=word
/office-addins/src/taskpane/index.html?product=excel
/office-addins/src/taskpane/index.html?product=powerpoint
```

The product query identifies the companion preview. A live Office.js host remains mandatory before the task pane reports document access.

## Prepare deployment assets

```bash
export ALLTERNIT_OFFICE_APP_BASE_URL=https://ai.allternit.com/office-addins
export ALLTERNIT_PLATFORM_URL=https://ai.allternit.com
export VITE_ALLTERNIT_GATEWAY_URL=https://api.allternit.com
export VITE_ALLTERNIT_PLATFORM_URL=https://ai.allternit.com
export VITE_ALLTERNIT_OFFICE_BASE_PATH=/office-addins/
./deploy.sh
```

Publish `deployment/office-addins/` at `ALLTERNIT_OFFICE_APP_BASE_URL`. Do not publish a development build whose manifests point at localhost.

## Stable product manifests

The manifest generator writes:

- `manifests/word.xml`
- `manifests/excel.xml`
- `manifests/powerpoint.xml`

Their IDs are stable defaults. A deployment may override each ID with `ALLTERNIT_OFFICE_WORD_GUID`, `ALLTERNIT_OFFICE_EXCEL_GUID`, and `ALLTERNIT_OFFICE_POWERPOINT_GUID`, but IDs must never rotate during an update.

## Installation

Normal users install through the Allternit Office Setup Center. It manages only Allternit-owned developer registrations.

- macOS: host-specific Office `wef` directories
- Windows: per-user `HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Wef\\Developer` values
- Office web: guided manifest upload with the required Microsoft developer-mode confirmation

Manual manifest upload is a recovery path, not the primary UX.

## Platform connection

The task pane contains no API-key, model-provider, or independent system-prompt settings. It authenticates to the Allternit platform gateway and creates a live document binding. CORS must allow the Office runtime and platform origins.

## Release checks

- Build the task-pane runtime with the production base path.
- Validate all three XML manifests.
- Confirm each manifest declares only its matching host.
- Install, repair, update, and remove each product independently.
- Verify the hosted task pane from Windows Office, macOS Office, and Office web.
- Verify that clearing Office-web browser storage changes health to repair-needed instead of leaving a false installed state.

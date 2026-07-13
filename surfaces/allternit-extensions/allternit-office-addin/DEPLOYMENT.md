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

## Repeatable hosted smoke test

```bash
pnpm test:hosted -- https://your-host.example/office-addins
```

This rejects SPA fallbacks, validates content types, follows built assets, checks stable unique IDs, and confirms that every manifest declares exactly one matching Office host.

## Live Office binding test

### Office on the web (the fastest real-host acceptance test)

1. Deploy the runtime and gateway to public HTTPS origins, then run `test:hosted`.
2. Open a document at `word.office.com`, `excel.office.com`, or `powerpoint.office.com` with a Microsoft account.
3. Open **Home → Add-ins → More Add-ins → My Add-ins → Upload My Add-in**. If Microsoft shows a developer-mode warning, explicitly enable developer mode and continue.
4. Upload only the manifest matching the current host (`word.xml`, `excel.xml`, or `powerpoint.xml`).
5. Open **Allternit for Word/Excel/PowerPoint** from the ribbon. The pane must identify the correct host and active document.
6. Select **Connect Allternit** if prompted. Sign in in the Office dialog; the dialog must close and the pane must change to **Connected** without a reload.
7. Start one suggested action. Verify it reaches the Allternit Computer Agent and remains attached to the same document binding.
8. In another terminal, prove that this is a live integration rather than a rendered iframe:

```bash
ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013 pnpm test:binding -- word
ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013 pnpm test:binding -- excel
ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013 pnpm test:binding -- powerpoint
```

For an authenticated remote gateway, also set `ALLTERNIT_AUTH_TOKEN`. A pass requires a connected binding with at least one active Office session; merely rendering the task-pane webpage does not pass.

### Desktop Office matrix

Repeat the same host/binding/action checks in Word, Excel, and PowerPoint on Windows and macOS. Install through the Allternit Office Setup Center first; manual sideloading is the recovery path. Test both a new local file and a cloud-backed file because Office exposes different document URLs in those cases. Also verify sign-out/reconnect, app restart, add-in remove/repair, and a gateway outage followed by recovery.

The test machine must actually have the relevant Office host installed and activated. Schema validation can prove compatibility, but it cannot substitute for Office.js executing inside Microsoft's host.

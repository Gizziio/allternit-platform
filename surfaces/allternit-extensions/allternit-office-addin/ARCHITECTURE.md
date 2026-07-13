# Allternit Office developer-product architecture

## Product boundary

Allternit for Word, Allternit for Excel, and Allternit for PowerPoint are separate products. Each owns a stable manifest ID, Office host declaration, ribbon identity, installation health, specialized task-pane language, and host tool adapter.

They share implementation infrastructure only:

- Allternit account and platform bootstrap
- gateway transport and document-binding lifecycle
- approval, receipt, memory, skill, and workflow contracts
- common visual primitives

They do not expose API keys, model selection, independent memory, or a task-pane system prompt.

## Runtime flow

```text
Word / Excel / PowerPoint
  -> host-specific developer manifest
  -> hosted HTTPS task pane
  -> Office.js host adapter
  -> Allternit gateway document binding
  -> Allternit Computer Agent
```

If Office.js is absent, the task pane is a companion preview and must never report a live document connection. Browser/computer use is the compatibility fallback, not a fake Office.js binding.

## Manifests

`scripts/build-manifest.mjs` generates:

- `manifests/word.xml` (`Document`)
- `manifests/excel.xml` (`Workbook`)
- `manifests/powerpoint.xml` (`Presentation`)

`manifest.xml` is retained only as a Word compatibility alias for legacy local scripts. New code must use a product manifest.

## Installation ownership

Allternit Desktop owns developer registration lifecycle through `office-addin-manager.ts`:

- detect
- install
- update
- repair
- remove

macOS writes only `allternit-*.xml` files inside the appropriate Office `wef` directory. Windows writes only the stable Allternit manifest ID values under the current user's Office developer key.

Office web installation is guided because Microsoft requires the user to accept developer mode and upload a manifest. Health is browser-profile-specific and cannot be inferred from desktop registration.

## Native editor relationship

Allternit Documents, Sheets, and Presentations are lazy web editor packs. They are not Office add-ins. They expose the structured `document-surface.ts` contract so Computer Agent can inspect and—with explicit approval—modify the active local surface.

Successful repeated intents become document-workflow drafts. Users explicitly promote them into Learned Abilities; promotion never happens silently.

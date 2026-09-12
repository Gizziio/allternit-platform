# Plan — session/designfixes-0912 (deferred design UI work)

Sibling session artphase2-0912 owns: `gallery-store.ts`, `project-file-store.ts`,
`content-artifact-sync.ts` (IndexedDB read-through), chat persist step, cowork
a:// links, gizzi-code artifact commands, typed renderers. DO NOT EDIT those files.

## 1. Critique-panel image wiring

- New pure lib `surfaces/ai.allternit.com/src/lib/design/turn-images.ts`:
  `extractTurnImages(messages)` scans assistant messages (latest-first) for
  image sources: `<artifact type="image/*">` blocks (via splitOnArtifacts),
  markdown `![](http/data-url)`, and `metadata.agentElementsParts` tool parts
  whose name/result references an image URL/data URL. Skip blob:/object URLs,
  dedupe, cap at 6. + vitest.
- `DesignModeView.tsx`: memo `latestTurnImages` over backendMessages, pass to
  `<DesignCritiquePanel artifactImages={...}>`.
- `DesignCritiquePanel.tsx`: optional `artifactImages?: string[]` prop — render
  an "Attached images" strip (thumbnails) and send `images` in the POST body.
- gizzi `routes/critique.ts`: extend `CritiqueRequest` with
  `images: z.array(z.string()).max(6).optional()`; append capped image refs to
  the panelist prompt as markdown image references. Text-turn design kept (CLI
  brains); vision-part integration noted as follow-up.

## 2. Gallery thumbnails (VIEW layer only)

- Save-time capture already exists (`renderArtifactThumbnail` in
  `DesignModeView` + `entry.thumbnail` in store). Remaining gap: gateway/legacy
  entries with no thumbnail show a letter placeholder; cards have inconsistent
  heights.
- `NewProjectScreen.tsx`: lazy client-side thumbnail generation for entries
  missing `thumbnail` but having `artifactHtml` (module-level cache keyed
  projectId:updatedAt, best-effort, placeholder fallback kept).
- `new-project-screen.css`: `.ad-gallery-card img` gets
  `aspect-ratio: 4/3; object-fit: cover` for a consistent grid.

## 3. `/design` ack channel

- gizzi `routes/design.ts` (new): `POST /v1/design/ack` writes receipt
  `{prompt, consumedAt, sessionId}` to
  `process.env.ALLTERNIT_DESIGN_ACK_PATH ?? ~/.allternit/design-prompt-ack.json`
  (atomic write, mkdir -p); `GET /v1/design/ack` returns it. Mount in server.ts
  at both mount sites (pattern: orchestrator.ts state path).
- Web `src/lib/design/design-prompt-ack.ts`:
  `reportDesignPromptConsumed(prompt, sessionId)` — POST to
  `${gizziBaseUrl()}/v1/design/ack`, best-effort fire-and-forget.
- `DesignModeView.tsx`: on mount, when `initialPrompt` non-empty, report
  consumption once (idempotent ref).
- gizzi-code `commands/design/design.tsx`: after successful open, poll the
  receipt file (~8s, 500ms interval) for a receipt matching the prompt with
  consumedAt >= command start; print "A:// Studio picked up your prompt" vs a
  not-yet-confirmed note.

## Verification

- `pnpm typecheck` (surfaces/ai.allternit.com): 0 errors.
- `pnpm vitest run src/lib/design src/views/design src/components/design src/components/artifact`: green (incl. new turn-images tests).
- `bun run typecheck` + `bun run script/build-production.js` (cmd/gizzi-code).
- Live smoke: start gizzi server, POST + GET /v1/design/ack, critique request shape with images.
- `node scripts/release-preflight.mjs`: 35/0.
- Desktop rebuild per spec (sidecars from shared checkout, background npm run dist, marker grep, preserve new 8-file release set, retire only previous latest).

## Land

conventional commits → push → gh pr create → gh pr merge --merge → ledger
branch/attestation → cleanup worktree+branches.

# Session attestation — session/designfixes-0912

- **Date:** 2026-09-12 (~11:00–11:35 local)
- **Agent:** kimi (Kimi Code CLI subagent)
- **PR:** #416, merge commit `14ee10149`
- **Worktree:** `allternit-session-designfixes-0912` (removed at cleanup)
- **Context:** three deferred items from the design program (surgicaleye-0911
  attestation named them as gaps; ran in parallel with sibling
  `artphase2-0912`, which owns `gallery-store.ts` / `project-file-store.ts` /
  `content-artifact-sync.ts`, chat persist, cowork a:// links, gizzi-code
  artifact commands, typed renderers — this session touched none of those).

## What was done

### 1. Critique-panel image wiring

The critique panel previously received only the latest HTML artifact
(`latestArtifactHtml`); images the design turn produced were invisible to the
review and never reached the critique brain.

- **`surfaces/ai.allternit.com/src/lib/design/turn-images.ts`** (new, pure):
  `extractTurnImages(messages)` scans assistant messages latest-first for
  image sources — `<artifact type="image/*">` blocks (bare base64 wrapped into
  a data URL with the artifact MIME type, via the existing
  `splitOnArtifacts`), markdown `![...](...)` embeds, and
  `metadata.agentElementsParts` tool parts whose tool name matches
  image/screenshot/thumbnail/logo/poster (data URLs preferred over http URLs
  inside a part; one image per tool part). Skips `blob:`/`object:`/`file:`
  URLs (session-local, useless to a reviewer), dedupes, caps at 6 images and
  ~3MB per image, never throws on malformed messages.
- **`DesignModeView.tsx`** — `latestTurnImages` memo; forwarded to the panel.
- **`DesignCritiquePanel.tsx`** — new optional `artifactImages?: string[]`
  prop: an "Attached from the latest turn" strip (96×72 thumbnails) and
  `images` included in the POST body (only when non-empty).
- **gizzi `cmd/gizzi-code/src/runtime/server/routes/critique.ts`** —
  `CritiqueRequest` gains `images: z.array(z.string().min(1)).max(6).optional()`;
  `buildPrompt` appends the images as markdown refs
  (`![attached-image-N](url)`, each hard-capped at 100k chars) after the HTML
  block with an instruction to review them as part of the visual output. The
  single-text-turn design is preserved on purpose — gizzi's CLI/subprocess
  brain adapters forward only the last user message's text, so image refs ride
  in text for every brain. Threaded through both `/` and `/stream` handlers.

### 2. Gallery thumbnails (view layer only)

Finding: save-time capture already existed (`renderArtifactThumbnail` in
`artifact-thumbnail.ts`, stored on `entry.thumbnail` by the DesignModeView
capture effect, merged earlier in `5aecc8360`). The remaining gap was the
view: gateway-restored or pre-thumbnail entries fell back to a letter
placeholder, and card images had no size discipline.

- **`NewProjectScreen.tsx`** — `GalleryCardImage` component: uses
  `entry.thumbnail` when present; otherwise lazily renders a thumbnail from
  the stored `artifactHtml` via `renderArtifactThumbnail`, caches the result
  module-level keyed `projectId:updatedAt` (including negative caching),
  keeps the placeholder fallback. Best-effort — generation never blocks the
  grid and any rasterization failure lands on the placeholder.
- **`new-project-screen.css`** — `.ad-gallery-card img` gets
  `aspect-ratio: 4 / 3; object-fit: cover` so the masonry grid is consistent.
- Did NOT touch `gallery-store.ts` / `project-file-store.ts` /
  `content-artifact-sync.ts` (sibling-owned) — their API was consumed as-is.

### 3. `/design` ack channel

gizzi-code's `/design [prompt]` printed an `allternit://design?prompt=…` deep
link but had no way to know the studio actually consumed the prompt.

- **`cmd/gizzi-code/src/shared/utils/designPromptAck.ts`** (new):
  `designAckPath()` = `process.env.ALLTERNIT_DESIGN_ACK_PATH ??
  ~/.allternit/design-prompt-ack.json` (same pattern as
  `routes/orchestrator.ts`'s state path); `readDesignAck` / `writeDesignAck`
  (mkdir -p, tmp + rename, mode 0600).
- **`cmd/gizzi-code/src/runtime/server/routes/design.ts`** (new): mounted at
  `/v1/design` in `server.ts` (both mount sites). `POST /ack` validates
  `{prompt, consumedAt, sessionId?}` (zod) and writes the receipt; `GET /ack`
  returns it (404 when none). Local file only — no new external network
  surface; the endpoint is loopback-local like the rest of the gizzi daemon.
- **Web `src/lib/design/design-prompt-ack.ts`** (new):
  `reportDesignPromptConsumed(prompt, sessionId?)` POSTs to
  `${gizziBaseUrl()}/v1/design/ack` — same broker-aware base URL the critique
  panel already uses (works in the desktop shell's `allternit-gizzi://`
  broker and plain web). Fire-and-forget; failures never touch the studio.
- **`DesignModeView.tsx`** — on mount, when `initialPrompt` is non-empty,
  reports consumption once (idempotent ref), including `activeSessionId` when
  known.
- **gizzi-code `commands/design/design.tsx`** — after the deep link fires
  with a prompt, polls `readDesignAck()` every 500ms up to 8s for a receipt
  whose prompt matches and whose `consumedAt` is within 2s of the command
  start (stale-receipt guard). Success message: "A:// Studio picked up your
  prompt." Timeout message says the prompt is still seeded on window load but
  pickup is unconfirmed. No-prompt `/design` skips polling.

## Verification evidence

- `pnpm typecheck` (surfaces/ai.allternit.com): **0 errors** (pre-merge and
  after merging concurrent origin/main — PR #414 fabric-cowork-switch).
- `pnpm vitest run src/lib/design src/views/design src/components/design
  src/components/artifact`: **111/111, 14 files** post-merge (11 new
  turn-images tests included).
- `bun run typecheck` (cmd/gizzi-code): **0 errors**.
- `bun run script/build-production.js` (Bun.build production bundle): **exit
  0**; bundle greps: `design-prompt-ack.json` ×4, `picked up your prompt` ×3,
  `attached-image-` ×3.
- Live in-process smokes (hono `app.request`, deleted after):
  design ack `GET` 404 → `POST` 200 (receipt persisted) → `GET` 200;
  invalid body → 400. Critique with 2 images validates and reaches the
  handler (503 "No brain configured" — expected on this machine); 7 images →
  400 zod rejection.
- `node scripts/release-preflight.mjs`: **35 passed, 0 failed**.
- PR #416 merged with `--merge` (merge commit `14ee10149`); Vercel checks fail
  account-wide (rate limit) as documented.

## Incidents

- `.steering/checkpoint.md` conflict on merge of concurrent main — resolved
  keeping both checkpoints (theirs first), per convention.

## Honest deferrals

- **Vision-part panelists** — images reach the critique brain as capped
  markdown references in the single text turn (the only form CLI/subprocess
  brains can carry). True multimodal content parts for API vision brains are
  a follow-up.
- **Gallery thumbnail persistence** — view-side generated thumbnails live in
  a module-level cache by design; persisting them would mean writing to the
  sibling-owned stores. Fresh captures happen on every landing-screen mount
  for thumbnail-less entries.
- **Ack when the composer actually sends** — the receipt fires when the
  studio applies `initialPrompt` into the composer (the spec'd consumption
  point); a send-time ack is not distinguished.
- **Desktop rebuild** — performed after this attestation per AGENTS.md step 8
  (release path touched: gizzi-code bundled + ai surface in the desktop
  bundle); evidence in the session handoff.

# Session attestation — session/surgicaleye-0911 (Session H)

- **Date:** 2026-09-12 (started 2026-09-11 ~20:30, interrupted by quota error, resumed + landed 2026-09-12)
- **Agent:** kimi (Kimi Code CLI subagent)
- **PR:** #399, merge commit `c4f10f439`
- **Worktree:** `allternit-session-surgicaleye-0911` (removed at cleanup)

## What was done

Two locked items from the mapping doc.

### 1. Click-to-target surgical edit (mapping doc §3 port #5)

The shortcut version of Onlook's DOM↔code binding: click an element in the
artifact preview → the surgical edit panel targets it. **Explicit non-goal,
stated in the PR:** Onlook's full AST-instrumented two-way DOM↔code binding —
this session is click → identify → prompt targeting only; no code→DOM writeback.

Verified facts that shaped the design (read before writing code):

- `ArtifactRenderer.tsx` renders artifacts in a sandboxed iframe
  (`sandbox="allow-scripts allow-forms allow-modals"`, **no**
  `allow-same-origin`, `srcDoc={injectSandboxStorageShim(htmlContent)}`) — an
  opaque origin. The parent cannot read the iframe DOM; all element
  communication must be postMessage from an injected in-iframe script.
- `DesignModeView` computes `latestArtifactHtml` (last `text/html` artifact in
  assistant messages) and hosts `SurgicalEditPanel`, but did **not** render an
  artifact iframe anywhere (the in-project chat panel renders message text
  raw) — so this session adds a compact `ArtifactRenderer` preview above the
  surgical panel, only when `latestArtifactHtml` is non-empty.

Implementation:

- **`surfaces/ai.allternit.com/src/lib/design/aio-targeting.ts`** (pure):
  - `injectAioIds(html)` — deterministic `data-aio-id="aio-N"` in document
    order; idempotent (re-running never renumbers); preserves pre-existing
    ids (continues numbering after the highest); skips comments, doctype,
    raw-text contents (`script`/`style`/`textarea`/`title`, with self-closing
    `<script src=... />` handled), and void/head elements (`meta`, `link`,
    `img`, `input`, `html`/`head`/`body`…). Tokenizer regex honors quoted `>`
    in attributes.
  - `injectAioTargetCapture(html)` — capture-phase click listener injected
    before `</body>`; finds the nearest `[data-aio-id]` ancestor,
    `preventDefault` + `stopPropagation`, and
    `parent.postMessage({source:'aio-target', aioId, tag, text}, '*')`.
    Idempotent via marker attribute.
  - `parseAioTargetMessage(data)` — strict shape validation only (source tag,
    `aio-\d+` id, lowercase tag, string text ≤120 chars).
  - `buildAioTargetDescription(payload)` → `<button> "Buy now" (aio-12)`.
- **`ArtifactRenderer.tsx`** — new optional `aioTargeting` / `onAioTarget`
  props. Ids + capture script are injected **on the fly in the srcdoc
  pipeline** (alongside the storage shim) so stored artifacts stay clean. The
  parent `message` listener requires `event.origin === 'null'` (opaque) **and**
  `event.source === iframe.contentWindow` **and** a validated payload.
- **`SurgicalEditPanel.tsx`** — new optional `targetSeed` prop; a new seed
  (nonce change) pre-fills and focuses the target input.
- **`DesignModeView.tsx`** — artifact preview block above the surgical panel
  (only when `latestArtifactHtml` exists) with a Crosshair target-mode toggle;
  a picked element seeds the panel target and auto-exits target mode. The
  description flows into `buildSurgicalEditPrompt` as the comment target.
- **Tests** — `src/lib/design/aio-targeting.test.ts`, 18 tests:
  determinism, idempotence, existing-id preservation, script/comment/style
  skipping, void-element skipping, quoted-`>` attribute handling, fragment
  HTML, capture-script injection + idempotence, payload accept/reject
  (wrong source, malformed id/tag/text, non-objects), description format,
  and prompt-includes-description via `buildSurgicalEditPrompt`.

**Not unit-testable (said so in the PR):** the sandboxed-iframe click path
itself — jsdom has no real opaque-origin iframe postMessage. Verified by
typecheck + careful read-through of the wiring (origin check, source check,
payload validation, capture-phase interception).

### 2. `/design [prompt]` command in gizzi-code (mapping doc §2 row 12)

Claude Code's `/design` equivalent, riding the transport that already exists.

Explored first: commands register in
`cmd/gizzi-code/src/cli/ui/ink-app/commands.ts` (local-jsx commands =
descriptor `index.ts` with `load: () => import('./x.js')` + component
exporting `call(onDone, context, args)`); a deep-link helper already exists at
`src/shared/utils/desktopDeepLink.ts` (`allternit://resume?…`, platform
opener for macOS/Linux/Windows, dev builds use `allternit-dev://`); the
desktop main only handled `allternit://hud` and `allternit://pairing/complete`
— **no design route existed**, so the desktop main gained one (without it the
deep link would have been dead-on-arrival, which the session refused to ship).

Implementation:

- **`desktopDeepLink.ts`** — `buildDesignDeepLink(prompt?)`
  (`allternit://design?prompt=…`, `allternit-dev://` in dev) +
  `openDesignStudioInDesktop(prompt?)` (install check + existing opener;
  returns the deep link in all outcomes).
- **`surfaces/allternit-desktop/src/main/unified-main.ts`** —
  `handleProtocolCallback` routes `allternit://design?prompt=…` (and the dev
  scheme); the `shell:open-design` IPC handler was refactored into a shared
  `openDesignStudio(prompt?)` that loads the design window at `/design` with
  the prompt as a URL query param.
- **`DesignPage.tsx` / `DesignModeView.tsx`** — `/design?prompt=` seeds the
  studio composer via a new `initialPrompt` prop (also works for plain web
  opens, not just desktop).
- **gizzi-code `commands/design/`** — `/design [prompt]` (alias `/studio`)
  local-jsx command: opens the deep link through the existing opener and
  prints the exact deep link in success, failure, and not-installed outcomes
  (not-installed also prints the desktop download URL).

## Verification evidence

- `pnpm typecheck` (surfaces/ai.allternit.com): **0 errors** (pre-merge and
  post-merge of concurrent main).
- `pnpm vitest run src/lib/design src/shell src/views/design`: **92/92, 14
  files** on session branch; **109/109, 16 files** after merging concurrent
  main (another session added `ArtifactRenderer.test.tsx` +
  `project-file-store.test.ts`; clean auto-merge of my `ArtifactRenderer`
  changes against their SVG/markdown sandboxing).
  Session-start baseline stated in the task was 66/66 @12 files — the delta
  at start was already explained by other sessions' merged tests.
- `pnpm vitest run src/lib/design src/components/artifact src/views/design`:
  71/71 post-merge (as re-specified after the interruption).
- `bun run typecheck` (cmd/gizzi-code): **0 errors**.
- `bun run script/build-production.js` (cmd/gizzi-code, Bun.build production
  bundle — the AGENTS.md commandment for release-path changes): **exit 0**;
  bundle grep confirms `Open A:// Studio (Design mode)` and the
  `` URL(`${protocol}://design`) `` deep-link builder are in the bundle.
  (First build attempt caught a real bug: my relative import resolved to
  `src/cli/shared/...` which the bundle plugin empty-stubs — fixed to
  `src/shared/...`; also learned `build-production.js` temporarily moves
  `bunfig.toml`, which raced an ill-timed `git add -A` — content verified
  identical to HEAD afterward.)
- `node scripts/release-preflight.mjs`: **35 passed, 0 failed** (pre-merge and
  post-merge).
- PR #399 merged with `--merge` (merge commit, not squash), Vercel checks
  failing account-wide as documented.

## Incidents

- Quota interruption mid-session (2026-09-11 → 12); state was fully staged and
  the plan/checkpoint made resumption clean.
- Merge conflict in `.steering/checkpoint.md` with concurrent sessions —
  resolved keeping both sides (mine first).
- The `bunfig.toml` staging race described above — no content change ever
  committed for it.

## Honest deferrals

- **Onlook AST two-way DOM↔code binding** — explicitly out of scope per the
  session spec; only click→identify→prompt targeting was built.
- **In-project chat artifact rendering** — `DesignChatPanel` still renders
  assistant messages as raw text; the click-to-target preview is a separate
  compact pane above the surgical panel. Wiring `StudioMessageRenderer` into
  the design chat is a larger UX change left for a future session.
- **`/design` UX polish** — the command prints the deep link and opens the
  desktop app; it does not wait for/verify the studio window actually
  consumed the prompt (no ack channel exists).
- **`allternit://resume`-style session handoff for design** — not attempted;
  `/design` starts a fresh studio prompt, it does not bridge the current CLI
  session into a design agent session (that would be the DesignModeAgentSession
  bridge work, separately tracked).
- **Desktop rebuild** — performed after this attestation per AGENTS.md step 8
  (release path touched: gizzi-code bundled + ai surface in the desktop
  bundle); DMG evidence recorded in the ledger follow-up if not in this file.

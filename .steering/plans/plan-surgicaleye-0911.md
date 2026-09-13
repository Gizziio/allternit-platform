# Plan — session/surgicaleye-0911 (Session H)

Worktree: allternit-session-surgicaleye-0911 @ origin/main dc372e2f3.

## Part 1 — Click-to-target surgical edit (mapping doc §3 port #5, shortcut of Onlook DOM↔code binding)

Goal: click an element in the artifact preview → surgical edit panel targets it.
Non-goal (say in PR): Onlook's full AST-instrumented two-way DOM↔code binding. Click→identify→prompt only.

Verified facts:
- `ArtifactRenderer.tsx` renders sandboxed iframes (`sandbox="allow-scripts allow-forms allow-modals"`,
  NO allow-same-origin → opaque origin; parent cannot read DOM). All element comms must be postMessage
  from an injected in-iframe script. srcDoc pipeline today: `injectSandboxStorageShim(htmlContent)`.
- `SurgicalEditPanel.tsx` — target/body form, local `target` state.
- `surgical-edit.ts` — `buildSurgicalEditPrompt(html, comments)`.
- `DesignModeView.tsx` computes `latestArtifactHtml` (last text/html artifact in assistant msgs),
  hosts `SurgicalEditPanel`. NOTE: DesignModeView does NOT currently render an artifact iframe
  (DesignChatPanel renders message text raw) — so Part 1 adds a compact ArtifactRenderer preview
  above the surgical panel, only when latestArtifactHtml is non-empty.

Steps:
- [ ] `src/lib/design/aio-targeting.ts` (pure): `injectAioIds(html)` (deterministic document-order
      `data-aio-id="aio-N"`, idempotent, preserves existing ids, skips script/style/comments/void),
      `injectAioTargetCapture(html)` (click-capture script), `parseAioTargetMessage(data)` (strict
      payload validation), `buildAioTargetDescription(payload)` (`<tag> "text" (aio-N)`),
      `buildAioTargetedPromptHint` — applied on the fly in ArtifactRenderer srcDoc only.
- [ ] `ArtifactRenderer.tsx`: optional props `aioTargeting?: boolean`, `onAioTarget?: (payload) => void`;
      window message listener gated on targeting, accepts only `event.origin === 'null'` +
      `event.source === iframe.contentWindow`, strict payload validation.
- [ ] `SurgicalEditPanel.tsx`: optional `targetSeed?: { target: string; nonce: number } | null` prop;
      useEffect seeds + focuses the target input.
- [ ] `DesignModeView.tsx`: artifact preview (ArtifactRenderer w/ targeting) above SurgicalEditPanel
      when latestArtifactHtml non-empty; "Target" toggle (Crosshair icon); onAioTarget →
      buildAioTargetDescription → setTargetSeed → auto-disable targeting.
- [ ] Tests `src/lib/design/aio-targeting.test.ts`: determinism, idempotence, preserves existing ids,
      skips script/style, payload accept/reject, description format, prompt-includes-description.
      iframe click path not unit-testable in jsdom — verified by typecheck + read-through.
- [ ] Verify: `pnpm typecheck` 0 errors; `pnpm vitest run src/lib/design src/shell src/views/design` green.

## Part 2 — `/design` command in gizzi-code (mapping doc §2 row 12)

Verified facts:
- Commands registered in `src/cli/ui/ink-app/commands.ts` (COMMANDS list); local-jsx commands:
  descriptor `index.ts` (`load: () => import('./x.js')`) + component `x.tsx` exporting `call(onDone, context, args)`.
- Existing deep-link helper `src/shared/utils/desktopDeepLink.ts`: `allternit://resume?...` builder +
  `openDeepLink` (open/osascript/xdg-open/cmd start) + install check. Dev builds use `allternit-dev://`.
- Desktop main (`surfaces/allternit-desktop/src/main/unified-main.ts`) handles `allternit://hud` and
  `allternit://pairing/complete` only — NO design route yet. `shell:open-design` IPC opens the design
  BrowserWindow at `/design`.
- `/design` web route (`DesignPage.tsx`) renders DesignModeView standalone.

Steps:
- [ ] `desktopDeepLink.ts`: export `buildDesignDeepLink(prompt?)` (`allternit://design?prompt=...`,
      dev variant) + `openDesignStudioInDesktop(prompt?)`.
- [ ] Desktop main: handle `allternit://design?...` (+ dev scheme) in `handleProtocolCallback` →
      open/focus design window loading `/design?prompt=...` (refactor shared with `shell:open-design`).
- [ ] `DesignPage.tsx`: read `?prompt=` once, pass `initialPrompt` → DesignModeView seeds composerSeed.
- [ ] gizzi-code `commands/design/index.ts` + `design.tsx`: `/design [prompt]` opens deep link via
      existing opener; prints exact deep link; not-installed → honest message + download URL.
- [ ] Verify: `bun run typecheck` + `bun run script/build-production.js` in cmd/gizzi-code.

## Ritual
- [ ] Conventional commits, push, PR (--merge), concurrent-merge handling.
- [ ] `node scripts/release-preflight.mjs` 35/0 before merge.
- [ ] Ledger branch `session/ledger-surgicaleye-0911`: summary + LEDGER.md bullet (theirs-first on conflict), PR, merge.
- [ ] Desktop rebuild: copy resources/bin, `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` (background),
      bundle grep for marker (`aio-target` / `data-aio-id`), DMG copy + retire only previously-latest set.
- [ ] Cleanup: worktree remove, delete session+ledger branches local+remote.

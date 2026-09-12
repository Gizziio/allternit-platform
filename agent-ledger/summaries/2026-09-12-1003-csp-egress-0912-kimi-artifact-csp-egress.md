# Session summary — csp-egress-0912 (2026-09-12 ~1003)

**Session:** `session/csp-egress-0912` · **Agent:** kimi-code · **Topic:** artifact iframe CSP / egress hardening (issue #396)
**PR:** #407 · **Merge commit:** `c98d552ac3b4adf6800a45ce3e547fdf40cf5510`

## What was done

Closed the artifact-iframe network egress hole tracked in issue #396: `ArtifactRenderer.tsx` rendered untrusted, model-generated artifacts in an opaque-origin sandboxed iframe (`sandbox="allow-scripts allow-forms allow-modals"`, srcDoc, storage shim) but set no Content-Security-Policy on the srcdoc — `fetch`/XHR could reach arbitrary origins and `<script src>`/`<img>`/`<link>` could load remote resources.

- **New `surfaces/ai.allternit.com/src/components/artifact/sandbox-csp.ts`**: exports `ARTIFACT_CSP` and `injectSandboxCsp(html)`. The injector places `<meta http-equiv="Content-Security-Policy" content="…" data-allternit-artifact-csp>` as the first child of `<head>` (falls back to wrapping fragments in `<head>`; idempotent via marker attribute), mirroring the storage-shim injector's structure.
- **`ArtifactRenderer.tsx`**: srcdoc pipeline is now CSP → storage shim → (aio ids → capture script). `ARTIFACT_CSP`/`injectSandboxCsp` re-exported for reuse.
- **DESIGN.md §11**: CSP moved from the §11.2 advisory gap list ("No CSP … do not assume egress is blocked") to §11.1 "Enforced by code" with per-directive rationale.

## Exact CSP chosen

```
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data: blob:;
media-src blob:;
font-src data:;
connect-src 'none';
form-action 'none';
base-uri 'none'
```

- Inline artifact JS/styles keep working (artifacts are inline-script by design; the storage shim and aio-target capture script are inline). External scripts blocked (no `'self'`, no schemes).
- `img-src data: blob:` / `media-src blob:` / `font-src data:` cover self-contained embedded media; remote loads blocked.
- `connect-src 'none'` blocks fetch/XHR/beacon/WebSocket/EventSource. **postMessage is not a network fetch and is not subject to connect-src** — the aio-target click-to-target channel (session surgicaleye, PR #399) is unaffected (asserted in a test).
- `form-action 'none'` blocks form submissions; `base-uri 'none'` blocks model-injected `<base>` re-rooting.
- worker-src/frame-src/object-src fall back to `default-src 'none'` — blob workers, nested browsing contexts, plugins blocked.

**Per-renderer exceptions: none.** Audited `src/lib/ai/tools/templates/artifact-templates.ts` (1317 lines, the only template source): fully self-contained — no external scripts/fonts/images, no `fetch`/XHR, no workers (only one external-anchor `<a href>` pattern in a markdown transform; anchor navigation is not CSP-controllable and the sandbox already prevents top-navigation escape). Mermaid renders as plain text (no iframe). One strict policy covers HTML, SVG, markdown, and React-preview paths.

## Verification evidence

- `pnpm vitest run src/components/artifact` — **9/9 pass** (5 new CSP tests: policy denies external origins/no http(s):/'self'; meta placement + idempotency + ordering before artifact content; fragment wrapping; CSP present in every iframe-rendering artifact type's srcdoc via renderToStaticMarkup; aio-targeting path keeps CSP + capture script + shim together).
- `pnpm vitest run src/lib/design` — **73/73 pass** (aio-targeting suite included).
- `pnpm typecheck` in `surfaces/ai.allternit.com` — **0 errors**.
- `node scripts/release-preflight.mjs` from repo root — **35 passed, 0 failed**.
- No renderer path injects external `<script src=http…>` or fetch/XHR shims (grep over renderer + template sources); exports remain client-side (no server code touched).

## Incidents

- `gh pr create --body` with inline markdown failed (flag parse) — retried with `--body-file`.
- PR #407 initially unmergeable: concurrent session `artdecisions-0912` merged to main first and both sessions had committed `.steering/checkpoint.md`. Resolved by keeping this session's checkpoint (ours) — per-session steering state; the ledger keep-both rule was not relevant to that file. Merge then succeeded.
- `pnpm install` at worktree root produced an unrelated `pnpm-lock.yaml` peer-suffix diff (esbuild 0.27.3→0.28.0) — reverted before merge; PR carries no lockfile change.

## Honest deferrals

- **`LibraryItemDialog.tsx`** (`src/views/library/`) builds its own sandboxed srcdoc iframe using only `injectSandboxStorageShim` — same class of egress gap, untouched to keep the PR scoped to #396. `injectSandboxCsp` is exported and ready; recommend a one-line follow-up.
- Other srcdoc iframes outside the artifact renderer (`McpAppFrame`, `HtmlPreview`, `QuickChart`, `CodePreviewProgram`, `Phase3Components`, `ContentPreview`, `ArtifactTemplateGallery`, `UnifiedMessageRenderer`, `ArtifactPreviewPane`, `HyperFramesTimelineEditor`, playground `ArtifactPreview`, code `ArtifactCenter`) are separate surfaces with their own trust models — not covered by DESIGN.md §11 and out of scope here.
- Anchor-click navigation inside the sandboxed iframe cannot be blocked via CSP (no navigation directive exists); residual risk is the iframe itself loading an external page, which the sandbox flags already confine (no `allow-top-navigation`, no same-origin).

## Desktop rebuild

Required (web surface assets are bundled into the desktop app). Sidecars copied from shared checkout, `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` run, bundle grep `default-src 'none'` verified, new 8-file build set preserved to shared `release/`, previously-latest set retired. (Details recorded at rebuild time; see PR #407 and issue #396 close comment.)

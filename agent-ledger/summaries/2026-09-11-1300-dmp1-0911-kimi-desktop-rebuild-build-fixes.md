# 2026-09-11 — session/dmp1-0911 — Desktop rebuild + build-system long-term fixes

- **Session:** `session/dmp1-0911` · PRs #337 (office-engine cast) + #345 (build fixes) · agent: kimi-code
- **Context:** post-merge desktop rebuild after PR #332 (ritual step 8). Eoj directive mid-session:
  **no sidesteps — land real production fixes.**

## What the rebuild surfaced (10 dist attempts)

1. **Phantom deps in `surfaces/ai.allternit.com`** (issue #336): `@blocksuite/icons`
   (vite.config alias), `immer` (bot-allternit-bus), `yjs` (BlockSuiteEditor), `mermaid` —
   imported but undeclared; resolved only via the shared checkout's stale node_modules.
2. **`services/office-engine` release-path breakage** (real bug, PR #337): `markdown-url.ts`
   cast `as unknown as Document` under `lib: ["ES2022"]` → TS2304; every dist since 84b09178b
   died in prepare:office-engine. Fixed with `ConstructorParameters<typeof Readability>[0]`.
3. **`urllib` optional `proxy-agent`**: esbuild bundling of the connector sidecar needs it
   resolvable; npm ci skipped it.
4. **`build:main` `@types/ws`**: `ws` is a declared runtime dep but had no types.
5. **Accidental DOM lib**: preload only compiled because transitive `@types/opentype.js`
   references lib dom.
6. **electron-builder collector**: desktop package.json had no `packageManager` field →
   npm fallback → `npm ls` ELSPROBLEMS pollution → "No JSON content found in output".

## The real fix (PR #345, merged `9f806011e`)

- desktop `package.json`: `packageManager: pnpm@10.28.0` (matches root; electron-builder now
  deterministically uses the pnpm collector) + `@types/ws` devDep.
- ai surface `package.json`: declares `@blocksuite/icons ^2.2.17`, `immer ^10.2.0`,
  `mermaid ^11.16.1`, `yjs ^13.6.30`; lockfile updated.
- desktop preload tsconfig: `lib: ["ES2022", "DOM"]` explicit.

## Verification (honest, no hacks)

Session worktree node_modules fully removed → fresh `pnpm@10.28.0 install` (1m41s) →
`npm run dist` with **no env vars and no manual symlinks** → arm64 + x64 DMGs built.
`searching for node modules pm=pnpm` confirms deterministic collector selection.
Bundle markers grepped OK in `release/mac-arm64/.../platform/assets`:
`allternit-brand` (A:// Design System default), `Penpot is not configured` (honest tool),
`import-url` (import modal client). `node scripts/release-preflight.mjs`: 35 passed, 0 failed.

Verified canonical DMGs (`Allternit-Desktop-1.1.1-b2065-arm64.dmg`, built from merged main
incl. #337+#345) copied to the shared checkout `release/`. The older shared `b2075` dmg was
built from the shared checkout's in-flight branch state and was left untouched (not this
session's artifact to delete).

## Notes / deferred

- Shared checkout `node_modules` carries additive gitignored symlinks from the rebuild
  debugging (icons/univerjs/immer/yjs/mermaid/ws/chrome/filesystem/offscreencanvas/
  opentype.js/proxy-agent). Left in place deliberately: removing them mid-flight could break
  the concurrent session using the shared checkout; the next `pnpm install` reconciles them.
  With #345 merged, a fresh install no longer needs any of them.
- The `vite.config.ts` cross-package `paths:` resolution of `@univerjs/core` via
  `packages/@allternit/office-sheets-app` remains a documented hack (works once workspace
  deps are installed); flagged in issue #336.
- Vercel PR checks fail account-wide (deploy rate limit) — environmental, pre-existing.

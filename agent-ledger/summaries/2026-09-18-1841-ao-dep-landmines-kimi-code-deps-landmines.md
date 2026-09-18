# 2026-09-18-1841 ao/dep-landmines — undeclared-deps sweep "PR-E landmines" group

**Agent:** kimi-code subagent | **Branch:** `ao/dep-landmines` | **PR:** #620 merged `ec709de7d855fae58ad8acd31287315294e48278` (merge commit)

## What was done

Fixed the 5-item "PR-E landmines" scope from the undeclared-deps sweep (`/tmp/dep-audit/final.txt`), each verified on current origin/main first. Six conventional commits:

1. **fuse → fuse.js** (`f2c2c2798`): `LogSelector.tsx` imported bare `fuse` (npm: Linux FUSE bindings, absent from lock). `fuse.js@6.6.2` was ALREADY declared in cmd/gizzi-code package.json + lock — only the specifier was wrong. Usage matches fuse.js v6 API (default-exported Fuse class; deep-search ranker consumes `search()` results shaped `{item, score}` in compiled `_temp5`/`_temp4`).
2. **cli-highlight + highlight.js** (`afb2ee02a`): both imported but undeclared → silent null degradation in `cliHighlight.ts`. Added `cli-highlight@2.1.11` + `highlight.js@11.12.0`; deleted the redundant ambient `declare module` blocks in `src/types/global.d.ts` (both packages ship types). Found + fixed a latent interop bug: highlight.js ESM/types are default-export-only, so `highlightJs.getLanguage` was always undefined — now read off `.default`. Verified under Bun: `getLanguageName('foo/bar.ts')` → 'TypeScript'.
3. **redis** (`b6d7ea813`): `cloud-relay/src/server-redis.js` + `cowork-controller/src/controller-redis.js` import node-redis v4 API. **Decision: add `redis@4.7.1`, NOT port to ioredis** — all ~13 call sites are node-redis v4 shaped (createClient/duplicate/subscribe-callback/isReady/setEx/lPush/lRange/lTrim), and the connection-failure→in-memory-fallback path depends on node-redis failure semantics (ioredis auto-retry + unhandled 'error' events = behavioral risk). Verified createClient exposes every called method.
4. **optionalDependencies** (`00f27166f`): `image-processor-napi: "*"` (bundled-mode dynamic import; npm name is a 0.0.1 reservation; all call sites try/catch-guarded or bundler-stubbed) and `playwright: ^1.58.2` (lazy visual-verification adapter; 1.58.2 already in lock as vitest's optional peer). No behavior change.
5. **cowsay** (`e22077fd5`): added `^1.6.0` to devDependencies. The test was ALREADY RED on main: dependency auto-install became an explicit `GIZZI_AUTO_INSTALL_DEPS` opt-in after the test was written, so `bun install` never ran in the tmp `.gizzi` dir. Test now sets the env scoped to itself (try/finally). 3/3 pass across repeated runs.
6. **plugin-sdk langchain peer** (`7751c9d99`): declared `langchain >=0.1.0` optional peer (guarded `require('langchain/tools')` probe), mirroring the existing react optional peer. NOTE: this repo's pnpm auto-installs optional peers (react is installed the same way), so the lockfile gained the resolved langchain tree (~165 added lines; only non-additive change repo-wide is `@cfworker/json-schema` losing its `optional: true` flag, which langchain's dep tree legitimizes).

## Lockfile approach

`pnpm add` re-resolved unrelated esbuild peer variants (0.27.3↔0.28.0 flips in @tailwindcss/vite/wxt snapshots — same failure class the ao/ssh-bridge-deps session hit). Hand-edited importer blocks + package/snapshot entries per the established playbook; all unrelated churn reverted (line-precise). Final: `pnpm install --frozen-lockfile` exit 0.

## Verification evidence

- `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — exit 0, no output
- `bun run test` — SMOKE PASS: 107 entries green, 0 fail (1353 tests, 6247 expects)
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed
- `pnpm install --frozen-lockfile` — exit 0 (also re-verified after rebase onto b0011's merge)
- bare `fuse` import grep — zero remaining matches
- Rebase onto `origin/main` (15cce43e8, b0011) clean — no file overlap

## Incidents / honest notes

- Pre-existing red test (cowsay/registry) was fixed rather than skipped; root cause was the auto-install opt-in gate, not the missing declaration alone.
- `image-processor-napi` cannot be pinned meaningfully (npm placeholder); open range records intent and stays future-proof.
- Out of scope per instructions: `bun`, `ws`, `uuid`, `cors`, `express`, and the remaining cmd/gizzi-code undeclared deps belong to other PRs; never-touch paths untouched.

## Deferred

Nothing in this scope. The rest of the sweep's cmd/gizzi-code list awaits its owning PRs.

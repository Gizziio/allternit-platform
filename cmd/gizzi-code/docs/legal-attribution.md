# Legal & Attribution Audit — gizzi-code (vendored Anthropic-derived code)

**Date:** 2026-09-04
**Scope:** `cmd/gizzi-code/` in the allternit monorepo
**Status:** FOR INTERNAL REVIEW — contains launch-blocking findings (see §6)

---

## 1. Fork lineage and what code is derived from upstream

`gizzi-code` is a fork of Anthropic's Claude Code CLI (the interactive
agentic CLI whose npm distribution is `@anthropic-ai/claude-code`). The
derivation is pervasive, not confined to a `vendor/` directory:

| Area | Path | Provenance |
|------|------|------------|
| Interactive TUI application | `src/cli/ui/ink-app/` (~2,700 TS/TSX files, incl. the parallel `components/` tree) | Derived from upstream CLI source, including React-compiler output |
| Vendored UI components | `src/cli/ui/ink-app/components/vendored/` (155 files) | Upstream components, compiled (`react/compiler-runtime`), `@ts-nocheck` |
| Vendored React hooks | `src/cli/ui/ink-app/hooks/vendored/` (104 files) | Upstream hooks, same treatment |
| Runtime / tools / services | `src/runtime/` (tools, compact, integrations, server) | Derived from upstream runtime |
| Agent SDK | `packages/sdk` (published name `@allternit/gizzi-sdk`, consumed in-repo as `@allternit/sdk`) | Derived from the Claude Agent SDK |
| Type shims for Anthropic SDKs | `src/vendor/anthropic-stubs/` (`bedrock-sdk.ts`, `vertex-sdk.ts`, `foundry-sdk.ts`, `sandbox-runtime.ts`, …) | Hand-written/derived stub declarations of upstream SDK surfaces |
| Other vendor dirs | `src/vendor/@allternit/extension`, `src/vendor/color-diff-napi` | Allternit-owned or third-party (color-diff-napi is its own package with its own `package.json`) |

There are **no LICENSE or NOTICE files** in any `vendor/` or `vendored/`
directory. The vendored files carry no copyright or attribution headers
(first lines are `// @ts-nocheck` and imports).

### Under what terms was the upstream code obtained?

What is actually in the repo:

- `cmd/gizzi-code/LICENSE` — **MIT License, "Copyright (c) 2025 gizzi-code"**.
- `package.json` — `"license": "MIT"`.
- No upstream license text, no upstream copyright notice, no NOTICE file, no
  copy of any Anthropic terms, anywhere in `cmd/gizzi-code/`.

⚠️ **This is the central legal problem.** Upstream Claude Code is
**proprietary software**: its npm distribution is shipped under the
[Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
(or Consumer Terms), not an open-source license. Claude Code's source is not
publicly licensed for copying, modification, or redistribution. The fork's
root MIT license applies to Allternit's *original* contributions, but
Allternit cannot unilaterally re-license Anthropic's code under MIT, and the
MIT license's own condition ("The above copyright notice and this permission
notice shall be included") cannot be satisfied for the Anthropic-derived
portions because no Anthropic notice exists in the repo.

**Nothing in this document is legal advice.** The finding is: *the basis on
which the fork may lawfully distribute Anthropic-derived code is not
documented in the repository.*

## 2. Modifications Allternit has made (diff categories)

Based on the current tree and `docs/UPSTREAM_COMPAT.md` /
`docs/telemetry.md`:

- **Auth & identity (rewritten):**
  - Upstream OAuth/config-key auth replaced by an Allternit identity stack:
    Clerk JWT sessions, `alt_`-prefixed durable API keys minted by
    allternit-cloud-api (`src/shared/utils/allternitToken.ts`,
    `src/runtime/server/middleware/clerk-auth.ts`, `src/cli/commands/api-keys.ts`).
  - OS keychain credential store with marked insecure fallback
    (`src/runtime/context/config/credential-store.ts`, `keychain-backend.ts`,
    `auth-profiles.ts`; see repo AGENTS.md credential-storage section).
  - Local server bearer tokens re-minted under an Allternit-owned `gizzi_`
    prefix (this slice).
- **Telemetry (rewritten):** upstream analytics sinks replaced with an
  Allternit-owned OpenTelemetry exporter to `api.allternit.com`
  (`docs/telemetry.md`, `src/shared/constants/cloudUrls.ts`); kill switches
  `GIZZI_TELEMETRY=off` / `gizzi config telemetry off`.
- **Branding (partial):** product renamed gizzi/gizzi-code; docs, privacy,
  billing, and install URLs repointed to `allternit.com` / `gizziio.com`
  hosts; `CLAUDE_CODE_*` env surface dual-named to `GIZZI_*` (this slice).
  Remaining upstream identifiers are inventoried in `docs/UPSTREAM_COMPAT.md`.
- **Feature removals/gates:** upstream official marketplace auto-install
  disabled (`GIZZI_ENABLE_UPSTREAM_MARKETPLACE=1` opt-in); upstream
  marketplace source refused; `~/.claude/plugins` demoted to read-only
  legacy fallback.
- **Additions:** Rails peer messaging, vault subsystem, cron daemon, cowork
  runtime, voice, brain memory — Allternit-original code.

## 3. Attribution notices required — and whether they exist

If the upstream code were under a permissive license (e.g., MIT/Apache), the
typical requirements would be: retain copyright notice + license text
(includes/substantial portions), and for Apache, a NOTICE file. **None of
these exist** for the Anthropic-derived portions:

- ❌ No upstream copyright notice retained.
- ❌ No upstream license text present.
- ❌ No NOTICE file.
- ❌ README does not mention the fork lineage (README "License" section says
  only "MIT"; `cli-package/README.md` says "MIT License").
- ❌ No per-file SPDX or attribution headers in vendored files.

Because the actual upstream terms are proprietary (not permissive), the
question is not merely "did we keep the MIT notice" — it is whether the
distribution is permitted at all (see §6).

The `@anthropic-ai/sdk` npm dependency itself **is** MIT-licensed and is a
normal dependency (retained via npm with its license intact in
`node_modules`); using it is unproblematic and is *not* the issue. The issue
is the forked CLI/SDK *source*.

## 4. Trademark analysis — upstream names visible to users

| Surface | Upstream name still visible | Risk |
|---------|------------------------------|------|
| Env vars | ~210 `CLAUDE_CODE_*` names remain readable (inventoried in `docs/UPSTREAM_COMPAT.md`); child processes receive `CLAUDE_CODE_*` markers | **High** — "CLAUDE" is an Anthropic trademark; widespread visible use in a competing product invites claims. Mitigation started (dual-name), completion needs a deprecation plan. |
| Model/API references | "Claude", "Claude Code", claude.ai URLs retained for OAuth, remote agents, connectors, guide agent | **Medium** — nominative references to the model/API being called are defensible (trademark nominative fair use), but marketing copy must not imply endorsement. |
| npm scope | `@anthropic-ai/gizzi` was removed this slice; `@anthropic-ai/claude-code` remains only in leftover-install cleanup UX | **Low now** — previous state (a "gizzi" package under the `@anthropic-ai` scope, had it been published) would have been a serious misrepresentation. |
| Config paths | `~/.claude` legacy fallback (read-only) | **Medium** — invisible to most users, but the directory name persists on user machines. |
| API constants | Beta header value `claude-code-20250219` sent to the Anthropic API | **Low** — protocol contract, required for the API to accept beta features. |
| Docs map fetch | `code.claude.com/docs/en/claude_code_docs_map.md` fetched at runtime by the guide agent | **Low** — functional dependency; caching/rehosting recommended before launch. |

## 5. License coverage gaps (repo root)

- ⚠️ **The monorepo root has no LICENSE file.** `cmd/gizzi-code/LICENSE`
  covers only that subtree (and only Allternit-authored code, per its
  "gizzi-code" copyright assertion).
- ⚠️ `cmd/gizzi-code/LICENSE` asserts MIT over the *entire* package,
  including Anthropic-derived code — see §1/§6.

## 6. Recommendations (with owners)

1. **BLOCKER — Legal review before any public launch or distribution.**
   Owner: Allternit leadership + counsel. Question: under what right is
   Anthropic-derived source copied, modified, and redistributed? If the
   answer is an agreement/permission, document it in-repo. If there is no
   right, the launch posture (public npm, public GitHub, docs site) must be
   re-thought.
2. **Fix the LICENSE files.** Owner: engineering + counsel. Until (1)
   resolves: do not claim blanket MIT over derived code; add a NOTICE file
   acknowledging the fork lineage; add a LICENSE note distinguishing
   Allternit-original code from derived code. Add a root LICENSE.
3. **Add `cmd/gizzi-code/NOTICE`.** Owner: engineering. State: "Portions
   derived from Anthropic's Claude Code; © Anthropic PBC. All rights
   reserved; used under [basis TBD by counsel]." plus attribution for
   `@anthropic-ai/sdk` (MIT) and any other vendored OSS (color-diff-napi).
4. **Complete the env-var rename with a deprecation window.** Owner:
   engineering. `CLAUDE_CODE_*` reads should warn once and honor `GIZZI_*`
   first (mechanism added this slice via `src/shared/utils/gizziEnv.ts`);
   target removal of visible `CLAUDE_` names in a major release.
5. **Audit remaining `Claude`/`claude.ai` user-visible strings before
   marketing.** Owner: engineering + marketing. Keep only nominative,
   factually-accurate references (the model being called, the OAuth host the
   user must visit).
6. **Rehost or cache runtime upstream dependencies.** Owner: engineering.
   Guide-agent docs map (`code.claude.com/docs/.../claude_code_docs_map.md`),
   WebFetch preapproved domains, and native-installer download bucket
   (`storage.googleapis.com/claude-code-dist-...`) all pull from upstream
   infrastructure under upstream control; they can break or change
   unilaterally.
7. **Header/SPDX sweep of `vendored/` trees.** Owner: engineering. Whatever
   notice counsel settles on (recommendation 1/2), the 259 vendored files
   currently carry none.

## Appendix — evidence index

- `cmd/gizzi-code/LICENSE` (MIT, "Copyright (c) 2025 gizzi-code")
- `cmd/gizzi-code/package.json` (`"license": "MIT"`, `@allternit/sdk` workspace dep)
- `cmd/gizzi-code/src/vendor/anthropic-stubs/` (no license files)
- `cmd/gizzi-code/src/cli/ui/ink-app/{components,hooks}/vendored/` (259 files, no headers)
- `cmd/gizzi-code/docs/UPSTREAM_COMPAT.md` (env var + URL triage inventory)
- `cmd/gizzi-code/docs/telemetry.md` (fork telemetry architecture)
- `node_modules/@anthropic-ai/sdk/package.json` (`"license": "MIT"`)

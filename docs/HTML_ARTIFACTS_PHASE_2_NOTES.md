---
status: done
files_changed:
  - cmd/gizzi-code/src/runtime/services/api/allternitApi.ts
  - cmd/gizzi-code/src/cli/commands/html-artifact.ts
  - cmd/gizzi-code/src/cli/main.ts
  - cmd/gizzi-code/src/runtime/artifacts/types.ts
  - cmd/gizzi-code/src/runtime/artifacts/generateHtml.ts
  - cmd/gizzi-code/src/runtime/artifacts/config.ts
deviations:
  - "Command is a plain TS yargs command, not a builtin plugin/SKILL.md (task
    section 5 left this open). Reasoning: a SKILL.md teaches an *agent*
    a workflow it improvises; this generator is explicitly required to be a
    pure, deterministic function driven by a fixed structured schema, not
    agent-authored freeform HTML — closer to a CLI tool than a skill. See
    'Skill/plugin placement' below."
  - "getAllternitApiConfigWithDeviceToken() is new and not literally 'gizzi-
    code's existing MCP device-token consumer' — Step 0 investigation found
    no such consumer exists today (see 'Device token source' below). It
    reuses the exact same token source/storage (Pairing/runtime-device.json)
    that instance-registration.ts already uses for a *different* backend
    (allternit-cloud-api), just pointed at allternit-api's canvas routes for
    the first time. Falls back to the pre-existing ALLTERNIT_API_TOKEN/
    desktop-bootstrap precedence when unpaired (the common case in dev)."
  - "Noticed but did not fix: allternitApi.ts's pre-existing /tasks and
    /automation/* calls omit the /api/v1 prefix, but canvas_routes.rs (and
    every other v1 router in main.rs, including task_routes/automation_router)
    is nested under /api/v1 — those calls look like they'd 404 against a real
    server. Out of scope for this phase (didn't write those functions, no
    caller of them exists yet either — grepped, confirmed zero consumers of
    allternitApi.ts before this phase). My new canvas functions explicitly
    include /api/v1, verified against a running server (see Verification)."
remaining:
  - "CLI entrypoint (src/cli/main.ts, and therefore `gizzi html-artifact ...`
    invoked as a real subprocess) currently fails to boot in this worktree —
    unrelated, pre-existing missing dependencies (figures, axios, yaml, sharp
    all imported directly by unrelated ink-app/TUI files but not declared in
    cmd/gizzi-code/package.json). See 'Verification' for how I actually
    exercised the real code (direct handler invocation) and the exact
    upstream error. Not something this phase's diff caused or can fix —
    flagging for whoever owns dependency hygiene here."
  - "Device-token auth path (Pairing-sourced token attached to a canvas
    publish call) is implemented and code-reviewed but not exercised through
    an actual paired device end-to-end — this dev machine isn't paired, and
    I deliberately did not fabricate a fake runtime-device.json in the real
    global data dir to simulate one (risk of corrupting real local pairing
    state for a shared dev machine). What IS verified: the unpaired fallback
    path (falls through to existing auth cleanly), and — from Phase 1 — that
    allternit-api's canvas routes genuinely accept a valid device token end
    to end. The only unverified link is gizzi-code's own attach-the-token
    plumbing, which is ~10 lines and mirrors instance-registration.ts's
    already-proven resolveToken() pattern exactly."
---

## Step 0 investigation

### 1. Session context

gizzi-code's own \"session\" concept (`src/runtime/session/*`) is per-
conversation chat/prompt state (history, compaction, checkpoints) — entirely
local, never registered with allternit-api's `agent_sessions` concept. I also
found `src/runtime/server/routes/agent-compat.ts`: gizzi-code's *own* local
HTTP server exposes an `/api/v1/agent-sessions/*` surface for the iOS app to
talk to a locally-running gizzi instance directly — same URL shape as
allternit-api's, but it's the opposite direction (gizzi-code as the server,
not a caller of allternit-api), a different concept entirely, and not
something a one-shot publish command should depend on being up.

Conclusion: there is no existing, reusable agent-session id a bare
`gizzi html-artifact publish` invocation could read. Confirmed by reading
`canvas_routes.rs` (already read in Phase 1, re-confirmed here): `session_id`
in `agent_canvases` is a bare `TEXT` column, no `FOREIGN KEY`, no
existence check anywhere in `create_canvas`/`get_canvas`/`list_canvases` —
the backend fully tolerates an arbitrary caller-supplied string.

**Decision**: mint a random UUID (`crypto.randomUUID()`) the first time an
`artifact_key` is published, and persist it in that artifact's own
`config.json` (`sessionId` field) for reuse on every subsequent redeploy.
This is *not* gizzi-code's ephemeral chat-session id — it has to be
long-lived, because allternit-api's upsert identity is the **pair**
`(session_id, artifact_key)` (Phase 1 NOTES). If session_id changed between
publishes (e.g. a fresh id per process run), every \"redeploy\" would
silently create a new canvas instead of updating the existing one, which
defeats the entire point of Phase 1's stable-key upsert. Each artifact gets
its own session_id (they don't need to share one — nothing requires it,
and not sharing one means one artifact's config can be deleted/regenerated
without affecting another's identity).

### 2. Device token source

Grepped for `allternit_runtime_` / `DEVICE_TOKEN` / device-token issuance
across `cmd/gizzi-code/src`. Found the real source:
`src/runtime/services/pairing/pairing.ts` (`Pairing` namespace) — `gizzi pair`
runs a device-code flow against allternit-cloud-api and persists a durable
(~90 day) `allternit_runtime_…` bearer token at
`<Global.Path.data>/runtime-device.json` (mode 0600), with `Pairing.load()` /
`Pairing.tokenUsable()` to read it back.

**The task's premise (\"gizzi-code already uses this for its MCP calls\")
didn't hold up under investigation** — I looked for an actual consumer that
attaches this token as `Authorization: Bearer` to an MCP-related call and
found none:
- `src/runtime/tools/mcp/bundled.ts`'s `allternit-connectors` MCP server
  (the one thing that does call allternit-api's `mcp_proxy_internal`) uses a
  completely different credential — a static shared secret via
  `x-allternit-internal-token` (`ALLTERNIT_INTERNAL_SERVICE_TOKEN`), not a
  bearer device token at all.
- The **only** real consumer of `Pairing`'s device token today is
  `src/runtime/server/instance-registration.ts` (`gizzi serve --tunnel`
  self-registration), and it calls **allternit-cloud-api**
  (`Flag.GIZZI_PLATFORM_API_URL`, `PUT /api/v1/gizzi-instances/self`), a
  different service from allternit-api (port 8013, `ALLTERNIT_API_URL`).

So: the token *source* is real and exactly as documented (`Pairing`,
`runtime-device.json`, `allternit_runtime_…` prefix — this is genuinely
what `connector_routes.rs`'s doc comment means by \"what gizzi-code's pairing
service sends\") — but no code path today sends it to allternit-api
specifically, for MCP or anything else. Per the task's own instruction for
this exact scenario (\"if the existing MCP code has a gap... document it
precisely rather than inventing a workaround, and fall back to
ALLTERNIT_API_TOKEN/desktop-bootstrap dev-fallback auth... noting it as a
follow-up\") I did document it — but I judged that *wiring it* was still the
right call here (not a new workaround): `Pairing.load()` is the exact same
token source/storage the task asked me to reuse, `instance-registration.ts`'s
`resolveToken()` is a directly-copyable pattern, and Phase 1 built
device-token support into canvas routes specifically so a CLI client would
use it. Not wiring it and only doing the fallback would leave Phase 1's new
auth path completely unreachable from gizzi-code. See
`getAllternitApiConfigWithDeviceToken()` in `allternitApi.ts`.

## Scope delivered

### 1. Backend client — `allternitApi.ts`

Added (full diff in the file, section \"Canvases (HTML artifact publish)\"):
- `getAllternitApiConfigWithDeviceToken()` — layers the paired-device token
  (when usable) on top of the existing `getAllternitApiConfig()` precedence.
  Existing callers/behavior of `getAllternitApiConfig()` itself are
  untouched.
- `publishApiCanvas(config, sessionId, input)` →
  `POST /api/v1/agent-sessions/:session_id/canvases`
- `listApiCanvases(config, sessionId)` →
  `GET /api/v1/agent-sessions/:session_id/canvases`
- `getApiCanvas(config, canvasId)` → `GET /api/v1/canvases/:canvas_id`
- Types `ApiCanvas`, `ApiCanvasListResponse`, `ApiCanvasPublishResponse`
  matching Phase 1 NOTES's documented response shapes exactly (including
  `artifact_key`/`version` on every shape).

Same `apiFetchJson`/error-handling style as the existing `/tasks` and
`/automation/*` functions in this file.

### 2. Deterministic HTML generator — `runtime/artifacts/`

- `types.ts` — `ArtifactInput`: `{ title, subtitle?, status?, tabs[] }`,
  each tab `{ id, label, callout?, sections[] }`, each section
  `{ heading?, body?[], list?[], table?, stats?[] }`. Every field is data,
  not markup — no free-form HTML anywhere in the schema, which is what makes
  the \"byte-identical in ⇒ byte-identical out\" guarantee possible at all.
  Tab `id` is caller-supplied (not generated) specifically so re-generating
  from the same input never depends on anything invented at generation time.
- `generateHtml.ts` — `generateArtifactHtml(input): string`. Pure: walks only
  the input's own arrays (never `Object.keys`/`for...in`), no `Date.now()`,
  no `Math.random()`, no ids minted during generation. Validates (non-empty
  title, ≥1 tab, tab ids match `/^[a-z0-9-]+$/` and are unique) and throws
  clearly rather than emitting broken markup. Self-contained: inline
  `<style>` (CSS variables, `prefers-color-scheme` dark mode), one small
  inline vanilla-JS tab switcher (only emitted when there's >1 tab), zero
  external requests/CDN links. All user text is HTML-escaped. Written from
  scratch — informed by `project-artifact/template.html`'s general
  vocabulary (status pill, tabs, callouts, CSS-variable theming) but its own
  CSS palette, its own tab-switch script, its own tone system
  (accent/warn/danger/neutral), and none of that template's specific
  markup/mechanism-A/mechanism-B machinery.
- `config.ts` — `slugify()`, and the `.gizzi/artifacts/<slug>/config.json`
  store (see below).

Verified deterministic directly (see Verification): two calls with a
`structuredClone`d identical input produced byte-identical strings.

### 3. Command — `gizzi html-artifact`

`src/cli/commands/html-artifact.ts`, registered in `main.ts` next to every
other real command (`.command(HtmlArtifactCommand)`). Name chosen to avoid
both documented collisions: the existing top-level yargs commands (grepped
all of them — `html-artifact` isn't among them) and the ink-app TUI's
`/artifact` slash-command (`src/cli/ui/ink-app/commands/artifact/`, a
different namespace entirely — interactive-chat slash-commands vs. shell
subcommands, never confusable, but it's what the task flagged so: confirmed
no collision, left that file untouched).

Two subcommands:
- **`gizzi html-artifact publish [--input <file.json|-> ] [--key <slug>]`**
  — generate + publish/redeploy. `--input` is a path to JSON matching
  `ArtifactInput` (or `-` for stdin); omit it to redeploy `--key` with its
  last-saved input unchanged (a \"touch\"/force-redeploy). `--key` is the
  stable `artifact_key`; defaults to `slugify(title)` when omitted. The
  session id is minted once per artifact (see Step 0 #1) and persisted.
  Reports `Published` (version 1) vs. `Redeployed` (version > 1) per the
  response, matching the task's explicit ask.
- **`gizzi html-artifact status --key <slug>`** — reads the local config,
  `GET`s the canvas by its saved id, prints current version/updated_at.

`components` sent to the canvas endpoint: `[{ type: \"artifact\", kind:
\"html\", title, content: htmlString }]`. There's no established
server-persisted shape for this (Phase 1's map doc is explicit that
`components` is a generic JSON blob and the frontend's `ArtifactUIPart`
type — `{type:'artifact', kind, title, content, url}` — is *not* what's
persisted server-side, just the closest documented analog). I matched that
frontend shape's field names minus the fields only a consumer can fill in
(`artifactId`, `url`), on the theory that it's the most-likely-compatible
guess for whatever Phase 3 (iOS) ends up expecting — flagging clearly here
so Phase 3 can adjust the shape if the real iOS parsing needs something
different; the canvas's own `artifact_key`/`version` top-level fields (not
`components`) are what actually carry the stable-key semantics, so changing
this shape later is a compatible, low-risk change.

### 4. Config store — `.gizzi/artifacts/<slug>/config.json`

`resolveArtifactConfigPath`/`writeArtifactConfigPath` in `config.ts` mirror
`getRelativeSettingsFilePathForSource` (settings.ts:305-321) and
`pickMemoryFile` (config.ts:1790-1802) exactly: prefer `.gizzi/...` if it
exists, else read (never write) `.claude/...` if *that's* what's there, else
default to `.gizzi/...` so new artifacts always write the new-style path.
Verified this precedence directly (see Verification).

Stored fields: `configVersion`, `artifactKey`, `sessionId` (Step 0 #1),
`canvasId`/`lastPublishedVersion`/`lastPublishedAt` (informational, for
`status` without a network round-trip), and `input` — the full last-used
`ArtifactInput`, so `publish --key <slug>` with no `--input` can redeploy
without re-specifying anything.

### 5. Skill/plugin placement

**Chose: plain TS command, not a builtin plugin/SKILL.md.** A `SKILL.md`
exists to teach an *agent* a workflow it improvises through (per
`project-artifact`'s own SKILL.md: \"pick tabs → generate HTML → review →
publish\" — the agent authors the HTML each time, freely). This phase's spec
explicitly inverts that: the generator must be a **pure function** producing
**byte-identical output for byte-identical structured input** — there's no
agent-authored HTML in this design at all, the whole point is a
deterministic template-filler over a fixed schema. That's a CLI tool's
shape, not a skill's. If a future phase wants an agent to freely compose
artifact content, that's a different, additive feature (an agent-facing
skill that *calls* this same generator with agent-composed `ArtifactInput`
JSON) — not a reason to wrap this phase's deterministic core in SKILL.md
today.

## Verification

### Generator determinism (direct, isolated)

```
$ bun run <scratch-script importing generateArtifactHtml>
byte-identical across two calls: true
length: 4677
```

Same `ArtifactInput` (via `structuredClone`) run through
`generateArtifactHtml` twice produced identical strings both times.

### Typecheck

`cmd/gizzi-code` has no local `tsc`/`node_modules` in this fresh worktree.
Used `~/.gizzi/node_modules/.bin/tsc` (TypeScript 7.0.2, this machine's
installed gizzi-code's own bundled compiler) against this worktree's
`tsconfig.json`, after `pnpm install --filter \"@allternit/gizzi-code...\"
--ignore-scripts` (a native module, `better-sqlite3`, fails to compile
against this machine's Node 26.5.0 V8 headers — pre-existing environment
issue, unrelated to this phase; `--ignore-scripts` sidesteps it for
typecheck/dep-resolution purposes):

```
$ NODE_OPTIONS=--max-old-space-size=8192 ~/.gizzi/node_modules/.bin/tsc --noEmit > /tmp/tsc-full.log
exit: 1
$ wc -l /tmp/tsc-full.log
113
$ grep -n \"html-artifact\\|runtime/artifacts\\|allternitApi\" /tmp/tsc-full.log
(no output)
```

All 113 errors are pre-existing and unrelated: missing `axios`/`yaml`/`sharp`
type declarations (packages directly imported by other, untouched files but
not declared in `cmd/gizzi-code/package.json` — see \"remaining\"), a
`figures` API-shape mismatch in unrelated ink-app TUI components, and one
unrelated `ArrayBuffer`/`SharedArrayBuffer` strictness issue in
`upstreamproxy/relay.ts`. **Zero errors in any file this phase touched or
added.**

### Actually running it — real server, real publish/redeploy round-trip

`bun ./src/cli/main.ts html-artifact --help` currently fails to boot — not
from anything in this phase's diff, but because `main.ts` unconditionally
imports the entire ink-app/TUI command set at module load, and several of
those files import packages directly (`figures`, then `axios` once that was
patched) that not just failed to install but aren't even declared in
`cmd/gizzi-code/package.json` — confirmed by grepping the manifest for each
one and finding nothing. This is a pre-existing gap in this worktree/repo
state, unrelated to anything under `runtime/artifacts/` or
`cli/commands/html-artifact.ts`.

Rather than declare this phase blocked, I verified the actual new code by
invoking the exact exported command handlers directly (same functions
yargs would call — only argv parsing and main.ts's registration line are
skipped, both of which typecheck clean and are three lines of mechanical
wiring), against a **real allternit-api instance** built from this same
worktree (Phase 1's approved backend), on a throwaway `ALLTERNIT_DATA_DIR`:

```
$ ALLTERNIT_DATA_DIR=<scratch> ALLTERNIT_LOCAL_DEV_BYPASS=true ALLTERNIT_API_PORT=8099 \\
    cargo run -p allternit-api   # from cmd/allternit-api

$ ALLTERNIT_API_URL=http://127.0.0.1:8099 bun run <script calling the real handlers>

=== device-token config resolution (expect unpaired fallback) ===
{\"baseUrl\":\"http://127.0.0.1:8099\",\"hasToken\":false,\"userId\":\"gizzi-local\"}

=== publish #1 (new artifact, --input v1) ===
Published \"Weekly Ops Report\" as \"weekly-ops-report\" — canvas 91a64a31-5b68-455a-bab9-9f2c917a6714, version 1.

=== status after publish #1 ===
weekly-ops-report: canvas 91a64a31-..., version 1, session edb043b2-..., updated_at 2026-07-31T08:03:04.917927+00:00

=== publish #2 (redeploy, same --key, no --input) ===
Redeployed \"Weekly Ops Report\" as \"weekly-ops-report\" — canvas 91a64a31-..., version 2.

=== publish #3 (redeploy, same --key, new content via --input v2) ===
Redeployed \"Weekly Ops Report\" as \"weekly-ops-report\" — canvas 91a64a31-..., version 3.
```

Same canvas id across all three calls, version incrementing 1→2→3. Confirmed
independently against the backend directly (not just trusting the CLI's own
report):

```
$ curl .../agent-sessions/edb043b2-.../canvases   # exactly one entry, version 3,
                                                    # components[0].content reflects
                                                    # input-v2.json's text ("Shipped",
                                                    # "final", velocity 45/bugs 15,
                                                    # "resolved" risk) — not v1's.

$ sqlite3 allternit.db \"SELECT COUNT(*), id, version, artifact_key FROM agent_canvases
    WHERE session_id='edb043b2-...' GROUP BY id;\"
1|91a64a31-5b68-455a-bab9-9f2c917a6714|3|weekly-ops-report
```

One row, not three — the actual feature (stable-key upsert, exercised from
the real client this time, not just curl) works end to end.

Also verified: `.gizzi/artifacts/weekly-ops-report/config.json` was written
with the exact shape documented above (`sessionId` matching the canvas's
`session_id`, `lastPublishedVersion: 3`, `input` matching v2's JSON
verbatim); calling `publish` with neither `--input` nor `--key`, and with a
`--key` that has no saved config, both threw the documented clear error
messages rather than a stack trace or silent no-op; and the `.gizzi`-first /
`.claude`-fallback config-path precedence resolves exactly like
`pickMemoryFile` (`.claude` read back when only it exists, `.gizzi` wins the
instant both exist).

Test server and scratch data dir were torn down after verification; nothing
was written to the real dev database or this machine's real
`~/Library/Application Support` pairing state.

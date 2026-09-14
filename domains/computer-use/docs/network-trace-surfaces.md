# HAR record → teach → batch → verify — product surface contract (cu28)

Follow-up to `Research/specs/har-network-traces.md` (PR #499). That session
landed the capability in core + gateway; this document is the contract for
how product surfaces reach it. Requested by joe 2026-09-14 ("supposed to go
into allternit workspace computer use and in all the surfaces").

## HTTP surface (gateway)

Additive routes in `gateway/network_traces_router.py`, same
`/v1/browser-skills` family as `browser_skills_router.py`:

| Route | Purpose |
|---|---|
| `GET /v1/browser-skills` | List workflow specs as distilled summaries (id, title, step count, `hasNetworkTrace`, trace entry count). |
| `GET /v1/browser-skills/{skill_id}` | Inspect one spec: distilled steps (id/kind/target ref/reason), safety counts, and the full taught `networkTrace` (shapes only by construction). |
| `POST /v1/browser-skills/verify` | Run the deterministic chain. Empty body = canned self-check (the landed H3 chain, incl. credential-canary fail-closed). `{skill_id\|workflow, target_url}` = batch+verify that spec against the target. Refusals: 400 no `networkTrace`, 400 non-http(s) target, 404 unknown skill, 422 invalid spec on inspect. Returns `verify_id`; poll the GET below. |
| `GET /v1/browser-skills/verify/{verify_id}` | Verdict: `network.status` (`pass`/`deviated`) + exact-match deviations, a11y diff (or honestly `unverifiable` for arbitrary targets), receipt id/hash, recorded trace. |
| `GET /v1/browser-skills/verify/{verify_id}/receipt/check` | Recomputes the content-derived receipt hash (same canonical-hash machinery as the chain and workflow receipts). `valid=false` ⇒ tampered. |

Binding rules (same as the spec): raw HAR never crosses the API — raw and
scrubbed live-HAR files live in a per-verify temp dir that is deleted before
the verdict is published; only distilled shapes are retained (in-memory, like
the RunStore). Scrub failure fails closed into a `failed` verdict, never a
partial one. Verdicts are deterministic; nothing is fuzzy.

## Console (surfaces/ai.allternit.com — the `ui/` mirror)

The remote-control dashboard's existing computer-use area gains a
**Workflows** section under Recordings (`src/remote-control/recordings/
WorkflowsPanel.tsx` + typed client `src/remote-control/api/workflows.ts`):
spec list, NetworkTrace inspection, self-check / target verify runners,
verdict rendering (deviations, a11y, receipt hash + tamper check). It reuses
`getPlatformComputerUseBaseUrl()` from `src/integration/computer-use-engine.ts`,
so it follows the same override chain as Recordings (manual override →
electron-injected base URL → `http://127.0.0.1:8760`).

## SDK (sdk/allternit-sdk — `@allternit/sdk/computer-use`)

`AllternitComputerUseClient` gains typed methods so any TS surface can call
the routes without hand-rolling fetch: `listBrowserSkills`,
`getBrowserSkill`, `startBrowserSkillVerify`, `getBrowserSkillVerify`,
`checkBrowserSkillVerifyReceipt` (source `js/src/computer-use.ts`; committed
build artifacts under `dist/`).

## Desktop (surfaces/allternit-desktop)

The desktop spawns the ACU gateway itself (`src/main/acu-gateway-manager.ts`
→ `domains/computer-use/core` `launch.py`, port 8760) and exposes
`window.electron.computerUse.getBaseUrl()` to the renderer, which feeds the
same `getPlatformComputerUseBaseUrl()` chain the console uses. There is no
route whitelist anywhere in that path, so the new routes are reachable from
the desktop's bundled console as soon as platform assets are rebuilt (the
standard post-merge desktop rebuild step). The desktop has **no native
computer-use view of its own** (only main-process gateway/driver management),
so per the cu28 scope no desktop-native UI was added — the console panel is
the desktop surface.

## Phone-remote (surfaces/phone-remote)

The phone-remote client (`client/app.js`, vanilla JS) is a screen/mirror
remote with **no computer-use view and no ACU client config at all** — there
is nothing to wire. If a future phone view needs verify status, it should
call the same routes through the SDK methods above against the paired
machine's gateway base URL; that is a deliberate deferral, not a gap in the
API surface.

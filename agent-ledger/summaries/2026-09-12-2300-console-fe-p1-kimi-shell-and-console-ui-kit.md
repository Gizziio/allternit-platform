# Session attestation — session/console-fe-p1 (2026-09-12)

**PR:** #446 (merge `cd02ea08a`) — `feat(platform-console): Phase 1 — Anthropic-IA shell + console-ui kit`
**Program:** Frontend console port, Phase 1 of 7 (plan: `~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_956ff32a-8463-4b88-893e-e3919348a8df/agents/main/plans/lockjaw-supergirl-x-23.md`, evolving `~/allternit-console-gap-analysis.md` Part 4).

## What was done

Phase 1 of the frontend console port: rebuilt `surfaces/platform.allternit.com` shell to the Anthropic console IA and landed the shared `src/components/console-ui/` kit that Phases 2–6 build every page from. All new pages are designed stubs; real pages land in later phases.

- **Nav IA** (ConsoleLayout renders from a shared `navConfig.ts`): Dashboard · API keys · Build (Playground/Files/Skills/Batches) · Managed Agents (Overview/Sessions/Deployments/Computers/Vaults/Memory) · Analytics (Usage/Logs/Caching/Rate limits/Cost) · Gizzi Code (Usage, "soon" badge) · Manage (Rate limits/Spend limits/Members/Service accounts/Security/Webhooks/Tags) · Allternit Cloud (our surface-specific items kept: Organizations/Compute/Devices/Fabric/Runs/Schedules/Approvals/Cloud accounts/Billing/Models/Plans) · Resources (Docs/Settings).
- **Sidebar footer:** Clerk `OrganizationSwitcher` (silent error boundary), credits chip over `GET /api/v1/credits/balance` (refetched on org change, hidden on error, links /billing), user card.
- **Global ⌘K CommandPalette** indexed from the same `navConfig` module — sidebar and palette cannot drift.
- **Kit:** ListPage, FormPage, StatCard, GaugeCard (hand-rolled SVG donut), ModelCard, ResourceCard, CodeTemplateBlock (copy-to-clipboard), CommandPalette, AnnouncementModal (wired to `GET /api/v1/console/announcements`, dismiss-by-id in localStorage, silent on error), Skeleton, Badge, MonoChip, EmptyState, SectionHeading, buttonStyles. The five previously-duplicated settings-kit files moved into the kit with re-export shims at the old paths — existing imports untouched.
- **22 route stubs** behind `ConsoleRoute` via a `ComingSoonPage` factory with per-surface copy and copyable `curl https://api.allternit.com/...` snippets. `/agents` and `/api-keys` keep their existing pages.

## Design-decision record (changed from the pre-backend plan)

The old Part-4 plan called for extracting a workspace `packages/console-ui` shared by both surfaces. Recon showed the actual duplication is six near-identical settings-kit files (diffs: `'use client'` + JSDoc) plus three diverged panels, and the big donor views in `ai.allternit.com` can't move verbatim anyway (they import `@/design/GlassSurface`/shadcn and use base-URL schemes that don't exist on the platform surface). Decision: **platform-internal kit** (`src/components/console-ui/`), donors ported by rewriting their data layer onto `src/lib/api-client.ts` and restyling onto platform Tailwind tokens. The ai surface stays untouched as donor.

## Verification evidence

- `npx tsc --noEmit` (surface typecheck) — 0 errors
- `pnpm build` — succeeds; SPA fallback copied to 21 route directories
- `pnpm preview` smoke: `/`, `/playground`, `/manage/tags` → HTTP 200
- `node scripts/release-preflight.mjs` — 35 passed, 0 failed
- Merge `cd02ea08a` verified an ancestor of `origin/main`

## Honest deferrals

- Auth-gated routes render the Clerk sign-in redirect in preview; full interactive smoke needs a signed-in session. Typecheck+build+route smoke is the per-phase standard for this program.
- Stub copy claims nothing the backend can't do; Phase 2+ replaces stubs with real pages.
- No desktop rebuild: the platform console surface is not desktop-bundled.

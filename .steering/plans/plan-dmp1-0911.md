# Plan — session/dmp1-0911: Design Mode P0 + P1 (locked gap-analysis plan)

Date: 2026-09-11. Author: kimi-code session dmp1-0911.
Governing docs: `/Users/joe/allternit-design-mode-gap-analysis.md` (LOCKED),
`/Users/joe/allternit-design-competitive-mapping.md` (LOCKED, incl. Eoj artifacts-API amendment).

## P0 — honesty-critical

- [x] P0-a `sync_to_penpot` tool (`surfaces/ai.allternit.com/src/lib/agents/tools/penpot-sync.tool.ts`)
      stops fabricating success. Behavior: if no Penpot endpoint/token is configured, return
      `{ success: false, error: "Penpot is not configured..." }`. If configured, call the real API
      (Penpot export/upload); if the call fails, report the failure. Never invent a URL.
- [x] P0-b Implement `POST /api/design/import-url` in `cmd/allternit-api/src/design_connector_routes.rs`
      (the route `DesignImportModal.tsx:43` already calls; currently an orphan per the 2026-09-04
      route inventory). Input `{ url }`; http/https only; SSRF guard (block loopback/private/link-local
      IPs after DNS resolution, cap redirect count, cap response size ~5MB); fetch → parse HTML →
      extract candidate design tokens (hex colors, font families, css custom properties) → return
      `{ name, source_url, tokens, sample_html }` matching what the modal consumes. Also reorder
      the modal's default tab away from URL if a cheaper tab exists (keep URL tab now that it works).
      Update `docs/architecture/2026-09-04-p1-route-inventory.md` orphan entry.

## P1 — brand law (locked decisions: amber-only; A:// Design System default; spec over purple)

- [x] P1-c Register **A:// Design System** as a first-class entry (from canonical tokens:
      ivory #FAF8F4 family, graphite #0F0F0F family, amber #B08D6E scale, typography aliases
      Allternit Sans=Inter fallback / Serif=Newsreader / Mono=JetBrains Mono) and make it the
      **default** selection in `NewProjectScreen` / `directions.ts` (replace 'modern-minimal'
      Linear/Vercel default). Persist the installed design system per project (currently React
      state only, lost on reload — `DesignModeView.tsx:292-293,309`).
- [x] P1-d Extend `src/lib/design/html-linter.ts` with upstream open-design P0 rules (indigo/purple
      hexes, cliché gradients, emoji icons, invented metrics, lorem filler) + a brand check
      (forbidden purple/coral `#e27c59`/`#d97757`/`#7c3aed`/`#8b5cf6` hexes; required token usage)
      and **wire findings back into the generation loop as a system message** (upstream
      `lint-artifact.ts` pattern) instead of display-only badges.
- [x] P1-e Adapt the Anthropic `frontend-design` skill's rules into the studio system prompt /
      bundled skills: plan tokens+type+spacing before code; anti-AI-slop; SVG icons not emoji;
      contrast ≥ 4.5:1; adapted to amber/ivory/graphite (Inter stays only as the local fallback
      alias for "Allternit Sans").
- [x] P1-f Project-bound design system: `designSystemId` stored on the project record and resolved
      at session creation, so generation always knows its bound system.

## P2 quick wins (same PR, cheap)

- [x] P2-g Fix `\z` regex bug + fragile designMd/uiStream extraction (`DesignModeView.tsx:388-399`).
- [x] P2-h Fix mislabeled `CREATION_TYPES` (`NewProjectScreen.tsx:29-35`: dashboard→"Document",
      brand→"Wireframe", content-engine→"Animation").
- [x] P2-i Fix `tests/smoke-mode-switching.spec.ts:88` heading assertion → "What should we create?".
- [x] P2-j Brand-fallback sweep in design views: `#e27c59` → `var(--accent-primary, #B08D6E)` style
      fallbacks; `#8b5cf6` → accent token; delete `_LEGACY_MARKETPLACE_UNUSED` purple entries
      (`design-registry.ts:72+`).
- [x] P2-k Tab-model fixes: 'system' activeTabId with no tab entry; unrenderable 'docs' tab type in
      DEFAULT_TABS; Sketch/Canvas label mismatch.
- [x] P2-l Label the Team tab mock honestly (e.g. "Preview — collaboration coming") per mapping row 15.

## Verification (all must pass before PR)

- [x] `cargo check -p allternit-api` clean (Rust route).
- [x] Typecheck clean in `surfaces/ai.allternit.com` (project script; note pre-existing
      `@ts-nocheck` files are out of scope — do not remove them in this session).
- [x] Unit test for the extended linter (new rules fire on fixture HTML; pass on clean fixture).
- [x] Manual smoke: modal URL tab against a real URL via the dev gateway (or curl the route
      directly against a running :8013 if available).

## Explicitly out of scope this session

Render-and-compare loop (P1.5), IndexedDB file versions, @ts-nocheck removal, click-to-target
surgical edit, structured critique criteria, desktop binary rebuild happens post-merge per ritual,
A:// Artifacts API (Phase 2 design task).

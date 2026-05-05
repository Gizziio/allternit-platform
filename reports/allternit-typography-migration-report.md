# Allternit Typography Migration Report

## Summary
- **Status:** PASS
- **Branch:** main
- **Commit:** 671738761038cf4797054f194cf4004d04add14f
- **Date:** 2026-05-05

## Files Added

### Canonical Design Law Files
- `/DESIGN.md`
- `/spec/design/typography.json`
- `/src/styles/typography.css`
- `/src/components/typography/Text.tsx`
- `/agent/rules/typography.md`
- `/agent/tasks/enforce_typography_system.md`
- `/scripts/validate-typography.py`
- `/.github/workflows/typography-validation.yml`

### Brand Assets
- `/public/brand/allternit/allternit-sans-reference-image.png`
- `/public/brand/allternit/allternit-sans-update.png`
- `/public/brand/allternit/allternit-sans.png`
- `/public/brand/gizzi/gizzi-mascot.svg`
- `/public/brand/gizzi/gizzi-mascot-transparent.png`
- `/public/brand/gizzi/gizzi-animation.gif`
- `/public/brand/matrix/matrix-logo.svg`
- `/public/brand/matrix/matrix-logo-transparent.png`
- `/src/components/brand/GizziMascot.tsx`
- `/src/components/brand/MatrixLogo.tsx`

### Reports
- `/reports/typography-inventory.md`
- `/reports/allternit-typography-migration-report.md`

## Files Modified

### Platform UI (Sans)
- `src/cli/commands/auth.ts` — Replaced `sans-serif` with Allternit Sans stack in OAuth callback HTML
- `src/cli/ui/tui/context/theme.ts` — Replaced `monospace` with Allternit Mono stack
- `.allternit/auth-app/app/layout.tsx` — Imported typography.css; added `text-body` class
- `.allternit/auth-app/app/terminal/clerk/page.tsx` — Replaced hardcoded `ui-sans-serif` with `var(--font-ui)`
- `.gizzi/src/runtime/brand/brand.ts` — Updated `fontFamily` and `fontFamilyMono` to Allternit stacks
- `.gizzi/src/runtime/brand/brand.js` — Updated compiled `fontFamily` and `fontFamilyMono` to Allternit stacks
- `.allternit/plugins/frontend/skills/impeccable/scripts/live-browser.js` — Updated `FONT` and `MONO` constants
- `.allternit/plugins/frontend/skills/design/scripts/cip/render-html.py` — Updated body font-family
- `.allternit/plugins/frontend/skills/design/references/slides-html-template.md` — Updated font fallbacks
- `.allternit/plugins/frontend/skills/design/references/social-photos-design.md` — Removed Google Fonts link; updated font-family
- `.allternit/plugins/frontend/skills/design/references/cip-style-guide.md` — Updated typography reference
- `.allternit/plugins/html-to-figma-opensource/extension/popup.html` — Updated font stack + visible branding
- `.allternit/plugins/html-to-figma-opensource/extension/background.js` — Updated font stack + visible branding
- `.allternit/plugins/html-to-figma-opensource/extension/content.js` — Updated font stack + visible branding
- `.allternit/plugins/html-to-figma-opensource/extension/manifest.json` — Updated extension name
- `.allternit/plugins/html-to-figma-opensource/mockups/*.html` (5 files) — Updated fonts + visible branding
- `.allternit/plugins/html-to-figma-opensource/src/automation/index.ts` — Updated visible labels
- `.allternit/plugins/html-to-figma-opensource/src/automation/workflows/deep-capture.ts` — Updated comments
- `.allternit/plugins/html-to-figma-opensource/src/automation/workflows/quick-capture.ts` — Updated visible text

### Documentation / Editorial
- `.allternit/plugins/html-to-figma-opensource/A2R_EXTENSION_SUMMARY.md` — Migrated visible text to Allternit
- `.allternit/plugins/html-to-figma-opensource/A2R_INTEGRATION_ARCHITECTURE.md` — Migrated visible text to Allternit
- `.allternit/plugins/html-to-figma-opensource/INTEGRATION_GUIDE.md` — Migrated visible text to Allternit

## Surfaces Migrated

### Platform UI
- Auth callback HTML pages (`src/cli/commands/auth.ts`)
- Terminal UI theme context (`src/cli/ui/tui/context/theme.ts`)
- Auth app shell (`.allternit/auth-app/`)
- Gizzi runtime brand typography (`.gizzi/src/runtime/brand/`)
- Live browser design tool script
- Slide/HTML template references
- Chrome extension popup, background, content scripts
- Extension mockups (5 HTML files)

### Research/Editorial
- Slide templates updated with Allternit Serif-ready CSS variables
- CIP style guide updated to reference Allternit Sans

### Agent/Protocol/Code
- Terminal UI default typography updated to Allternit Mono
- Code block / log rendering scripts updated
- Gizzi runtime `fontFamilyMono` updated

### Brand Assets
- All brand assets placed in `/public/brand/*`
- React components placed in `/src/components/brand/`

## Validation

```bash
python3 scripts/validate-typography.py
```

**Result:** PASS

## Remaining Exceptions

| File | Reason | Follow-up |
|---|---|---|
| `.allternit/auth-app/package.json` | Internal package name `a2r-auth-app` | Deferred — changing would break npm workspace resolution |
| `.allternit/auth-app/app/.well-known/gizzi/route.ts` | `A2R_TOKEN` env var name | Deferred — changing would break deployment config |
| `.allternit/auth-app/app/terminal/clerk/page.tsx` | `a2r_callback_url` sessionStorage key | Deferred — changing would break callback flow |
| `.allternit/plugins/html-to-figma-opensource/src/a2r/` | Directory and code symbols (`createA2RIntegration`, `A2RIntegration`, etc.) | Deferred — internal API identifiers; mass rename would break imports |
| `.allternit/plugins/html-to-figma-opensource/tests/__snapshots__/` | Test snapshot fixtures with `"fontFamily": "Arial"` | Test fixtures — not active code; updating would require regenerating snapshots |
| `.gizzi/package.json.original` | Legacy reference to `@a2r/plugin` | Legacy backup file; not active |

## Risks
- The `.allternit/auth-app/` is a separate Next.js workspace; typography.css was copied rather than symlinked. Keep both copies in sync if tokens change.
- `scripts/validate-typography.py` was minimally patched to skip TypeScript interface declarations (`fontFamily: string`) which are type annotations, not font usage. This is correct behavior.
- Several plugin skill markdown files still mention legacy font names inside data CSVs or historical design references. These are reference data, not active CSS.

## Next Steps
1. Update `.allternit/auth-app/package.json` name from `a2r-auth-app` to `allternit-auth-app` when workspace references are updated.
2. Regenerate test snapshots in `html-to-figma-opensource` after confirming font changes.
3. If Allternit Sans/Serif/Mono font files become available, add `@font-face` declarations to `src/styles/typography.css`.
4. Run the auth-app dev build to confirm Next.js can resolve the `typography.css` import.

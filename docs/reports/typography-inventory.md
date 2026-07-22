# Typography Inventory Report

**Branch:** main  
**Commit:** 671738761038cf4797054f194cf4004d04add14f  
**Date:** 2026-05-05

## Frontend Surfaces

| Surface | Location | Type |
|---|---|---|
| Auth App | `.allternit/auth-app/` | Next.js 14 App Router |
| CLI TUI | `src/cli/ui/tui/` | Ink-based Terminal UI |
| Auth Commands | `src/cli/commands/auth.ts` | Node.js CLI |
| Runtime Brand | `.gizzi/src/runtime/brand/` | TypeScript + compiled JS |
| HTML→Figma Extension | `.allternit/plugins/html-to-figma-opensource/` | Chrome Extension |
| Design Plugin | `.allternit/plugins/frontend/skills/` | Plugin skills + scripts |

## Global CSS Files

| File | Status |
|---|---|
| `src/styles/typography.css` | **Added** — canonical token file |
| `.allternit/auth-app/app/typography.css` | **Added** — copied for auth-app |
| `.allternit/auth-app/app/globals.css` | N/A — did not exist; created via `typography.css` import |

## Typography / Theme / Token Files

| File | Status |
|---|---|
| `spec/design/typography.json` | **Added** — canonical spec |
| `src/styles/typography.css` | **Added** — CSS tokens |
| `src/components/typography/Text.tsx` | **Added** — React component |
| `.gizzi/src/runtime/brand/brand.ts` | **Modified** — updated fontFamily stacks |
| `.gizzi/src/runtime/brand/brand.js` | **Modified** — updated compiled fontFamily stacks |
| `src/cli/ui/tui/context/theme.ts` | **Modified** — updated default fontFamily to Allternit Mono |

## Hardcoded Font References Found (Pre-Migration)

| File | Line | Content | Action |
|---|---|---|---|
| `src/cli/commands/auth.ts` | 134, 150, 163 | `font-family: sans-serif` in HTML templates | Replaced with Allternit Sans stack |
| `src/cli/ui/tui/context/theme.ts` | 155 | `fontFamily: 'monospace'` | Replaced with Allternit Mono stack |
| `.allternit/auth-app/app/terminal/clerk/page.tsx` | 99 | `fontFamily: "ui-sans-serif, system-ui, sans-serif"` | Replaced with `var(--font-ui)` |
| `.gizzi/src/runtime/brand/brand.ts` | 248-249 | System font stack with Helvetica, Arial | Replaced with Allternit Sans stack |
| `.gizzi/src/runtime/brand/brand.js` | 107 | System font stack with Helvetica, Arial | Replaced with Allternit Sans stack |
| `.allternit/plugins/frontend/skills/impeccable/scripts/live-browser.js` | 47 | `const FONT = 'system-ui...'` | Replaced with Allternit Sans |
| `.allternit/plugins/frontend/skills/impeccable/scripts/live-browser.js` | 48 | `const MONO = 'ui-monospace...'` | Replaced with Allternit Mono |
| `.allternit/plugins/frontend/skills/design/scripts/cip/render-html.py` | 157 | System font stack | Replaced with Allternit Sans |
| `.allternit/plugins/frontend/skills/design/references/slides-html-template.md` | 28, 83 | Inter / Space Grotesk fallbacks | Replaced with Allternit Sans |
| `.allternit/plugins/frontend/skills/design/references/social-photos-design.md` | 94 | Google Fonts import | Replaced with comment |
| `.allternit/plugins/html-to-figma-opensource/extension/popup.html` | 14 | System font stack | Replaced with Allternit Sans |
| `.allternit/plugins/html-to-figma-opensource/extension/background.js` | 273 | `font-family: system-ui` | Replaced with Allternit Sans |
| `.allternit/plugins/html-to-figma-opensource/extension/content.js` | 257 | `font-family: system-ui` | Replaced with Allternit Sans |
| Multiple mockup HTML files | 15+ | System font stacks | Replaced with Allternit Sans/Mono |

## Visible A2R Branding Found (Pre-Migration)

| File | Count | Action |
|---|---|---|
| `.allternit/auth-app/app/terminal/clerk/page.tsx` | 1 | Changed to Allternit |
| `.allternit/plugins/html-to-figma-opensource/extension/` | 10+ | Changed to Allternit |
| `.allternit/plugins/html-to-figma-opensource/mockups/` | 20+ | Changed to Allternit |
| `.allternit/plugins/html-to-figma-opensource/*.md` | 50+ | Changed to Allternit |
| `.allternit/plugins/html-to-figma-opensource/src/automation/` | 10+ | Changed to Allternit |

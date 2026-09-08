# Attestation — Office add-in task pane light-theme makeover

- **Session:** office-makeover (attested by 2391eb48, kimi-code)
- **Date:** 2026-09-08
- **Branch:** `session/office-makeover`, merged to main via **PR #128** → c9efe60e0
- **Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Full visual makeover of the Microsoft Office add-in task pane (`surfaces/allternit-extensions/allternit-office-addin`): from the ad-hoc dark look to a polished, Allternit-branded **light theme** on a warm paper canvas, with per-host accents (Word blue / Excel green / PowerPoint red) used sparingly.

Two root causes of the "dark themed" look, both fixed inside the add-in package:

1. Dark mode was forced on dark-OS users — `useSyncDarkClass` + a `prefers-color-scheme: dark` block flipped the whole pane to a dark sand theme.
2. Most utility classes never compiled — `styles.css` had no Tailwind v4 `@theme` mapping, so every bare shadcn utility (`bg-card`, `text-foreground`, `bg-muted/40`, `bg-destructive/10`, Button variants) was silently dropped from the CSS output (verified against `dist`). The shared `ExtensionSidepanelShell` lives outside the package directory so Tailwind's automatic source detection never scanned it — `@source` now registers it.

## How it works (file:line)

- **`src/taskpane/styles.css:15`** — rewritten as a light-only token system (`@theme inline` shadcn→Allternit bridge, warm paper canvas, sand neutrals, Allternit coral `#D97757`); `@source "../../../extension-shared/extension-sidepanel"` at styles.css:5 registers the shared shell; token-based component classes (`.btn`, `.field`, `.card`, `.chip`, `.notice`, `.shimmer`, `.status-dot`) and `--host-accent` helpers at styles.css:162–171.
- **`src/taskpane/App.tsx:248`** — per-host accent flows through the `--host-accent` custom property (replacing inline `style={{ background: accent }}`); package-local A://TERNIT pixel wordmark `components/AProtocolMark.tsx` (inline SVG, ported from the brand component) in the new header with a live status pill; shimmer skeleton for the *connecting* state; refined attached-document card, role card, outlined suggested-action tiles, token-based notices.
- **`OfficeConfigPanel` / `ToolApprovalOverlay` / `ErrorBoundary`** — inline styles and hardcoded colors replaced with tokens/shared classes; lucide `Check` icons instead of `✓` glyphs.
- **`index.html`** — `color-scheme: light`, pre-bundle canvas paint (no dark flash), `Allternit for Office` title.
- Screenshots (350×640 Playwright captures: word / excel / powerpoint / standalone / reconnect-error) committed under `docs/taskpane-makeover/`.

**Behavior unchanged:** `Office.onReady` gating, host detection via `?product=`, standalone "No Office host" mode, Connect Allternit flow (`displayDialogAsync` auth bridge + popup fallback), suggested actions → `steer-agent` postMessage, full AI chat (`ExtensionSidepanelShell`), markdown view panel, heartbeat binding sync, error boundary.

## Verification evidence (from PR #128 body)

- `pnpm --filter "@allternit/office" build` (manifest:generate + icons + `tsc --noEmit` + `vite build`) ✅
- `pnpm --filter "@allternit/office" test` — 143/143 ✅
- Screenshot-verified at standard 350px task-pane width for Word, Excel, PowerPoint, standalone, and reconnect-error states (`docs/taskpane-makeover/`).

## Incidents

- None blocking. The transient *connecting* shimmer resolves too quickly to capture outside a real Office host — compiled and structurally verified only.

## Honest deferrals

- The shared `ExtensionSidepanelShell` keeps its own inline shadcn HSL vars, now inert — chat always renders on the light sand canvas via the bridge. A deeper restyle of the shell itself is a separate change (outside this package).
- Dark mode is intentionally gone from the pane (matches the light Office ribbon and the brief).

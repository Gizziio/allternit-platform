# Session bbf3793b (follow-up) — footer rail: Allternit Office + Design in all modes (kimi-code)

**Date:** 2026-09-11 · **Agent:** kimi-code · **Branch:** `session/bbf3793b` · **PR:** #347 → merge `a302a94e3` (follow-up to PR #338 / `ab3f4eab4`)

## What was done

Owner follow-up to the ACI office extraction: the footer rail now shows **Allternit Office** (above) and **Design** (below) in **every** shell mode; the ACI-only conditional swap from #338 is gone.

- `ShellRail` footer: both buttons always rendered, office first. The Design button gained `title="Design"` and `data-testid="rail-open-design"` because its label is now the DESIGN wordmark (parallel wordmark-spelling session's work — the wordmark component itself was deliberately NOT touched here).
- `MoreDropdown`: reverted to plain Design in all modes; the `designLabel`/`designIcon` optional props (added in #338 solely for the ACI swap) removed.

## How it works

Same plumbing as #338 (`onOpenOfficeWindow` → `shell.openOfficeWindow` → `shell:open-office-window` → `/office` window); only the render condition changed from `mode === 'browser'` to unconditional, plus ordering (office button above design button).

## Verification evidence

- Platform `typecheck:fast`: zero errors in touched files (same pre-existing unrelated `office-*-app` package errors on main).
- Shell vitest: exit 0 (all pass).
- Playwright chromium `aci-extensions-view.spec.ts`: **4/4** — footer test asserts both entries visible with office-above-design ordering (`boundingBox().y` comparison) in Home AND ACI modes. Pinned chromium-1208 download still stalls on this machine; ran via scratch `executablePath` config at the cached chromium-1234 headless shell, deleted after the run.
- Renderer-only change; desktop main/preload untouched. Release preflight was 35/0 on #338 (same release path).

## Incidents / honest deferrals

- None new. Same environmental note as #338's attestation for the Playwright browser workaround.
- Wordmark spelling/misspelling fixes are explicitly owned by another active session; this session added only button-level `title`/`testid`.

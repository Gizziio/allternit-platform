# pane-header — session/pane-header (agent-22, kimi-code)

**Date:** 2026-09-09 ~10:40–10:55 · **PR:** #212 → merge SHA `7ab90c540` · Branch `session/pane-header` (deleted after merge)

## What was done

Owner-reported follow-up to #211 (screenshot saved at `~/Desktop/allternit-workspace/user-shot-pane-header.png`): the agent pane showed "Allternit Office Agent" twice stacked — row 1 was the `OfficeAiSlot` tab strip (brand + name), row 2 the panel header (brand + name + Platform model dropdown + refresh + close), row 3 the context banner.

Fix — one shared change in `@allternit/allternit-office-suite` (covers docs/sheets/slides/pdf, no app forks):

- `src/extensions/OfficeAiSlot.tsx`: the `.office-ext-tabs` tab strip is removed entirely, along with the saved-tab localStorage machinery (with no switcher the first registered extension is the active pane; additional panes stay mounted+hidden exactly as before). The collapsed branded expand rail from #211 is untouched.
- `src/extensions/OfficeAiSlot.css`: dead tab-strip rules removed.

The functional controls the owner listed (Platform model dropdown, new-chat refresh, close X) already live in the `AllternitAssistantPanel` header row, so nothing moved — only the duplicated strip row went away. Result: ONE white header row (brand + name left; model picker / new-chat / close right), context banner below. Verified with an after-screenshot of the `/docs` pane.

## Verification evidence

- `pnpm run typecheck` clean: `@allternit/office-suite`, `office-docs-app`, `office-sheets-app`, `office-slides-app`, `office-pdf-app`, platform `tsc --noEmit`.
- suite vitest: 13/13.
- Playwright (chromium via `chromium-1234`, private dev server on 3013, mocked `/api/agent-chat` SSE): **11/11** — `office-agent.spec.ts` 2/2 with updated assertions (zero `.office-ext-tab`; exactly one exact "Allternit Office Agent" text inside `.ai-dock`; brand svg in `.aos-assistant-title`; `.aos-assistant-model-picker-trigger` and the Close-panel button visible in the header row; Summarize wiring spec unchanged and green), `office-ai.spec.ts` 4/4 (docs/sheets/slides/pdf agent composers still stream; the docs spec still expands via the #211 `.office-ext-rail`), `office-launcher.spec.ts` 5/5 incl. the `/office` redirect.

## Incidents

- None. Merge landed without conflicts; no checkpoint collision this time.

## Honest deferrals

- Desktop Electron e2e not run (owner's app holds the single-instance lock). The change only removes one DOM row from shared suite code; risk on desktop is negligible but unverified there.
- If a host ever registers a SECOND extension, there is now no UI to switch panes (first wins, others stay mounted hidden). The suite today registers only the Allternit Office Agent; restoring a switcher would be deliberate future work.

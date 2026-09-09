# Steering checkpoint

**Goal:** Rebuild the Create Bot wizard (session/create-bot-wizard, 2026-09-09): Allternit-branded, 4-step click-through with a live Bot Hub card preview rail, real gating, single real template catalog (`BOT_TEMPLATES`), visible desktop provisioning, and an optional describe-to-prefill accelerator. Approved plan: `.steering/plan-create-bot-wizard.md`.

**Just did:** Milestones 1–4 implemented in `surfaces/ai.allternit.com/src/views/agent-view/components/create-bot/`: 4-step wizard shell (left rail / center / live BotHubCard preview rail), Start step from real `BOT_TEMPLATES` (inline START_TEMPLATES deleted), Identity (incl. 5 lifted avatar modes) + Job steps, Computer & Runtime step (presets, brain/model/provider, advanced voice), real gating via `validateAgentCreationChecklist` on the exact submit payload, visible provisioning state polling `/api/v1/computers?bot_id=…` with 60s cap + inline retry. `CreateBotForm.tsx` is now a thin wrapper; all 5 call sites untouched. Verified: `typecheck:fast` = exactly the 15 pre-existing office-app/UnifiedTerminal errors; `vitest run src/lib/bots` 431/432 (1 pre-existing vm-operator snapshot failure, confirmed on clean HEAD); new `create-bot/__tests__` 17/17 pass. Local commit `feat(create-bot)` on `session/create-bot-wizard` (not pushed).

**Next:** Milestone 5 (describeBot accelerator + refine helper + its tests), then 6 (polish), PR + ledger per session ritual.

**Open questions:** None — plan approved by owner.

---

<!-- prior checkpoint below -->

# Checkpoint — session/pdf-surface

Goal: Make the Allternit PDF surface earn its place — agent can read the open
PDF (activeDocument registry content like docs, cap 8000), working AI presets
via the assistantPreset bus, hub card improvements (Recent PDFs from artifacts
— PDFs ARE persisted via Sign + pdf-viewer/binary), report viewer gaps.

Just did: implementation complete. Vendored pdf app reports {name, extracted
text} to the registry (reuses buildSearchIndex, cached per doc, invalidated on
file change), ribbon Summarize/Key-points presets via assistantPreset bus
(disabled until text extraction completes), suite panel gives pdf an 8000-char
context cap (docs stays 4000) + 3 new vitest cases, hub pdf card copy + Recent
PDFs strip (client-side artifact filter, opens via shell view or /pdf/:id),
PdfView now also decodes Sign-style `kind: 'pdf'` data-url sections, platform
e2e: new office-agent pdf test (banner, POST body contains extracted text,
preset posts with context) + pdf-artifact data-url test.

Next: pnpm install (background), then typecheck suite+pdf app+platform,
suite vitest, playwright smoke (chromium-1234 recipe, port 3013), PR, ledger,
cleanup.

Open questions: none. Gaps to note in PR: viewer HAS thumbnails + full-text
search; missing: AI context not refreshed after in-session page delete/reorder
until reload; search index built lazily (first search on huge docs pays the
full pass); no persisted recent-files in the standalone/desktop shell.

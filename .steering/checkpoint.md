# Steering checkpoint

**Goal:** Rebuild the Create Bot wizard (session/create-bot-wizard, 2026-09-09): Allternit-branded, 4-step click-through with a live Bot Hub card preview rail, real gating, single real template catalog (`BOT_TEMPLATES`), visible desktop provisioning, and an optional describe-to-prefill accelerator. Approved plan: `.steering/plan-create-bot-wizard.md`.

**Just did:** Milestone 5 + polish committed as `5e5a3e20b`: `describeBot.ts` (one call on the platform's existing `/api/chat/completions` route — playground request shape, `getDefaultAgentModel().id`, forced JSON + defensive validation; null on any failure incl. 20s abort), Start-step "Describe the bot you want" prefill box (suggested template defaults underneath, blank card otherwise, silent fallback), Job-step "Refine from my description" (same call, replaces systemPrompt on success). Polish: identity auto-focus, Esc-closes-only-when-idle, copy Register 1 sweep. Verified: typecheck:fast = exactly the 15 pre-existing errors; vitest src/lib/bots 431/432 (same 1 pre-existing vm-operator failure); create-bot tests 29/29 (12 new). Two commits on `session/create-bot-wizard`, not pushed.

**Next:** PR + merge + ledger attestation per session ritual (owner drives merge); milestones 1–6 all landed.

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

# Consumer-Packaged Cowork P3 — Finished deliverables live evidence (2026-09-14)

## 3.1 artifact pipeline: chat → agentic worker → office-engine → finished .docx → preview/export

- Chat turn: POST /cowork/al/chat/stream `{message: "write a summary report"}` →
  delegation frame (intent al_…, run ff42bf76-154a-4b5f-987e-cd52b357c71b,
  target a://workspace/default/principal/gizzi-p3) → narration → run_state.
- Agentic worker (gizzi-code fabric worker, managed spawn shape) claimed the
  job and called the `deliverable` tool (report template, markdown body).
- Worker log: `{"event":"worker.deliverable_attached","run_id":"ff42bf76…","file":"weekly-summary.docx"}`
  → `{"event":"worker.agentic_step","step":1,"tool":"deliverable","ok":true}`.
- Registry (GET /api/v1/cowork/runs/ff42bf76…/deliverables):
  `weekly-summary.docx`, template report, 3636 bytes, actor recorded,
  attributed `deliverable.created` run event.
- Preview: GET …/deliverables/weekly-summary.docx → 200,
  content-type application/vnd…wordprocessingml.document, 3636 bytes.
- unzip -p … word/document.xml contains "Weekly Summary", "Fabric worker
  shipped", and a real `<w:tbl>` (the markdown table rendered).
- Export: GET …?download=1 → `content-disposition: attachment;
  filename="weekly-summary.docx"`.

(The model endpoint was a scripted mock proxy — every other hop is real:
api, canonical store, office-engine render, worker claim/complete, SSE.)

## Authorization matrix (packaged auth path, no dev bypass)

- same-workspace worker bearer: write 200, read 200.
- other-workspace worker bearer: write 403, read 403.
- garbage atok_ bearer: 403 (after fix; was 500).
- Requires the auth-middleware fix: `atok_` principal tokens pass through to
  the fabric routes' own authentication (previously rejected as "Invalid
  token" before reaching any route — a latent P1 production bug: the managed
  worker could never claim in a packaged non-bypass deployment).

## Generator unit tests (services/office-engine)

- `tests/deliverable-generators.test.ts` 4/4: markdown parse, docx content,
  xlsx rows, pptx slides.

## Live bug found + fixed during the demo

- Worker deliverable call 501'd: the worker `api()` helper already prefixes
  `/api/v1` — path corrected from `/api/v1/cowork/…` to `/cowork/…`.

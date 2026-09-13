# Checkpoint — session/cu22-realmodel

**Goal:** D3 — real-model (frontier vision) end-to-end validation campaign for batch dispatch (spec deferral from stagehand-batch-fork).

**Just did:** Worktree `allternit-cu22` created on `session/cu22-realmodel` from origin/main (a0e615fd4, includes cu21 adversarial recall). Plan written to `.steering/plan-cu22.md`.

**Next:** Find prior tmp-*-smoke scripts + read batch_dispatch.py / planning_loop.py / vision_providers.py / gateway model config to plan the real-model smoke.

**Open questions:**
- Does the local gateway have a working provider key for a frontier vision model? (A decides; stop if none.)
- Which model id does model-routing.json / the gateway serve for vision tasks?

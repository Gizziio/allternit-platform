# Session cu6-pyfix — gateway contract fixes (post-audit bugs 1-3)
- Branch session/cu6-pyfix → PR #152 → merge 9118b7f9f
- Fixed HIGH: mode='direct' now a real execution path (ExecuteBody.task optional, actions[] validated, per-action results + screenshot artifact via adapter layer) — was 422 on every TS engine-adapter call. MEDIUM: ActionRecorder.load() preserves gif_path; /record append feeds GIF buffer. LOW: machine-readable approval.required/approval.resolved SSE events for replay-deviation and planning-loop pauses.
- Also fixed pre-existing test landmine: outer domains/computer-use/core/__init__.py re-bound `core` in sys.modules between test files (order-dependent monkeypatching).
- Verified: pytest 123 passed +17 new; live smoke :8981 direct-mode 2/2 actions through browser.cdp with real PNG artifact, 422 paths confirmed for malformed bodies.

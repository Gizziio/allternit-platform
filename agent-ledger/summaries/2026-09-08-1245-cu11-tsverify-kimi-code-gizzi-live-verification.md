# Session cu11-tsverify — gizzi adapter live-proven + error surfacing + integration proof
- Branch session/cu11-tsverify → PR #160 → merge 77c961821
- Gizzi engine adapter RUNTIME-VERIFIED against real gateway: script/verify-engine-adapter-live.ts, 12/12 checks reproduced twice (browser.cdp, real Chrome tab). Fixed 4 live bugs in engine/executor.ts: silent-failure detection (gateway counts failed envelopes as ok — defended client-side, flagged to gateway owners), Claude-native vocabulary mapping (click/hover/drag → left_click etc.), screenshot via run artifacts (was hitting 404 /v1/vision/screenshot), honest notSupported for hover/mouse-phases/key-hold.
- Packaging: sdk/computer-use dist CJS→ESM + exports map (root cause of 'never runtime-verified': unloadable outside bundler); jest.config.cjs.
- sdk/allternit-sdk: no more fake success — in-band failed/error/non-completed statuses surfaced with code+message+partial state; HTTP errors carry status+body. 6 new tests.
- chrome-stream: from-recording response validated against protocol-package zod schemas (BrowserWorkflowSpecSchema etc.) — integration contract proof. 4 new tests (53 total).
- Verified: jest 110/110, vitest 53 pass, typecheck clean. Pre-existing sdk/allternit-sdk 11 bun-test failures byte-identical to main.

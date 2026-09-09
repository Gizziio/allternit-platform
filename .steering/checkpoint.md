# Checkpoint — cu11-tsverify (final)

## Goal
1. Live-verify gizzi engine adapter vs real Python gateway ✅ (12/12, transcript /tmp/cu11-live-final.txt)
2. Stop swallowing executor errors in sdk/allternit-sdk capability ✅ (strict status/error checks, 6 new tests)
3. Chrome-stream from-recording integration proof vs protocol zod schema ✅ (4 new tests)
+ Found & fixed: SDK dist was CJS while deps ESM-only → dist unloadable outside bundlers (flipped sdk/computer-use to ESM; 110 jest green); gateway has no /vision/screenshot → adapter screenshot() now uses direct screenshot action + artifacts.

## Just did
- All stages verified: sdk/computer-use jest 110/110; sdk/allternit-sdk bun test 248 run (11 fail = same pre-existing as main, 6 new pass); chrome-stream vitest 53 pass (49+4), tsc clean; gizzi-code bun run typecheck clean; live 12/12 twice (fresh gateway).
- Gateway killed? NO — still running on :8986 (task bash-b1fhdtk4); Chrome tab https://example.com left open. Kill before session end.
- Deleted stray build artifacts in packages/*/src (created by an intermediate build attempt); reverted pnpm-lock churn.

## Next
- 4 stage commits + push + PR. Leave merge to orchestrator.

## Open questions
- None.

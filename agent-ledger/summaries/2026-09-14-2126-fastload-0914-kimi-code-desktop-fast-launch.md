# Session attestation — fastload-0914 — desktop fast launch + splash option A

- **Session:** `session/fastload-0914` (kimi-code), DAG `dag_492447`
- **PR:** #533, merge `b9b139fa4` into main
- **Date:** 2026-09-14 21:26

## What was done

Owner report: desktop cold launch took ~26s and the startup screen's service
tabs/loading bar read as debug UI. Root-caused from real launch logs
(`~/Library/Application Support/@allternit/desktop/main.log`, 2026-09-14
15:16 and 18:58 launches), then fixed in `surfaces/allternit-desktop`:

1. **Parallel bring-up** (`unified-main.ts`) — gizzi, office engine,
   computer-use driver, ACU gateway, and local engine now start concurrently
   after the connector sidecar; the API spawn waits only for connector +
   gizzi. Previously strictly serial (~26s); expected cold start <8s.
2. **ECONNREFUSED fast-path** (`local-engine-manager.ts`, `gizzi-manager.ts`) —
   reuse probes short-circuit on a refused connection and spawn immediately
   instead of paying the full 20s/30s patient poll against a dead port
   (measured 20.8s of a 26.3s boot was this one wait).
3. **Fail-fast readiness** (`backend-manager.ts`, `local-engine-manager.ts`,
   `gizzi-manager.ts`) — post-spawn health polls race the child process exit;
   a boot crash fails in <2s with exit code + last 5 stderr lines instead of
   burning the full 90s/30s/20s timeout first. Slow-but-alive keeps the
   generous ceiling (API cold starts can edge past 30s).
4. **Non-blocking folder grants** (`unified-main.ts`) — the main window loads
   underneath the splash; the grant prompt rides the splash with a 15s
   force-close bound. The old gate blocked launch for 2h29m in the owner's
   log while the backend had been ready in 26s.
5. **Splash option A** (`startup-window.ts`) — matrix glyph + serif wordmark
   replaced with the ink A://TERNIT wordmark (canonical source
   `ai.allternit.com/public/brand/a-protocol/a-ternit-wordmark.svg`); loading
   step is now wordmark + thin coral progress bar + percent + one status
   line; per-service status moved behind a bottom "Details" toggle. IPC
   contract with preload/unified-main unchanged.
6. Fixed sleeps dropped: 1s gizzi catch sleep, 400ms pre-close sleep
   (now a 150ms paint beat tied to dismissal logic).

## Verification evidence

- `npm run typecheck` (desktop main+preload): clean.
- `npm run test`: 147/147 vitest green, including two new fail-fast
  regression tests in `backend-manager.test.ts` (child-exit rejection <2s;
  exit listener removed on health success).
- `node scripts/release-preflight.mjs`: 39/0 (was 36 checks; grew on main).
- Splash markup reviewed line-by-line against owner-approved mockups
  (option A). No live render of the new splash was performed (owner:
  no stub code); first live surface is the rebuilt DMG.

## Incidents / notes

- Shared checkout was on `chore/remove-vercel` (another session's in-flight
  branch) at merge time, so main sync + attestation + rebuild were done from
  the session worktree fast-forwarded to `origin/main`, per worktree
  ownership rules.
- DAG node status flip to DONE could not be recorded: the debug
  `allternit-commrails` binary was cleaned from `target/` by another
  session. Node statuses remain READY in dag_492447.
- Unrelated `pnpm-lock.yaml` churn (jest peer-dep resolution drift from an
  install in the worktree) was reverted before committing.

## Honest deferrals

- Live end-to-end launch timing on a packaged build — to be measured on the
  DMG rebuilt per ritual step 8.
- DMG rebuild was in progress at attestation time.

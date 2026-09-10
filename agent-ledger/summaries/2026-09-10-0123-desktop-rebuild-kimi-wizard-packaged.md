# Attestation — desktop binary rebuild from current main (owner request)

- **Date:** 2026-09-10
- **Session:** interactive Kimi Code session (owner: Eoj); no session branch — build ran in the shared main checkout
- **Trigger:** owner asked why the Create Bot wizard rebuild (PR #221) was not in the
  packaged desktop app; this rebuild packages it
- **Built from:** `main` @ `95b0057ff` (includes PR #221 `cd6e5cbd6` wizard rebuild,
  PR #217 bot-hub cleanup, shell-rail cleanup, embed-route fixes, cloud-computer p5)

## What was done

1. Ran the full `npm run build:electron` in `surfaces/allternit-desktop` from the shared
   main checkout: `config:company` → 11 prepare steps (platform static, office add-ins,
   cua-driver, acu-gateway, lima, mesh-node, office-engine, api-binary, connector
   catalog) → main/preload/auth-renderer tsc builds → `verify:packaged-resources` (all
   green, 1065 connector providers) → electron-builder 26.15.3.
2. Outputs: `release/Allternit-Desktop-1.1.1-arm64.{dmg,zip}` +
   `release/Allternit-Desktop-1.1.1-x64.{dmg,zip}` (unsigned/unnotarized, no APPLE_*
   creds — same deferral as relfix6 session). Fresh `release/mac-arm64/Allternit Desktop.app`.
3. **Verified the wizard is actually in the bundle:** grepped the packaged app for the
   wizard-unique string "Describe the bot you want" → present in
   `Contents/Resources/platform/assets/CreateBotForm-DTSbDQRI.js`.
4. Launched the app for the owner (`open`, PID 46370); API + vite dev server (:8013 /
   :3013) left running in the session for comparison.

## Ritual deviation + cleanup

- Deviation: this was a "run it for me" build task, not a repo change — no session
  worktree/plan file was created (nothing to merge). The shared checkout is restored to
  clean: `config:company:write` and `prepare:office-addins` regeneration drift
  (`resources/company.json` losing `cloudApiUrl`, 4 office manifest URL rewrites) was
  reverted with `git restore` — build tooling idempotency drift, not source work. If the
  committed company.json/manifests are stale relative to the generators, that is a
  separate deliberate commit for whichever session owns the generator.
- Untracked `surfaces/allternit-desktop/resources/computer-use/{acu,darwin,linux,win32}/`
  remain: outputs of `prepare:cua-driver`, also present in the preview worktree; left for
  future builds (deleting only forces re-download).

## Honest deferrals

- App is unsigned/unnotarized (Gatekeeper-blocked for anyone but this machine).
- No e2e/Playwright pass against the packaged app this run; evidence is
  verify-packaged-resources + in-bundle wizard string check + the wizard's own 29 unit
  tests and green production vite build from PR #221.

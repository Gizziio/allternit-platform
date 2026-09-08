# Steering checkpoint — session/kimi-default

## Goal
Owner directive: "you are using the wrong model, use kimi cli". Change the
Office add-in's last-resort DEFAULT_OFFICE_MODEL from 'claude-3-5-sonnet'
(400s on this deployment) to 'kimi-for-coding' (gizzi kimi-cli provider,
shell-verified end-to-end: mint ak- key → chat completions → 200 real reply).
Catalog auto-resolution from PR #145 still wins when the gateway serves
/v1/models to ak- keys.

## Just did
- Worktree `allternit-session-kimi-default` on `session/kimi-default` from origin/main (d6bde7b97).
- agent-defaults.ts: DEFAULT_OFFICE_MODEL = 'kimi-for-coding' + new LEGACY_OFFICE_MODEL
  ('claude-3-5-sonnet') so the resolveRuntimeConfig unset-sentinel keeps treating old stored
  configs as unset (otherwise they'd flip to "explicit" and still 400).
- useOfficeAgent.ts: sentinel checks both constants.
- useOfficeAgent.test.ts: legacy test uses LEGACY_OFFICE_MODEL; new test for stored-value-equals-current-default.
- README.md configuration section updated.

## Next
- pnpm install (running), then typecheck / npm test / build, commit, push, PR
  `feat(office-addin): default chat model to Kimi (kimi-for-coding)`, --merge, ledger, cleanup.

## Open questions
- None.

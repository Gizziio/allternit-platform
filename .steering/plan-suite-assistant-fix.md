# Plan — suite-assistant-fix

Session: `suite-assistant-fix` — branch `session/suite-assistant-fix` from origin/main (dda3f93c3)

## Todos

- [ ] Scope bug 1: trace `runtimeModelId` composition from office-suite client through `/api/agent-chat` to gizzi; identify double-prefix site
- [ ] Fix bug 1: normalize model id (if starts with `<provider>/`, don't re-prepend) at the right layer(s)
- [ ] Regression test for bug 1
- [ ] Scope bug 2: trace document-context source in Assistant tab (OfficeAiSlot / activeDocument.ts); find why open doc isn't seen
- [ ] Fix bug 2: active document flows into assistant context
- [ ] Regression test for bug 2 (if suite has test setup)
- [ ] Typecheck + existing tests for touched packages
- [ ] Build affected bundle if feasible; assess live re-run via CDP 9224 (or defer honestly to session/desktop-package)
- [ ] Commit, push, PR, `gh pr merge --merge`, record PR + SHA
- [ ] Sync main in shared checkout, ledger attestation + LEDGER.md entry (STEER_GUARD_OFF=1)
- [ ] Cleanup: worktree remove, branch delete local+remote, final status

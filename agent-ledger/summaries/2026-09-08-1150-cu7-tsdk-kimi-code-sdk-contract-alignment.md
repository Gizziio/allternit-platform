# Session cu7-tsdk — sdk/computer-use contract alignment (post-audit bug 4)
- Branch session/cu7-tsdk → PR #154 → merge 958defdd9
- ExecuteResponse redefined to match shipped gateway envelope (plain-string error adapted to EngineError); getRunEvents route fixed to /computer-use/runs/{id}/events; EventStream parses real {event_type,run_id,message,data} envelope; waitForApproval works on approval.required; dead pause/resume/getPendingApproval marked @deprecated.
- Verified: pnpm test 110 passed (+12 new incl. envelope + approval stream tests), tsc clean. Contract cross-checked verbatim against PR #152's gateway code.

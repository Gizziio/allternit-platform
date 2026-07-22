# Canonical permission policy scenarios

This table is the behavioral contract for `PermissionNext.evaluatePolicy`. Rules within one
configured ruleset remain last-match-wins; the rows below define precedence across independently
owned policies.

| Order | Scenario | Expected | Reason |
|---:|---|---|---|
| 1 | Explicit host skip or `bypassPermissions` | allow | The caller deliberately bypassed the policy engine. |
| 2 | Plan mode, non-read operation | deny | A read-only session cannot be escalated by a later approval. |
| 3 | Matching configured deny plus any approval/mode | deny | A durable owner policy outranks convenience modes and remembered consent. |
| 4 | Auto mode asks a question | deny | An unattended run cannot block waiting for interaction. |
| 5 | Auto mode performs other non-denied work | allow | Auto is explicitly unattended; configured denial was already checked. |
| 6 | Matching remembered project/session approval | allow | Prior consent resolves a configured/fallback ask, but never a deny. |
| 7 | Matching configured ask/allow | configured result | User/project rules decide before mode conveniences. |
| 8 | YOLO plus only the built-in wildcard fallback ask | allow | YOLO removes generic friction while retaining sensitive and user-authored asks. |
| 9 | Plan mode read | allow | Read operations remain available. |
| 10 | `acceptEdits` read or workspace edit | allow | The mode permits reviewed workspace manipulation, not arbitrary shell access. |
| 11 | `dontAsk` unresolved operation | deny | Non-interactive execution never interprets silence as consent. |
| 12 | No matching rule or mode | ask | Default behavior requires explicit user resolution. |

Sensitive examples that remain `ask` in YOLO include `.env*`, private keys, credential files, and
`.git/*`. Public keys and explicit example/sample/template environment files are exempted by later,
specific default rules. Auto remains subject to explicit configured denial, including these paths.

Session permission mode is persisted in `session.permission_mode`; restarting the daemon must not
silently change the active safety contract. An `always` response re-evaluates sibling pending
requests with both their original configured rules and the session's durable mode.

# Consumer-Packaged Cowork P1 — Managed Runtime live evidence (2026-09-14T10:46:53Z)
API: http://127.0.0.1:18013 (scratch data dir, ALLTERNIT_DESKTOP_ACCESS_TOKEN set at spawn)

## 1.1 — local-only ensure route (desktop access-token gated)
- POST ensure WITHOUT token → {"error":"local desktop auth required to provision the worker principal","code":403}
- POST ensure with WRONG token → {"error":"local desktop auth required to provision the worker principal","code":403}
- POST ensure WITH token → principal + once-only token (withheld)
  principal_id=a://workspace/default/principal/gizzi token_len=41
- second ensure ROTATES (old token must die):
  new_token_len=41 rotated=yes
- claim with OLD token → refused: {"error":"A_AUTHENTICATION_FAILED: bearer token does not map to any principal","code":401}

## 1.4 — folder grants via /cowork-preferences (desktop local auth)
- GET preferences (fresh profile): {"trusted_folders":[],"global_instructions":"","updated_at":"2026-09-14T10:46:54.267257+00:00"}
- PUT trusted_folders: {"trusted_folders":["/tmp/coworkp1-evidence/granted"],"global_instructions":"","updated_at":"2026-09-14 10:46:54"}
- GET after: {"trusted_folders":["/tmp/coworkp1-evidence/granted"],"global_instructions":"","updated_at":"2026-09-14 10:46:54"}

## worker claim loop with the provisioned token (managed spawn shape)
- worker log (structured JSON):
    {"ts":"2026-09-14T10:46:54.439Z","level":"info","event":"worker.daemon_start","compute_mode":"local"}
    {"ts":"2026-09-14T10:47:00.365Z","level":"info","event":"worker.shutdown_requested","signal":"SIGTERM"}
- daemon_start observed: yes
- SIGTERM graceful stop observed: yes


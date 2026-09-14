# P2 — Chat drives A:// live evidence (2026-09-14T11:54:08Z)

## setup: delegation rule + trusted folders + worker credential
- rule: {"action_type":"organize","priority":10,"target_principal":"principal/gizzi-daemon-1","workspace":"default"}
- worker principal provisioned (token withheld)
- trusted_folders: {"trusted_folders":["/tmp/p2-demo/granted"],"global_instructions":"","updated_at":"2026-09-14 11:54:08"}

## 2.1 — SSE chat stream: message → intent → delegation → narration
- stream opened; first frames:
    data: {"action_type":"organize","description":"organize this folder","intent_id":"al_15204652-535e-4096-86da-a6f4320b0aed","run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","target":"a://workspace/default/principal/gizzi-daemon-1","type":"delegation"}
    data: {"delta":{"text":"Delegated to a://workspace/default/principal/gizzi-daemon-1 (run 95b0469a-e62c-45da-a1b5-d6260952391c).","type":"text_delta"},"type":"content_block_delta"}
    data: {"run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","state":"queued","type":"run_state"}

## 2.2/2.3 — agentic worker claims, writes ONLY inside grants; killed mid-run; recovers
- worker claimed; model call in flight (3s); KILLING worker mid-run (pid 29127)
- canonical job state right after kill: leased (still active; sweeper must requeue)
- waiting for lease expiry + sweeper requeue…
- canonical job state after sweeper: queued|1 (requeued for recovery)
- restarting worker (fresh process; replay against the SAME run)
- worker log:
    {"ts":"2026-09-14T11:54:11.076Z","level":"info","event":"worker.daemon_start","compute_mode":"local"}
    {"ts":"2026-09-14T11:54:11.115Z","level":"info","event":"worker.claimed","job_id":"c85bb1e9-781b-46cf-abcc-28217840700b","lease_generation":1}
    {"ts":"2026-09-14T11:54:36.145Z","level":"info","event":"worker.daemon_start","compute_mode":"local"}
    {"ts":"2026-09-14T11:54:36.180Z","level":"info","event":"worker.claimed","job_id":"c85bb1e9-781b-46cf-abcc-28217840700b","lease_generation":2}
    {"ts":"2026-09-14T11:54:39.183Z","level":"info","event":"worker.agentic_step","step":1,"tool":"fs_write","ok":true}
    {"ts":"2026-09-14T11:54:48.078Z","level":"info","event":"worker.shutdown_requested","signal":"SIGTERM"}

## artifacts confinement proof
- granted dir: organized.txt 
- /tmp/p2-demo outside grants: api.log data run.sh (no agent-written files expected)
- files written OUTSIDE grants: 0 (must be 0)

## SSE stream result frames
- tail frames:
    data: {"run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","state":"queued","type":"run_state"}
    data: {"run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","state":"running","type":"run_state"}
    data: {"run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","state":"completed","type":"run_state"}
    data: {"result":{"completed_at":"2026-09-14T11:54:42.244382+00:00","executor":"principal/gizzi-daemon-1","job_id":"c85bb1e9-781b-46cf-abcc-28217840700b","outputs":{"agentic":true,"artifacts":["/tmp/p2-demo/granted/organized.txt"],"steps":2,"tokens":21,"worker":"a://principal/gizzi"},"result_id":"result_c0183e9e-7b04-4a6d-bfa3-b0ac32d9e55f","run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","status":"completed","summary":"Done — wrote organized.txt inside the granted folder and nothing outside it."},"run_id":"95b0469a-e62c-45da-a1b5-d6260952391c","state":"completed","type":"result"}
    data: {"delta":{"text":"Done: Done — wrote organized.txt inside the granted folder and nothing outside it.","type":"text_delta"},"type":"content_block_delta"}
    data: {"metadata":{"status":"completed"},"status":"completed","type":"finish"}


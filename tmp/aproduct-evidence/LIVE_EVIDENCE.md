# A:// Product-Depth Live Evidence — session/aproduct-0913 (2026-09-13T23:20:02Z)
API: http://127.0.0.1:18013 (dev port 18013, scratch data dir, ALLTERNIT_BROKER_FILES_ROOT=/tmp/aproduct-evidence/filesroot)

## P-T2 — non-local compute placement
- create VM-capable principal: {"id":"principal/gizzi-vm-1","workspace":"a://workspace/evidence","capabilities":["compute.vm"],"token":"<withheld>"}
- create local-only principal: {"id":"principal/gizzi-local-1","workspace":"a://workspace/evidence","capabilities":["compute.local"],"token":"<withheld>"}
- submit intent compute=vm: {"intent_id":"intent-evidence-vm-1","run_id":"2f60af9f-7104-4af3-9520-ad04b492c333","created":true}
- canonical job (fabric transport view): {"delegator":null,"initiator":"a://principal/evidence-user","job_id":"8ffc36e3-e468-40b4-979e-79b1efd23082","lease_expires_at":null,"lease_generation":0,"lease_id":null,"lease_owner":null,"max_retries":3,"payload":{"steps":[{"command":"echo vm-ok"}]},"result":null,"retry_count":0,"run_id":"2f60af9f-7104-4af3-9520-ad04b492c333","state":"queued"}
- local-only worker claims vm job → REFUSED: {"error":"A_CAPABILITY_MISSING: principal principal/gizzi-local-1 lacks required capabilities: compute.vm","code":422}
- vm-capable worker claims vm job → GRANTED lease lease_0f1f3a25-d1aa-4ad6-8ff0-10e8ddacfc52 (generation 1)

## P-T4 — connector breadth (files/local through the broker)
- files.read session: {"capability":"connector.files.read","expires_at":"2026-09-13T23:22:02.983920+00:00","session_id":"cs_fce767ce-dcda-4035-828a-7131b8dd2dae"}
- files.read invoke note.txt: {"capability":"connector.files.read","delivered":true,"detail":"read 27 bytes","session_id":"cs_fce767ce-dcda-4035-828a-7131b8dd2dae","simulated":false}
- files.write session WITHOUT approval → GATED: {"error":"A_APPROVAL_REQUIRED: no approval on file for connector.files.write/* on job 8ffc36e3-e468-40b4-979e-79b1efd23082","code":403}
- worker requests approval: status=pending id=appr_aa93d8a3-1185-4e74-9a7b-b404401d0cf7
- human grants: status=granted
- files.write invoke out/result.txt: {"capability":"connector.files.write","delivered":true,"detail":"wrote 27 bytes","session_id":"cs_161efa0d-18c2-4c09-ae5c-03f41f5cf5d7","simulated":false}
- on-disk proof: written via files connector
- path escape attempt → REFUSED: {"capability":"connector.files.read","delivered":false,"detail":"path escapes connector root","session_id":"cs_fce767ce-dcda-4035-828a-7131b8dd2dae","simulated":false}

## P-T1 — consolidation boundary (leased-job projection refusal)
- POST /cowork/runs/2f60af9f-7104-4af3-9520-ad04b492c333/jobs/8ffc36e3-e468-40b4-979e-79b1efd23082/state on a leased job → {"ok":true,"projection_applied":false}
- canonical complete via fabric transport: {"outcome":"committed","job_state":"completed","result":{"completed_at":"2026-09-13T23:20:03.678685+00:00","executor":"principal/gizzi-vm-1","job_id":"8ffc36e3-e468-40b4-979e-79b1efd23082","outputs":{},"result_id":"result_20653cc8-9b72-41c6-8272-662691be472c","run_id":"2f60af9f-7104-4af3-9520-ad04b4
- projection write after terminal transition applied: {"ok":true,"projection_applied":true}

## P-T5 — Al persona chat (deterministic fallback; no OS control plane)
- POST /cowork/al/chat: {"delegated":false,"extracted":{"action_type":"run","description":"Run a shell step that echoes hello from Al"},"reason":"no delegation rule matched","reply":"I can take this on, but no delegation rule in workspace `default` matches action type `run`. Add one (action_type prefix → target principal) and ask again.","session_id":"alsess-evidence-1"}
- GET /cowork/al/sessions/alsess-evidence-1: {"messages":[{"content":"Run a shell step that echoes hello from Al","created_at":"2026-09-13 23:20:03","intent_id":null,"role":"user","run_id":null,"run_state":""},{"content":"I can take this on, but no delegation rule in workspace `default` matches action type `run`. Add one (action_type prefix → target principal) and ask again.","created_at":"2026-09-13 23:20:03","intent_id":null,"role":"assistant","run_id":null,"run_state":""}],"session_id":"alsess-evidence-1"}

## P-T6 — control-surface endpoints
- GET /fabric/transport/principals: {"principals":[{"capabilities":["compute.local"],"created_at":"2026-09-13 23:20:02","id":"principal/gizzi-local-1","roles":["worker"],"status":"active","workspace":"evidence"},{"capabilities":["compute.vm"],"created_at":"2026-09-13 23:20:02","id":"principal/gizzi-vm-1","roles":["worker"],"status":"active","workspace":"evidence"}]}
- PUT delegation-rule: {"action_type":"shell_steps","priority":10,"target_principal":"principal/gizzi-local-1","workspace":"evidence"}
- GET delegation-rules: {"rules":[{"action_type":"shell_steps","created_at":"2026-09-13 23:20:03","priority":10,"target_principal":"principal/gizzi-local-1","workspace":"evidence"}],"workspace":"evidence"}
- DELETE delegation-rule: {"deleted":true}
- GET /cowork/runs/2f60af9f-7104-4af3-9520-ad04b492c333/events (attribution triple): [{"id":"66ff2537-fc24-4fb5-9e7a-990466ce4154","run_id":"2f60af9f-7104-4af3-9520-ad04b492c333","event_type":"intent.accepted","payload":{"action_type":"shell_steps","intent_id":"intent-evidence-vm-1","target":"principal/gizzi-vm-1"},"initiator":"a://principal/evidence-user","delegator":null,"executor":"principal/gizzi-vm-1","created_at":"2026-09-13 23:20:02"},{"id":"214e39b0-caa4-4b89-8a2d-889333a1238c","run_id":"2f60af9f-7104-4af3-9520-ad04b492c333","event_type":"job.claimed","payload":{"capabilities":["compute.vm"],"job_id":"8ffc36e3-e468-40b4-979e-79b1efd23082","lease_expires_at":"2026-09-13T23:22:02.824511+00:00","lease_generation":1,"lease_id":"lease_0f1f3a25-d1aa-4ad6-8ff0-10e8ddacfc52"},"initiator":"a://principal/evidence-user","delegator":null,"executor":"principal/gizzi-vm-1","crea
- GET /fabric/transport/connector-sessions: {"sessions":[{"capability":"connector.files.write","created_at":"2026-09-13 23:20:03","expires_at":"2026-09-13T23:22:03.413196+00:00","id":"cs_161efa0d-18c2-4c09-ae5c-03f41f5cf5d7","job_id":"8ffc36e3-e468-40b4-979e-79b1efd23082","principal":"principal/gizzi-vm-1","run_id":"2f60af9f-7104-4af3-9520-ad04b492c333","status":"active"},{"capability":"connector.files.read","created_at":"2026-09-13 23:20:02","expires_at":"2026-09-13T23:22:02.983920+00:00","id":"cs_fce767ce-dcda-4035-828a-7131b8dd2dae","j

## P-T5 (end-to-end) + P-T3 — Al delegates; daemon worker claims, executes, shuts down gracefully
- daemon principal (workspace default): {"id":"principal/gizzi-daemon-1","workspace":"a://workspace/default","capabilities":["compute.local"],"token":"<withheld>"}
- delegation rule run → gizzi-daemon-1: {"action_type":"run","priority":10,"target_principal":"principal/gizzi-daemon-1","workspace":"default"}
- Al chat #2 (rule matched): {"created":true,"delegated":true,"extracted":{"action_type":"run","description":"Run a shell step that echoes hello from Al"},"intent_id":"al_ee1fc0b8-f0af-4510-919a-d5b10738665e","pending_approvals":0,"reply":"Delegated to a://workspace/default/principal/gizzi-daemon-1 (run 81bf6a4a-fbe6-4af5-80ac-6611c9de1846, state queued). 0 approval(s) pending.","run_id":"81bf6a4a-fbe6-4af5-80ac-6611c9de1846","run_state":"queued","session_id":"alsess-evidence-2","target":"a://workspace/default/principal/gizzi-daemon-1"}
- canonical run 81bf6a4a-fbe6-4af5-80ac-6611c9de1846 job: 366a7b1f-f9d4-4c7a-b333-ba8aae46d5bd
- daemon log (structured JSON):
    {"ts":"2026-09-13T23:20:04.526Z","level":"info","event":"worker.daemon_start","compute_mode":"local"}
    {"ts":"2026-09-13T23:20:04.573Z","level":"info","event":"worker.claimed","job_id":"366a7b1f-f9d4-4c7a-b333-ba8aae46d5bd","lease_generation":1}
    {"ts":"2026-09-13T23:20:04.615Z","level":"info","event":"worker.completed","job_id":"366a7b1f-f9d4-4c7a-b333-ba8aae46d5bd","outcome":"committed","steps":0}
    {"ts":"2026-09-13T23:20:16.462Z","level":"info","event":"worker.shutdown_requested","signal":"SIGTERM"}
- job 366a7b1f-f9d4-4c7a-b333-ba8aae46d5bd state after daemon run: completed
- run 81bf6a4a-fbe6-4af5-80ac-6611c9de1846 events (attribution initiator/delegator/executor): [{"id":"c4f94570-37a5-4fbe-b2ed-8eb9f27ffcc0","run_id":"81bf6a4a-fbe6-4af5-80ac-6611c9de1846","event_type":"intent.accepted","payload":{"action_type":"run","intent_id":"al_ee1fc0b8-f0af-4510-919a-d5b10738665e","target":"a://workspace/default/principal/gizzi-daemon-1"},"initiator":"local-dev-user","delegator":"a://workspace/default/principal/al","executor":"a://workspace/default/principal/gizzi-daemon-1","created_at":"2026-09-13 23:20:04"},{"id":"fc152e91-55a8-4dbb-8a99-9810da92aeda","run_id":"81bf6a4a-fbe6-4af5-80ac-6611c9de1846","event_type":"job.claimed","payload":{"capabilities":[],"job_id":"366a7b1f-f9d4-4c7a-b333-ba8aae46d5bd","lease_expires_at":"2026-09-13T23:21:04.565014+00:00","lease_generation":1,"lease_id":"lease_b89131c5-8393-4211-963e-6bc3b737df0f"},"initiator":"local-dev-user"


# Allternit Computer Use — Cookbooks Index

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

## Golden Paths (v0.1 — Implemented)

Canonical execution paths — the recommended way to accomplish common tasks.

| ID | Name | Family | Mode | Primary Adapter |
|----|------|--------|------|----------------|
| GP-01 | Deterministic browser execution | browser | execute | browser.playwright |
| GP-02 | Adaptive browser execution | browser | execute | browser.browser-use |
| GP-03 | Browser inspect/debug | browser | inspect | browser.cdp |
| GP-04 | Parallel browser execution | browser | parallel | browser.playwright (pool) |
| GP-05 | Desktop execution | desktop | execute | desktop.pyautogui |
| GP-06 | Desktop inspect (read-only) | desktop | inspect | desktop.pyautogui |
| GP-07 | Cross-family workflow | browser+desktop | execute | browser.playwright → desktop.pyautogui |
| GP-08 | Policy enforcement | all | all | PolicyEngine |

Full golden path specs: `packages/computer-use/golden-paths/GP-01-*.md` through `GP-08-*.md`

## Golden Paths (v0.2 — Planned)

| ID | Name | Family | Mode | Prerequisite |
|----|------|--------|------|-------------|
| GP-09 | Site crawl and extract | retrieval | crawl | Retrieval adapter |
| GP-10 | Browser download → desktop transform → upload | hybrid | hybrid | Hybrid orchestrator |
| GP-11 | Assist in current browser | browser | assist | Extension adapter |

---

## Operator Runbooks

### Starting the Operator
```bash
cd services/computer-use-operator
python run.py
# Runs on port 3010 by default
```

### Health Check
```bash
curl http://localhost:3010/health
```

### Creating a Browser Task
```bash
curl -X POST http://localhost:3010/v1/browser/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer allternit-operator-key" \
  -d '{"goal": "Navigate to example.com and extract the title", "mode": "browser-use"}'
```

### Desktop Control
```bash
curl -X POST http://localhost:3010/v1/sessions/test-session/desktop/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer allternit-operator-key" \
  -d '{"instruction": "Open TextEdit and type hello", "session_id": "test-session"}'
```

### Checking Receipts
```bash
curl http://localhost:3010/v1/receipts/{receipt_id}
# Or check local storage:
ls ~/.allternit/receipts/
```

## Recovery Runbooks

### Adapter Failure
1. Check telemetry: `GET /v1/telemetry/sessions/{session_id}`
2. Review receipts for the failed action
3. If fallback was used, check fallback receipt
4. If all fallbacks failed, check policy decisions

### Session Stuck
1. Check session status via SessionManager
2. If checkpointed, attempt restore
3. If unrecoverable, destroy session and create new one

### Policy Denied
1. Review policy decision (decision_id in receipt)
2. Check which rules triggered
3. If legitimate, add custom allow rule or request approval
4. If blocked correctly, no action needed

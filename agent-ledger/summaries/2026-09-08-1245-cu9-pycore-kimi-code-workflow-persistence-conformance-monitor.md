# Session cu9-pycore — workflow executor + canonical persistence + measured conformance + monitor hook
- Branch session/cu9-pycore → PR #161 → merge e31b6a708
- Workflow executor (record→replay→teach→run CLOSED): core/workflow_runner.py runs BrowserWorkflowSpec with {{input}} parameterization, missing-param → approval.required pause; POST /v1/browser-skills/run in shared RunStore. Live smoke: 3-step workflow vs example.com via CDP 3/3 ok.
- Canonical persistence: run_persistence.py (runs.sqlite3 + recordings index), GET /v1/computer-use/runs, canonical EventLedger written from all 4 paths; kill+restart verified runs/recordings survive.
- Measured conformance: adapter_grades.json now real — browser.playwright 8/8=100% (real headless Chromium), mock 8/8, routing-policy 6/6, browser.cdp 1/8 experimental; suites B/C/E honest null.
- Monitor hook: core/monitor.py (pluggable, documented VLM swap-in; HeuristicMonitor = injection-keyword scan + identical-action loop detection), planning-loop integration, StopReason.MONITOR_FLAG.
- Verified: pytest 193 passed (+51), 21 skipped. Deferrals: no canonical skill repo Python-side (skill_id from ~/.allternit/browser-skills/), suites B/C/E + extension/desktop unmeasured, wait=true + approval pause not approvable.

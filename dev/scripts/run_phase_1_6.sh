#!/usr/bin/env bash
set -euo pipefail

bash scripts/law_setup.sh
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi
$PYTHON_BIN scripts/validate_law.py

# Phase 1: Task parity gates
bash tests/acceptance/test_task_install_run_state.sh
bash tests/acceptance/test_task_blocked_by.sh
bash tests/acceptance/test_task_resume_deterministic.sh
bash tests/acceptance/test_task_node_receipt_required.sh
bash tests/acceptance/test_task_beads_mismatch.sh

# Phase 1.5: Subprocess worker gates
bash tests/acceptance/test_worker_registry_required.sh
bash tests/acceptance/test_forced_fail_restores_anchors.sh
bash tests/acceptance/test_subprocess_denied_without_worker.sh
bash tests/acceptance/test_subprocess_allows_only_allowlisted_worker.sh
bash tests/acceptance/test_subprocess_receipt_emitted.sh

# Phase 1.6: Agent execution contract gates
bash tests/acceptance/test_exec_missing_run_id.sh
bash tests/acceptance/test_exec_missing_wih_or_node.sh
bash tests/acceptance/test_exec_receipt_emitted.sh
bash tests/acceptance/test_exec_deterministic_replay.sh
bash tests/acceptance/test_exec_missing_agent_profile.sh

# Sanity-after-restore: repo must validate after forced-fail blocks
$PYTHON_BIN scripts/validate_law.py

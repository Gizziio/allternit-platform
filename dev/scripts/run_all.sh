#!/bin/bash
set -e

# Setup/Ensure Venv
bash scripts/law_setup.sh > /dev/null
PYTHON=".venv-law/bin/python3"

echo "==========================================="
echo "   A2RCHITECH UNIFIED EXECUTION RUNNER     "
echo "==========================================="

echo ">>> Phase 0: Law Anchors + Boot Gates"
$PYTHON scripts/validate_law.py
bash tests/acceptance/test_boot_anchors.sh
bash tests/acceptance/test_codebase_regen.sh
bash tests/acceptance/test_boot_manifest_validation.sh
bash tests/acceptance/test_boot_manifest_path.sh
bash tests/acceptance/test_wih_tool_registry_lock.sh
bash tests/acceptance/test_law_bootstrap_offline.sh
echo "✅ Phase 0 Complete"

echo ">>> Phase 1: Task Parity"
bash tests/acceptance/test_task_install_run_state.sh
bash tests/acceptance/test_task_blocked_by.sh
bash tests/acceptance/test_task_resume_deterministic.sh
bash tests/acceptance/test_task_node_receipt_required.sh
bash tests/acceptance/test_task_beads_mismatch.sh
echo "✅ Phase 1 Complete"

echo ">>> Phase 1.5: Subprocess Workers"
bash tests/acceptance/test_worker_registry_required.sh
bash tests/acceptance/test_subprocess_denied_without_worker.sh
bash tests/acceptance/test_subprocess_allows_only_allowlisted_worker.sh
bash tests/acceptance/test_subprocess_receipt_emitted.sh
echo "✅ Phase 1.5 Complete"

echo ">>> Phase 1.6: Agent Execution"
bash tests/acceptance/test_exec_missing_run_id.sh
bash tests/acceptance/test_exec_missing_wih_or_node.sh
bash tests/acceptance/test_exec_receipt_emitted.sh
bash tests/acceptance/test_exec_deterministic_replay.sh
bash tests/acceptance/test_exec_missing_agent_profile.sh
echo "✅ Phase 1.6 Complete"

# Call the dedicated runners for Phase 2 and 3
bash scripts/run_phase_2.sh
bash scripts/run_phase_3.sh

echo "==========================================="
echo "   ALL PHASES COMPLETED SUCCESSFULLY       "
echo "==========================================="

#!/bin/bash
set -e

# Setup/Ensure Venv
bash scripts/law_setup.sh > /dev/null

# Define Python path
PYTHON=".venv-law/bin/python3"

echo ">>> Phase 3: Capsule Runtime"
$PYTHON scripts/validate_law.py
bash tests/acceptance/test_capsule_registry_required.sh
bash tests/acceptance/test_capsule_permission_denied.sh
bash tests/acceptance/test_capsule_receipt_emitted.sh
echo "✅ Phase 3 Complete"

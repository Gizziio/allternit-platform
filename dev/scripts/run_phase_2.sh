#!/bin/bash
set -e

# Setup/Ensure Venv
bash scripts/law_setup.sh > /dev/null

# Define Python path
PYTHON=".venv-law/bin/python3"

echo ">>> Phase 2: Gateway Law + Runtime"
$PYTHON scripts/validate_law.py
bash tests/acceptance/test_gateway_registry_required.sh
bash tests/acceptance/test_gateway_single_ingress.sh
bash tests/acceptance/test_gateway_routes_valid.sh
bash tests/acceptance/test_gateway_registry_runtime_load.sh
bash tests/acceptance/test_gateway_rejects_direct_internal_route.sh
bash tests/acceptance/test_gateway_routing_receipt_emitted.sh
echo "✅ Phase 2 Complete"

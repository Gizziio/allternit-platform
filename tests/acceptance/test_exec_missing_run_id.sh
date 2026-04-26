#!/usr/bin/env bash
set -euo pipefail

cargo test -p allternit-tools-gateway test_execution_requires_run_id

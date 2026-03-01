#!/usr/bin/env bash
set -euo pipefail

cargo test -p a2rchitech-tools-gateway test_subprocess_allowlisted_worker

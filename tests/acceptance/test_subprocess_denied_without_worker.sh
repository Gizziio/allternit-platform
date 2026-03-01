#!/usr/bin/env bash
set -euo pipefail

cargo test -p a2rchitech-tools-gateway test_subprocess_denied_without_worker

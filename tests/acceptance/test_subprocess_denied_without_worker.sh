#!/usr/bin/env bash
set -euo pipefail

cargo test -p allternit-tools-gateway test_subprocess_denied_without_worker

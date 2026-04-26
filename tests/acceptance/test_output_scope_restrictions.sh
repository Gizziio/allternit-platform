#!/usr/bin/env bash
set -euo pipefail

cargo test -p allternit-tools-gateway test_write_scope_restrictions

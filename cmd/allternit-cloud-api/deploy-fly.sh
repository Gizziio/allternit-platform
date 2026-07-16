#!/usr/bin/env bash
set -euo pipefail

# Build a minimal deployment context for allternit-cloud-api.
# The full repo context is ~7 GB; this script copies only the workspace
# members needed by the cloud API, shrinking the Fly.io build context to ~1 MB.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$(mktemp -d)"
trap 'rm -rf "$DEPLOY_DIR"' EXIT

python3 "$(dirname "${BASH_SOURCE[0]}")/deploy-fly.py" "$REPO_ROOT" "$DEPLOY_DIR"

cd "$DEPLOY_DIR"
exec flyctl deploy --remote-only "$@"

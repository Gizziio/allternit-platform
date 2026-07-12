#!/bin/sh
# Register Allternit Desktop Native Messaging Host.
#
# Usage:
#   ALLTERNIT_EXTENSION_ID=<chrome-extension-id> ./register.sh
#   ./register.sh --doctor --extension-id <chrome-extension-id>
#   ./register.sh --uninstall

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$SCRIPT_DIR/scripts/native-host-installer.mjs" "$@"

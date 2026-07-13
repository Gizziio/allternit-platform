#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

: "${ALLTERNIT_OFFICE_APP_BASE_URL:?Set the public HTTPS Office runtime URL}"
: "${ALLTERNIT_PLATFORM_URL:?Set the Allternit platform URL}"
: "${VITE_ALLTERNIT_GATEWAY_URL:?Set the reachable Allternit gateway URL}"
: "${VITE_ALLTERNIT_PLATFORM_URL:?Set the reachable Allternit platform URL}"

case "$ALLTERNIT_OFFICE_APP_BASE_URL" in
  https://*) ;;
  *) echo "Office runtime must use HTTPS" >&2; exit 1 ;;
esac

export VITE_ALLTERNIT_OFFICE_BASE_PATH="${VITE_ALLTERNIT_OFFICE_BASE_PATH:-/office-addins/}"

pnpm manifest:generate
pnpm build

for product in word excel powerpoint; do
  manifest="manifests/${product}.xml"
  test -f "$manifest"
  grep -q "Allternit for" "$manifest"
  grep -q "<SourceLocation DefaultValue=\"${ALLTERNIT_OFFICE_APP_BASE_URL}/src/taskpane/index.html?product=${product}\"" "$manifest"
done

rm -rf deployment
mkdir -p deployment/office-addins/manifests
cp -R dist/. deployment/office-addins/
cp manifests/*.xml deployment/office-addins/manifests/

echo "Prepared deployment/office-addins"
echo "Publish that directory at ${ALLTERNIT_OFFICE_APP_BASE_URL}"
echo "The three developer manifests remain independently installable."

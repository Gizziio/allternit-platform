#!/bin/bash
# Build a Windows Incus image on a KVM-capable host.
#
# Usage:
#   ./build-windows-image.sh [2022|2019|11e|10e]
#
# This script wraps https://github.com/antifob/incus-windows to produce a
# disk.qcow2 + metadata tarball, then imports it as the
# `allternit-desktop-windows` Incus image alias.
#
# Requirements: KVM (/dev/kvm), curl, python3, xorriso, incus.

set -euo pipefail

VERSION="${1:-2022}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${WORK_DIR:-/tmp/allternit-windows-image}"
OUTPUT_DIR="$WORK_DIR/output"

if [ ! -e /dev/kvm ]; then
    echo "ERROR: /dev/kvm is missing. Windows VMs require a KVM-capable host." >&2
    exit 1
fi

mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

if [ ! -d incus-windows ]; then
    echo "[build-windows-image] cloning incus-windows builder"
    git clone --depth 1 https://github.com/antifob/incus-windows.git
fi

cd incus-windows

echo "[build-windows-image] building Windows $VERSION image (this takes 15-30 minutes)"
sh build.sh "$VERSION"

IMPORT_SRC="$WORK_DIR/incus-windows/output/$VERSION"
echo "[build-windows-image] importing from $IMPORT_SRC"
incus image import "$IMPORT_SRC/incus.tar.xz" "$IMPORT_SRC/disk.qcow2" --alias "allternit-desktop-windows"

echo "[build-windows-image] image ready: allternit-desktop-windows"
echo "[build-windows-image] launch example:"
echo "  incus launch allternit-desktop-windows win-test -c security.secureboot=false"

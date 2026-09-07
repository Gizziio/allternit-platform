#!/bin/bash
# Deploy a KVM-capable Incus host that can run Windows desktop VMs.
#
# Run as root on a bare-metal or nested-virtualization-capable Ubuntu 24.04
# host. The script installs Incus, verifies KVM, creates a Windows desktop
# profile, and imports a Windows image.
#
# Prerequisites:
#   - CPU with VMX/SVM and nested virtualization enabled (or bare metal).
#   - Either WINDOWS_ISO set to a Windows 11/Server ISO path/URL, or
#     WINDOWS_IMAGE_TARBALL set to a pre-built Incus image tarball.
#
# Usage:
#   sudo WINDOWS_ISO=/path/to/win11.iso ./deploy-windows-host.sh

set -euo pipefail

WINDOWS_ISO="${WINDOWS_ISO:-}"
WINDOWS_IMAGE_TARBALL="${WINDOWS_IMAGE_TARBALL:-}"
INCUS_REMOTE="${INCUS_REMOTE:-antifob}"
INCUS_REMOTE_URL="${INCUS_REMOTE_URL:-https://images.lxd.canonical.com}"
WIN_IMAGE_ALIAS="${WIN_IMAGE_ALIAS:-win11-desktop}"

log() { echo "[deploy-windows-host] $*"; }
fail() { echo "[deploy-windows-host] ERROR: $*" >&2; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "must run as root"
fi

# ---------------------------------------------------------------------------
# 1. Verify KVM is available.
# ---------------------------------------------------------------------------
log "checking CPU virtualization support"
if ! grep -Eq '(vmx|svm)' /proc/cpuinfo; then
  fail "CPU does not advertise VMX or SVM"
fi

log "checking /dev/kvm"
if [ ! -e /dev/kvm ]; then
  modprobe kvm || true
  modprobe kvm_intel nested=1 || true
  modprobe kvm_amd nested=1 || true
fi
if [ ! -e /dev/kvm ]; then
  fail "/dev/kvm missing; this host cannot run Windows VMs"
fi
chmod 666 /dev/kvm || true

# ---------------------------------------------------------------------------
# 2. Install Incus if not present.
# ---------------------------------------------------------------------------
if ! command -v incus >/dev/null 2>&1; then
  log "installing Incus from Zabbly repository"
  apt-get update
  apt-get install -y curl gnupg software-properties-common
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://pkgs.zabbly.com/key.asc -o /etc/apt/keyrings/zabbly.asc
  cat >/etc/apt/sources.list.d/zabbly-incus-stable.sources <<EOF
Types: deb
URIs: https://pkgs.zabbly.com/incus/stable
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: main
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/zabbly.asc
EOF
  apt-get update
  apt-get install -y incus incus-ui-canonical
else
  log "Incus already installed: $(incus --version)"
fi

# ---------------------------------------------------------------------------
# 3. Initialise Incus with defaults if not already configured.
# ---------------------------------------------------------------------------
if ! incus info >/dev/null 2>&1; then
  log "initialising Incus"
  incus admin init --auto
fi

# ---------------------------------------------------------------------------
# 4. Create a Windows desktop profile.
# ---------------------------------------------------------------------------
log "creating windows-desktop profile"
incus profile create windows-desktop >/dev/null 2>&1 || true
incus profile edit windows-desktop <<'EOF'
config:
  limits.cpu: "2"
  limits.memory: 4GiB
  security.secureboot: "false"
  security.csm: "false"
devices:
  root:
    path: /
    pool: default
    size: 50GiB
    type: disk
  tpm:
    path: /dev/tpm0
    type: tpm
EOF

# ---------------------------------------------------------------------------
# 5. Import or build a Windows image.
# ---------------------------------------------------------------------------
if [ -n "${WINDOWS_IMAGE_TARBALL}" ]; then
  log "importing pre-built Windows image from ${WINDOWS_IMAGE_TARBALL}"
  if [ ! -f "${WINDOWS_IMAGE_TARBALL}" ]; then
    fail "tarball not found: ${WINDOWS_IMAGE_TARBALL}"
  fi
  incus image import "${WINDOWS_IMAGE_TARBALL}" --alias "${WIN_IMAGE_ALIAS}"
elif [ -n "${WINDOWS_ISO}" ]; then
  log "building Windows image from ISO (this requires distrobuilder)"
  if ! command -v distrobuilder >/dev/null 2>&1; then
    log "installing distrobuilder"
    apt-get install -y golang-go debootstrap rsync qemu-utils
    go install github.com/lxc/distrobuilder/distrobuilder@latest
    export PATH="${PATH}:$(go env GOPATH)/bin"
  fi
  if [ ! -f "${WINDOWS_ISO}" ]; then
    fail "ISO not found: ${WINDOWS_ISO}"
  fi
  WORK_DIR="/var/tmp/allternit-windows-build-$$"
  mkdir -p "${WORK_DIR}"
  cat >"${WORK_DIR}/windows.yaml" <<EOF
image:
  distribution: windows
  release: 11
source:
  downloader: windows
  url: file://${WINDOWS_ISO}
  variant: default
packages:
  custom_manager: choco
EOF
  distrobuilder repack-windows "${WINDOWS_ISO}" "${WORK_DIR}/win11-incus.tar.xz" \
    --windows-version 11 --windows-arch amd64 --windows-language en-us \
    -o "${WORK_DIR}/windows.yaml" || fail "distrobuilder repack-windows failed"
  incus image import "${WORK_DIR}/win11-incus.tar.xz" --alias "${WIN_IMAGE_ALIAS}"
  rm -rf "${WORK_DIR}"
else
  log "no WINDOWS_ISO or WINDOWS_IMAGE_TARBALL provided; skipping image import"
  log "you can import later with: incus image import <tarball> --alias ${WIN_IMAGE_ALIAS}"
fi

# ---------------------------------------------------------------------------
# 6. Verify a test VM can launch (if an image was imported).
# ---------------------------------------------------------------------------
if incus image list --format json | grep -q "${WIN_IMAGE_ALIAS}"; then
  log "verifying test VM launch"
  TEST_VM="allternit-win-test-$$"
  incus init "${WIN_IMAGE_ALIAS}" "${TEST_VM}" --profile windows-desktop --vm || fail "incus init failed"
  incus start "${TEST_VM}" || fail "incus start failed"
  for i in $(seq 1 60); do
    state=$(incus info "${TEST_VM}" --format json | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    if [ "${state}" = "Running" ]; then
      log "test VM is running"
      break
    fi
    sleep 5
  done
  incus stop "${TEST_VM}" --force || true
  incus delete "${TEST_VM}" --force || true
else
  log "no Windows image imported; skipping launch verification"
fi

log "Windows Incus host deployment complete"
log "Use image alias '${WIN_IMAGE_ALIAS}' and profile 'windows-desktop' for Windows desktops"

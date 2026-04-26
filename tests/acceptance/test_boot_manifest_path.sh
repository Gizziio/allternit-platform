#!/usr/bin/env bash
set -euo pipefail

kernel_file="services/kernel/src/main.rs"
validator_file="scripts/validate_law.py"

rg -n "boot_dir = StdPath::new\(\"\.allternit/boot\"\)" "$kernel_file" > /dev/null
rg -n "receipt_path = boot_dir.join\(\"boot_manifest.json\"\)" "$kernel_file" > /dev/null

rg -n "DEFAULT_BOOT_MANIFEST_PATH = ROOT / \"\.allternit\" / \"boot\" / \"boot_manifest.json\"" "$validator_file" > /dev/null

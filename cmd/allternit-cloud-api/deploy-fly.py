#!/usr/bin/env python3
"""Prepare a minimal Fly.io deployment context for allternit-cloud-api."""
import os
import re
import shutil
import sys

repo_root = sys.argv[1]
deploy_dir = sys.argv[2]

# Workspace members required by allternit-cloud-api (direct + transitive).
MEMBERS = [
    "cmd/allternit-cloud-api",
    "cmd/allternit-cloud-wizard",
    "infrastructure/cloud",
    "infrastructure/cloud/allternit-cloud-ssh",
    "infrastructure/providers/hetzner",
]

# Read and rewrite workspace Cargo.toml with only the needed members.
with open(os.path.join(repo_root, "Cargo.toml"), "r") as f:
    cargo_toml = f.read()

new_members = "members = [\n    " + ",\n    ".join(f'"{m}"' for m in MEMBERS) + "\n]"
cargo_toml = re.sub(r"members\s*=\s*\[.*?\]", new_members, cargo_toml, flags=re.DOTALL)

with open(os.path.join(deploy_dir, "Cargo.toml"), "w") as f:
    f.write(cargo_toml)

# Copy Cargo.lock so dependency resolution is deterministic.
shutil.copy2(
    os.path.join(repo_root, "Cargo.lock"),
    os.path.join(deploy_dir, "Cargo.lock"),
)

# Copy needed crates, excluding build artifacts and docs.
ignore = shutil.ignore_patterns(
    "target",
    ".git",
    "node_modules",
    "*.md",
    "build",
    "dist",
    ".next",
    "out",
)
for member in sorted(MEMBERS):
    src = os.path.join(repo_root, member)
    dst = os.path.join(deploy_dir, member)
    if os.path.exists(dst):
        continue
    shutil.copytree(src, dst, ignore=ignore)

# Copy Dockerfile to the deploy root and point fly.toml at it.
shutil.copy2(
    os.path.join(repo_root, "cmd/allternit-cloud-api/Dockerfile"),
    os.path.join(deploy_dir, "Dockerfile"),
)

fly_toml_src = os.path.join(repo_root, "fly.toml")
fly_toml_dst = os.path.join(deploy_dir, "fly.toml")
with open(fly_toml_src, "r") as f:
    fly_toml = f.read()
fly_toml = re.sub(
    r'dockerfile\s*=\s*"[^"]*"',
    'dockerfile = "Dockerfile"',
    fly_toml,
)
with open(fly_toml_dst, "w") as f:
    f.write(fly_toml)

print(f"Deployment context ready at {deploy_dir}")

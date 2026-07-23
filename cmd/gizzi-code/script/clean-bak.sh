#!/usr/bin/env bash
# Remove all .bak files from the repository.
set -euo pipefail

count=$(find . -name "*.bak" -type f | wc -l | tr -d ' ')
if [ "$count" -eq 0 ]; then
  echo "No .bak files found."
  exit 0
fi

echo "Removing $count .bak files..."
find . -name "*.bak" -type f -delete
echo "Done. $count .bak files removed."

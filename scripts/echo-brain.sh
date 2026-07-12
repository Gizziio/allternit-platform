#!/bin/bash
# Allternit Echo Brain — dev/test subprocess provider for Gizzi.
exec python3 "$(dirname "$0")/echo-brain.py" "$@"

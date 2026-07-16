#!/bin/sh
set -e

# The /data directory is a Fly.io persistent volume mounted at runtime.
# Ensure the application user owns it before dropping privileges.
chown -R allternit:allternit /data

exec runuser -u allternit -- "$@"

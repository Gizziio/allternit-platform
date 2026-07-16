#!/usr/bin/env bash
# Apply every migration to a scratch PostgreSQL database, run the SQL smoke
# suite, and drop the database. Requires a local PostgreSQL 16 client
# (homebrew postgresql@16 or psql on PATH).
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
    if [ -x "$candidate/psql" ]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found; install postgresql@16 or add it to PATH" >&2
  exit 2
fi

DB="miniapp_sql_smoke_$$"
cleanup() { dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

createdb "$DB"
for migration in migrations/*.sql; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
  echo "applied $migration"
done

psql -d "$DB" -v ON_ERROR_STOP=1 -f scripts/sql-smoke.sql
echo "SQL smoke suite passed (scratch database dropped)"

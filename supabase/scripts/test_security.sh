#!/bin/bash
# Run every migration on a scratch local database, then the attack checks.
# Needs Homebrew postgresql@17 listening on localhost:54329 (user postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" PGUSER=postgres PGHOST=localhost PGPORT=54329
DB="wallpy_sec_$$"
psql -d postgres -qc "create database $DB"
trap 'psql -d postgres -qc "drop database $DB"' EXIT
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql >/dev/null 2>&1
for m in supabase/migrations/*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$m" >/dev/null 2>"/tmp/$DB.err" || { echo "migration failed: $m"; cat "/tmp/$DB.err"; exit 1; }
done
out=$(psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql 2>&1) || { echo "$out" | grep -E "FAIL|ERROR"; exit 1; }
echo "$(echo "$out" | grep -c 'ok  ') security checks passed"

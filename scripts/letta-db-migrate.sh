#!/usr/bin/env bash
# Apply Letta ORM schema via Alembic (`alembic upgrade head`), matching upstream dev setup:
# @see https://github.com/daib/letta/blob/main/CONTRIBUTING.md (Install uv → alembic upgrade head)
#
# With Docker Compose, Postgres is prepared by docker/letta-init.sql (extensions + schema); this
# step creates/updates application tables. The Letta image also runs the same migration on every
# server start (letta/server/startup.sh); use this script to migrate before `letta` is up or
# after wiping letta_pgdata.
#
# Usage (Docker — default):
#   npm run letta:db:migrate
#
# Local Letta checkout + host Postgres (set LETTA_PG_URI to reach your DB, e.g. port-mapped letta_db):
#   export LETTA_PG_URI="postgresql://letta:letta@127.0.0.1:5433/letta"
#   bash scripts/letta-db-migrate.sh --local
#
# Env:
#   COMPOSE_FILE     — default: <repo>/docker-compose.yml
#   LETTA_PG_URI     — DB URL (Docker default: postgresql://letta:letta@letta_db:5432/letta)
#   LETTA_SRC        — for --local: path to Letta repo (default: <repo>/../letta)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"
LETTA_SRC="${LETTA_SRC:-"$ROOT/../letta"}"

compose() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo "letta-db-migrate: docker-compose not on PATH." >&2
    exit 1
  fi
}

wait_letta_db() {
  local i=0
  compose up -d letta_db
  while ! compose exec -T letta_db pg_isready -U letta -d letta >/dev/null 2>&1; do
    i=$((i + 1))
    if [[ "$i" -gt 90 ]]; then
      echo "letta-db-migrate: timeout waiting for letta_db (pg_isready)." >&2
      exit 1
    fi
    sleep 1
  done
}

run_migrate_docker() {
  local uri="${LETTA_PG_URI:-postgresql://letta:letta@letta_db:5432/letta}"
  if ! command -v docker >/dev/null 2>&1; then
    echo "letta-db-migrate: docker not on PATH." >&2
    exit 1
  fi

  wait_letta_db

  echo "letta-db-migrate: running alembic upgrade head in Letta image (LETTA_PG_URI=$uri)..."
  compose run --rm \
    --no-deps \
    -e "LETTA_PG_URI=$uri" \
    --entrypoint sh \
    letta \
    -c 'set -euo pipefail; cd /app && alembic upgrade head'

  echo "letta-db-migrate: done."
}

run_migrate_local() {
  if ! command -v uv >/dev/null 2>&1; then
    echo "letta-db-migrate: --local requires uv on PATH (https://docs.astral.sh/uv/)." >&2
    exit 1
  fi
  if [[ -z "${LETTA_PG_URI:-}" ]]; then
    echo "letta-db-migrate: --local requires LETTA_PG_URI (e.g. postgresql://letta:letta@127.0.0.1:5433/letta)." >&2
    exit 1
  fi
  if [[ ! -f "$LETTA_SRC/alembic.ini" ]]; then
    echo "letta-db-migrate: no alembic.ini at LETTA_SRC=$LETTA_SRC (clone Letta or set LETTA_SRC)." >&2
    exit 1
  fi

  echo "letta-db-migrate: running uv run alembic upgrade head in $LETTA_SRC..."
  (cd "$LETTA_SRC" && uv run alembic upgrade head)
  echo "letta-db-migrate: done."
}

case "${1:-}" in
  -h | --help)
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  --local)
    run_migrate_local
    ;;
  "")
    run_migrate_docker
    ;;
  *)
    echo "letta-db-migrate: unknown arg: $1 (use --local or --help)" >&2
    exit 1
    ;;
esac

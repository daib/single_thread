#!/usr/bin/env bash
# Create Postgres database (if needed), application role, grants, then apply Prisma migrations.
# Defaults match docker-compose.yml (superuser postgres / singlethread DB).
# Usage: npm run db:init
# Env (optional): POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_SUPERUSER POSTGRES_SUPERPASS
#                 APP_DB_USER APP_DB_PASSWORD DB_URL_HOST
# INIT_DB_USE_HOST_PSQL=1  — always use host psql (default: prefer Docker `db` when that container is running)
# DB_URL_HOST — host embedded in DATABASE_URL for Prisma (default: 127.0.0.1 when using Docker db, else POSTGRES_HOST).
#               Use 127.0.0.1 so Prisma does not hit ::1 / a different local Postgres than Docker on macOS.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-singlethread}"
POSTGRES_SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"
POSTGRES_SUPERPASS="${POSTGRES_SUPERPASS:-postgres}"

APP_DB_USER="${APP_DB_USER:-singlethread}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-singlethread}"

if [[ ! "$POSTGRES_DB" =~ ^[a-zA-Z0-9_]+$ ]] || [[ ! "$APP_DB_USER" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "init-db: POSTGRES_DB and APP_DB_USER must be alphanumeric/underscore only." >&2
  exit 1
fi

if [[ -z "$APP_DB_PASSWORD" ]]; then
  echo "init-db: APP_DB_PASSWORD must not be empty." >&2
  exit 1
fi

# If Docker Compose `db` is up, use psql *inside* the container so we hit the real `postgres` user.
# Host `psql` on localhost:5432 often talks to Homebrew/Postgres.app instead (no `postgres` role).
use_docker_psql=0
if [[ "${INIT_DB_USE_HOST_PSQL:-}" != "1" ]] && command -v docker-compose >/dev/null 2>&1; then
  if docker-compose -f "$ROOT/docker-compose.yml" exec -T db true >/dev/null 2>&1; then
    use_docker_psql=1
  fi
fi

if [[ "$use_docker_psql" -eq 1 ]]; then
  echo "init-db: using Postgres in Docker (service: db)."
  # Prisma runs on the host; `localhost` often resolves to IPv6 (::1) and can reach Homebrew Postgres instead of Docker.
  DB_URL_HOST="${DB_URL_HOST:-127.0.0.1}"
else
  DB_URL_HOST="${DB_URL_HOST:-$POSTGRES_HOST}"
  echo "init-db: using psql on ${POSTGRES_HOST}:${POSTGRES_PORT} (set INIT_DB_USE_HOST_PSQL=1 to force this path)."
  if command -v psql >/dev/null 2>&1; then
    echo "init-db: hint: if you see 'role \"postgres\" does not exist', start Docker: docker-compose up -d db" >&2
    echo "init-db: hint: or use your local superuser, e.g. POSTGRES_SUPERUSER=$USER (Homebrew Postgres)." >&2
  fi
fi

_psql() {
  local db="$1"
  shift
  if [[ "$use_docker_psql" -eq 1 ]]; then
    docker-compose -f "$ROOT/docker-compose.yml" exec -i -T \
      -e "PGPASSWORD=$POSTGRES_SUPERPASS" \
      db psql -U "$POSTGRES_SUPERUSER" -d "$db" -v ON_ERROR_STOP=1 "$@"
  elif command -v psql >/dev/null 2>&1; then
    PGPASSWORD="$POSTGRES_SUPERPASS" psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_SUPERUSER" \
      -d "$db" \
      -v ON_ERROR_STOP=1 \
      "$@"
  else
    echo "init-db: psql not on PATH and Compose service db is not running (or docker-compose missing)." >&2
    echo "init-db: start Postgres with: docker-compose up -d db" >&2
    exit 1
  fi
}

# Reads SQL from stdin. Extra psql args (e.g. -v name=value) go before -f /dev/stdin.
run_psql() {
  local db="$1"
  shift
  _psql "$db" "$@" -f /dev/stdin
}

run_psql_c() {
  local db="$1"
  local sql="$2"
  _psql "$db" -c "$sql"
}

run_psql_scalar() {
  local db="$1"
  local sql="$2"
  _psql "$db" -tAc "$sql" | tr -d '[:space:]'
}

echo "init-db: ensuring database and role exist (superuser: $POSTGRES_SUPERUSER, db: $POSTGRES_DB, app user: $APP_DB_USER)..."

# psql :'var' substitution does not run inside dollar-quoted DO bodies, so create the role from the shell.
APP_PW_SQL_ESC="$(printf '%s' "$APP_DB_PASSWORD" | sed "s/'/''/g")"

run_psql postgres -v dbname="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE DATABASE %I', :'dbname')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname')\gexec
SQL

role_count="$(run_psql_scalar postgres "SELECT COUNT(*)::text FROM pg_roles WHERE rolname='${APP_DB_USER}'")"
if [[ "$role_count" == "0" ]]; then
  run_psql_c postgres "CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_PW_SQL_ESC}'"
fi

run_psql postgres -v dbname="$POSTGRES_DB" -v app_user="$APP_DB_USER" <<'SQL'
GRANT CONNECT ON DATABASE :"dbname" TO :"app_user";
SQL

run_psql "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" <<'SQL'
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO :"app_user";
SQL

enc_pw="$(node -e "console.log(encodeURIComponent(process.argv[1] || ''))" "$APP_DB_PASSWORD")"
app_database_url="postgresql://${APP_DB_USER}:${enc_pw}@${DB_URL_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

super_enc_pw="$(node -e "console.log(encodeURIComponent(process.argv[1] || ''))" "$POSTGRES_SUPERPASS")"
migrate_database_url="postgresql://${POSTGRES_SUPERUSER}:${super_enc_pw}@${DB_URL_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

echo "init-db: applying Prisma migrations (migrate deploy) as superuser ${POSTGRES_SUPERUSER} via ${DB_URL_HOST}:${POSTGRES_PORT}..."
# Force URL on this invocation so a stale .env app role cannot break migrate; app user may lack rights Prisma expects.
DATABASE_URL="$migrate_database_url" npx prisma migrate deploy

echo "init-db: ensuring grants on migrated objects (superuser)..."
run_psql "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" <<'SQL'
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO :"app_user";
SQL

echo "init-db: done."
echo "init-db: set DATABASE_URL in .env for the Next.js app (app role is recommended for day-to-day):"
echo "DATABASE_URL=\"${app_database_url}\""

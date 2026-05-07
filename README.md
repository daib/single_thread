# Single-thread chat

TypeScript + React + **Next.js** (App Router) UI: a sidebar to choose a conversation, a main pane for the thread, and a message composer. **Profiles** can be created and stored in **Postgres** via Prisma.

**Stack:** Next.js 15, React 19, Prisma, PostgreSQL.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- npm (bundled with Node)

Optional: [Docker](https://docs.docker.com/get-docker/) and Docker Compose for local Postgres (and Letta).

## Install

From the repository root:

```bash
npm install
```

`postinstall` runs `prisma generate` so the Prisma client is available after install.

## Environment

1. Copy the example env file:

   ```bash
   cp .env.example .env
   ```

2. Adjust `DATABASE_URL` if your Postgres host, port, user, password, or database name differ.

The default in `.env.example` matches `docker-compose.yml` (`database` **singlethread**, user **postgres**, password **postgres**, port **5432**, host **127.0.0.1** so Prisma and Next hit Docker on macOS instead of `localhost` → `::1`).

## Database (Postgres)

Start Postgres (for example with Compose):

```bash
docker-compose up -d db
```

### One-shot: app DB user + tables (recommended for a fresh Postgres)

With the Compose Postgres container running (e.g. `docker-compose up -d db`):

```bash
npm run db:init
```

This script (`scripts/init-db.sh`):

1. If the **`db` Docker service is running**, it runs `psql` **inside that container** (so you always use the `postgres` user from the image). Otherwise it uses `psql` on `localhost` (see troubleshooting below).
2. Connects as the superuser (`postgres` / `postgres` by default, same as Compose).
3. Creates the database `singlethread` if it does not exist.
4. Creates a login role **`singlethread`** with password **`singlethread`** (override with `APP_DB_USER` / `APP_DB_PASSWORD`).
5. Grants schema/table privileges.
6. Runs **`prisma migrate deploy`** as the **superuser** (`POSTGRES_SUPERUSER` / `POSTGRES_SUPERPASS`) so Prisma always has enough rights; your `.env` app role URL does not affect this step.

It prints a `DATABASE_URL` for the app user you can paste into `.env`.  
Override host/port/superuser with `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_SUPERUSER`, `POSTGRES_SUPERPASS`, `POSTGRES_DB` if needed.

**`FATAL: role "postgres" does not exist`:** Something on `localhost:5432` is not the Docker image (often **Homebrew** or **Postgres.app**, where the superuser is your macOS login, not `postgres`). Fix: run `docker-compose up -d db`, then `npm run db:init` again. To force using host `psql` instead, set `INIT_DB_USE_HOST_PSQL=1` and set `POSTGRES_SUPERUSER` to your local superuser (often `echo $USER`).

**`P1010: User was denied access on the database (not available)`** (Prisma): Often **two Postgres servers** — `psql` in `db:init` talks to Docker, but Prisma on the host used `localhost`, which on macOS can resolve to **`::1`** and hit **Homebrew** Postgres instead of Docker. The init script defaults Prisma to **`127.0.0.1`** when the Compose `db` container is used. In `.env`, prefer `postgresql://...@127.0.0.1:5432/...` instead of `localhost` when Docker publishes `5432`. Override with `DB_URL_HOST` if needed.

### Other schema workflows

- **Interactive migrations** (development):

  ```bash
  npm run db:migrate
  ```

- **Push schema without migration history** (quick local sync only):

  ```bash
  npm run db:push
  ```

Inspect data: `npm run db:studio`.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Chat** (`/`) — in-memory demo conversations (unchanged).
- **Profiles** (`/profiles`) — create profiles (display name, unique handle, optional bio); list is loaded from Postgres.

Use a different port:

```bash
npx next dev -p 4000
```

## Production

```bash
npm run build
npm run start
```

Ensure `DATABASE_URL` is set in the environment and migrations have been applied (`prisma migrate deploy`) before serving.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profiles` | JSON list of profiles (newest first) |
| `POST` | `/api/profiles` | JSON body: `{ "displayName", "handle", "bio?" }`. `handle`: 2–31 chars, lowercase `a-z`, digits, `_`, `-` |

## Docker Compose (optional)

```bash
docker-compose up -d
```

| Service   | Port  | Notes |
| --------- | ----- | ----- |
| Postgres  | 5432  | Database `singlethread`, password `postgres` |
| Letta     | 8283  | [Letta](https://github.com/letta-ai/letta) image (not wired to this UI yet) |

Stop containers:

```bash
docker-compose down
```

If the Next.js app ran **inside** Docker as well, the DB host in `DATABASE_URL` would be `db`, not `localhost`.

## Project layout

| Path | Purpose |
|------|---------|
| `scripts/init-db.sh` | Create DB + app role + run `prisma migrate deploy` (`npm run db:init`) |
| `prisma/schema.prisma` | `Profile` model |
| `prisma/migrations/` | SQL migrations |
| `src/lib/prisma.ts` | Shared `PrismaClient` instance |
| `src/app/api/profiles/route.ts` | Profiles REST API |
| `src/app/profiles/page.tsx` | Profiles UI (server-rendered list) |
| `src/components/ProfileCreateForm.tsx` | Create-profile form (client) |
| `src/components/AppNav.tsx` | Top nav: Chat / Profiles |
| `src/app/layout.tsx` | Root layout + nav |
| `src/app/page.tsx` | Chat home |
| `src/app/globals.css` | Global styles |
| `src/components/ChatApp.tsx` | Chat state and `sendMessage` |
| `docker-compose.yml` | Local Postgres + Letta |

Imports can use the `@/*` alias (see `tsconfig.json` → `paths`).

## Behavior

- **Chat:** data stays in React state; the demo still appends a fake assistant reply. Customize `sendMessage` in `src/components/ChatApp.tsx` for a real backend.
- **Profiles:** persisted in Postgres through Prisma; create flow posts to `/api/profiles` and refreshes the server-rendered list.

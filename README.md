# Single-thread chat

TypeScript + React + **Next.js** (App Router) UI: a sidebar to choose a conversation, a main pane for the thread, and a message composer. Each signed-in user has **at most one account** (name + unique handle + optional bio, keyed by Auth.js user id); **profiles** (multiple: name, handle, optional bio) are stored under that account in **Postgres** via Prisma.

**Stack:** Next.js 15, React 19, Prisma, PostgreSQL, [Auth.js](https://authjs.dev) (Google + optional Facebook).

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

### Sign-in (Auth.js): Google and optional Facebook

Shared:

- `AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`
- Optional: `AUTH_URL` — public site URL in production (e.g. `https://yourdomain.com`)

The nav **Sign in** link goes to **`/login`** (a normal App Router page). Google/Facebook still redirect back to **`/api/auth/callback/<provider>`** — those callback URLs are what you register in each provider’s console, not `/login`.

**Google**

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), open **APIs & Services → Credentials**.
2. Create or select an **OAuth 2.0 Client ID** with type **Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost:3000` (no path; use `https://yourdomain.com` in production).
4. Under **Authorized redirect URIs**, click **Add URI** and paste **exactly** (Google compares character-for-character):

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

   If your app runs on another port, change `3000` to match (e.g. `http://localhost:4000/api/auth/callback/google`) and use that same value here.

5. Save, wait a minute, then try **Sign in** again.
6. Set `AUTH_GOOGLE_ID` (Client ID) and `AUTH_GOOGLE_SECRET` (Client secret) in `.env` from this credential.

If Google shows *“register the redirect URI”* with `redirect_uri=http://localhost:3000/api/auth/callback/google`, that URI is missing or mistyped in **Authorized redirect URIs** (wrong port, `https` vs `http`, or an extra slash). It must match the URL Auth.js sends, which is always `/api/auth/callback/google` under your site origin.

**Facebook (optional)**

1. In [Meta for Developers](https://developers.facebook.com/apps/), create an app and add the **Facebook Login** product.
2. Under **Facebook Login → Settings**, set **Valid OAuth Redirect URIs** to `http://localhost:3000/api/auth/callback/facebook` (and your production callback URL).
3. Set `AUTH_FACEBOOK_ID` (App ID) and `AUTH_FACEBOOK_SECRET` (App secret) in `.env`. If either is empty, the Facebook button is hidden and the provider is not registered.

Chat (`/`) is public. **Account** (`/account`) and **`GET` / `POST` `/api/account`** require a signed-in user (Google or Facebook).

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

- **Chat** (`/`) — pick a **profile** (signed-in users: profiles from Account; guests: “Guest”) to scope threads. **Signed-in:** conversations and messages are stored in **Postgres** (`chat_conversations`, `chat_messages`) per profile. **Guest / signed-out:** same UI uses **`localStorage`** per profile id (`src/lib/chatStorage.ts`).
- **Account** (`/account`) — **one account per sign-in**; create it once (name + globally unique handle + optional bio), then add **profiles** (name, handle unique per account, optional bio); list is loaded from Postgres.

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
| `GET` | `/api/account` | The **current user’s** account (0 or 1 row) with nested `profiles`, or `[]` if none yet |
| `POST` | `/api/account` | JSON: `{ "displayName", "handle", "bio?" }`. Stores the row for `session.user.id` (JWT `sub`). **409** if you already have an account. `handle` globally unique; `bio` optional, max 2000 chars |
| `POST` | `/api/account/:accountId/profiles` | JSON: `{ "displayName", "handle", "bio?" }`. **404** if `:accountId` is not yours. Profile `handle` unique within that account |
| `GET` | `/api/profile/:profileId/conversations` | All chats for that profile (nested messages). **401** / **404** if profile not yours |
| `POST` | `/api/profile/:profileId/conversations` | New thread: `{}` or `{ "title", "preview" }`. **Branch:** `{ "mode": "branch", "fromConversationId" }` copies messages from that thread (same profile) |
| `DELETE` | `/api/conversations/:conversationId` | Delete thread and its messages if you own the profile |
| `POST` | `/api/conversations/:conversationId/messages` | JSON: `{ "role": "user" \| "assistant", "body" }` — append message; returns updated conversation |

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
| `prisma/schema.prisma` | `AppAccount`, `AppProfile`; `ChatConversation` / `ChatMessage` for persisted chats |
| `prisma/migrations/` | SQL migrations (historical rename + nested `profiles`) |
| `src/lib/prisma.ts` | Shared `PrismaClient` instance |
| `src/app/api/account/route.ts` | Account list + create |
| `src/app/api/account/[accountId]/profiles/route.ts` | Create profile under an account |
| `src/app/account/page.tsx` | Account UI (accounts with nested profiles) |
| `src/components/AccountCreateForm.tsx` | Create-account form (client) |
| `src/components/ProfileCreateForm.tsx` | Create-profile form (client) |
| `src/auth.ts` | Auth.js config (`session.user.id` from JWT `sub`, `authorized` for `/account`) |
| `src/middleware.ts` | Requires sign-in for `/account` |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js route handlers |
| `src/components/AppNav.tsx` | Top nav: Chat / Account when signed in |
| `src/app/layout.tsx` | Root layout + nav |
| `src/app/page.tsx` | Chat home |
| `src/app/globals.css` | Global styles |
| `src/app/api/profile/[profileId]/conversations/route.ts` | List / create (or branch) conversations for a profile |
| `src/app/api/conversations/[conversationId]/route.ts` | Delete conversation |
| `src/app/api/conversations/[conversationId]/messages/route.ts` | Append message |
| `src/lib/mapChatConversation.ts` | Map DB rows to client `Conversation` type |
| `src/lib/profileAccess.ts` | Verify profile / conversation ownership by `session.user.id` |
| `src/components/ChatApp.tsx` | Chat UI; uses API when signed in, `localStorage` for guest |
| `src/lib/chatStorage.ts` | Guest-only `localStorage` for conversations |
| `docker-compose.yml` | Local Postgres + Letta |

Imports can use the `@/*` alias (see `tsconfig.json` → `paths`).

## Behavior

- **Chat:** signed-in users persist threads in Postgres via the REST routes above; guests keep data only in the browser. Customize assistant behavior in `src/components/ChatApp.tsx` and the messages API as needed.
- **Account:** `accounts.user_id` matches the signed-in Auth.js user; each user sees and creates at most one account; profiles hang off that row. API and UI scope by `session.user.id`.

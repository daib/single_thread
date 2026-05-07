# Single-thread chat

TypeScript + React + **Next.js** (App Router) UI: a sidebar to choose a conversation, a main pane for the thread, and a message composer.

**Stack:** Next.js 15, React 19.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- npm (bundled with Node)

Optional: [Docker](https://docs.docker.com/get-docker/) and Docker Compose, if you want the local Postgres + Letta services defined in `docker-compose.yml`.

## Install

From the repository root:

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Use a different port:

```bash
npx next dev -p 4000
```

## Production

```bash
npm run build
npm run start
```

Serves the optimized app (default [http://localhost:3000](http://localhost:3000)).

## Docker Compose (optional)

Postgres and Letta are **not** connected to the Next.js UI out of the box; they are here for when you add a backend or agent integration.

```bash
docker compose up -d
```

| Service   | Port  | Notes                                      |
| --------- | ----- | ------------------------------------------ |
| Postgres  | 5432  | Database `singlethread`, password `postgres` |
| Letta     | 8283  | [Letta](https://github.com/letta-ai/letta) image |

Stop and remove containers:

```bash
docker compose down
```

## Project layout

| Path | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration |
| `src/app/layout.tsx` | Root layout, metadata, fonts |
| `src/app/page.tsx` | Home route |
| `src/app/globals.css` | Global and chat layout styles |
| `src/components/ChatApp.tsx` | Client state, conversation selection, `sendMessage` |
| `src/components/ConversationSidebar.tsx` | Conversation list |
| `src/components/ChatPanel.tsx` | Active thread and composer |
| `src/mockData.ts` | Seed conversations |
| `src/types.ts` | `Conversation` and `Message` types |
| `docker-compose.yml` | Local Postgres + Letta |

Imports can use the `@/*` alias (see `tsconfig.json` → `paths`).

## Behavior

Conversation data lives in React state. Sending a message updates the thread and, after a short delay, appends a **demo** assistant reply. To use a real API or database, replace the logic in `sendMessage` inside `src/components/ChatApp.tsx` (and optionally connect to the services from `docker-compose.yml`).

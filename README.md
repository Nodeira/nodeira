<div align="center">
  <img src="./apps/docs/static/img/logo.svg" alt="Nodeira" width="80" />

  <h1>Nodeira</h1>

[![Docs](https://img.shields.io/badge/docs-Nodeira.github.io%2Fnodeira-0284c7)](https://Nodeira.github.io/nodeira/)
[![Latest release](https://img.shields.io/github/v/release/Nodeira/nodeira?logo=github)](https://github.com/Nodeira/nodeira/releases)
[![CI](https://github.com/Nodeira/nodeira/actions/workflows/release.yml/badge.svg)](https://github.com/Nodeira/nodeira/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

An Obsidian-like, AI-enhanced note-taking application. Notes sync offline-first via Yjs CRDTs and are accessible to AI agents through CLI skill tool calls — making Nodeira a persistent "mind" for storing context across software development workflows.

## Screenshots

| Note Editor                                                    | Quick Notes                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| ![Note editor](./apps/docs/static/screenshots/note-editor.png) | ![Quick notes](./apps/docs/static/screenshots/quick-notes.png) |

## Features

- Rich-text editing powered by TipTap + Yjs (offline-first, conflict-free sync)
- Real-time collaboration via WebSocket (Hocuspocus / y-websocket)
- Bidirectional note links and graph view _(planned)_
- Canvas for research and brainstorming _(planned)_
- AI skill tool integration — CLI agents can read and write notes directly _(planned)_
- Plugin architecture with AI-optimized storage formats _(planned)_
- Multi-vault support with folder organization
- Note kinds: plain notes, tasks with Kanban view
- Pinned notes, recent view, per-note metadata and properties

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Backend:** NestJS 10, Prisma ORM, PostgreSQL, Hocuspocus (Yjs WebSocket)
- **Frontend:** React 19, Vite 6, TanStack Router, TanStack Query v5, Mantine v9, TipTap + Yjs
- **Docs:** Docusaurus 3

## Quick Start

### Self-host with Docker Compose

```bash
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
cp docker-compose.example.yml docker-compose.yml
```

Edit `docker-compose.yml` — replace both `CHANGE_ME` values with a strong database password and a random JWT secret (`openssl rand -hex 32`). Then:

```bash
docker compose up -d
docker compose exec nodeira bunx prisma migrate deploy
```

Open `http://localhost:3001`. On first visit you will be directed to the setup page to create your admin account.

### Development setup

**Prerequisites:** Node.js 22+, pnpm, PostgreSQL (or Docker).

```bash
# Start PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Clone and install
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
pnpm install

# Configure the server
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set JWT_SECRET (openssl rand -hex 32)
cd apps/api && pnpm exec prisma db push && cd ../..

# Start all dev servers (web :5173, server :3001, docs :3002)
pnpm run dev
```

Open `http://localhost:5173`. On first visit you will be directed to the setup page to create your admin account.

For full configuration and deployment docs, see the **[documentation](https://Nodeira.github.io/nodeira/)**.

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Releases are automated — pushing to `main` triggers semantic versioning and a GitHub release based on commit types.

| Prefix                                            | Effect                      |
| ------------------------------------------------- | --------------------------- |
| `feat:`                                           | Minor version bump, release |
| `fix:`                                            | Patch version bump, release |
| `BREAKING CHANGE`                                 | Major version bump, release |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:` | No release                  |

## License

MIT

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

**Prerequisites:** PostgreSQL running locally (or via Docker).

```bash
# Start a local Postgres instance
docker run -d --name nodeira-postgres \
  -e POSTGRES_DB=nodeira -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:17-alpine

# Clone and install
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
pnpm install

# Configure the server
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm exec prisma db push && cd ../..

# Start all dev servers (web :5173, server :3001, docs :3002)
pnpm run dev
```

Then open `http://localhost:5173`.

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

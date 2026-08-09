<div align="center">
  <img src="./apps/docs/static/img/logo.svg" alt="Nodeira" width="80" />

  <h1>Nodeira</h1>

> **⚠️ Early Development — Please do not use this project yet.** It is under active development, is not stable, and is not ready for any real use. Breaking changes happen frequently with no migration path.

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
- Real-time collaboration via WebSocket (Hocuspocus)
- Bidirectional note links, backlinks and a graph view
- Canvas for research and brainstorming
- AI agent access — the `nodeira` CLI reads and writes notes as Markdown
- Plugin architecture
- Multi-user with shared vaults; nested folders
- Note kinds: plain notes, tasks with Kanban view
- Reminders (time-based, plus on-device geofencing on Android)
- Pinned notes, recent view, per-note metadata and properties
- Clients for web, desktop (Electron), and Android

## Downloads

These links always resolve to the newest release — no need to hunt through the releases page.
Full list, including the CLI and F-Droid, on the [Downloads page](https://Nodeira.github.io/nodeira/downloads).

|             | Windows                                                                                                                                                                                           | macOS                                                                                                                                                                                       | Linux                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop** | [Setup .exe](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-win32-x64-Setup.exe) · [.zip](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-win32-x64.zip) | [.dmg](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-darwin-arm64.dmg) · [.zip](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-darwin-arm64.zip) | [.deb](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-linux-x64.deb) · [.zip](https://github.com/Nodeira/nodeira/releases/latest/download/Nodeira-linux-x64.zip) |
| **CLI**     | [amd64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-windows-amd64.exe)                                                                                                    | [arm64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-darwin-arm64) · [amd64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-darwin-amd64)       | [amd64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-linux-amd64) · [arm64](https://github.com/Nodeira/nodeira/releases/latest/download/nodeira-linux-arm64)   |

**Android:** add `https://deranjer.github.io/fdroid/repo` to your F-Droid client.
**Server:** `docker pull ghcr.io/nodeira/nodeira:latest`

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Backend:** NestJS 10, Prisma ORM, PostgreSQL, Hocuspocus (Yjs WebSocket)
- **Frontend:** React 19, Vite 6, TanStack Router, TanStack Query v5, Mantine v9, TipTap + Yjs
- **Desktop:** Electron Forge + better-sqlite3
- **Android:** native Kotlin / Jetpack Compose (the editor is a WebView hosting the web build)
- **CLI:** Go + Cobra
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
```

Migrations are applied automatically on startup, so there is no separate migrate step.

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
# Edit apps/api/.env — set JWT_SECRET (openssl rand -hex 32).
# The server refuses to start without one of at least 32 characters, and refuses to
# start if it is still the placeholder from .env.example.
cd apps/api && pnpm exec prisma migrate dev && cd ../..

# Start all dev servers (web :5173, server :3001, docs :3002)
pnpm run dev
```

Running the desktop app in development (it loads the web dev server):

```bash
pnpm exec turbo run dev --filter=@nodeira/api    # 1. API server
pnpm exec turbo run dev --filter=@nodeira/web    # 2. web dev server
pnpm --filter @nodeira/desktop run start         # 3. Electron
```

`better-sqlite3` is a native addon. If pnpm blocked its build scripts during install, run
`pnpm approve-builds` once and reinstall so the rebuild happens.

Open `http://localhost:5173`. On first visit you will be directed to the setup page to create your admin account.

For full configuration and deployment docs, see the **[documentation](https://Nodeira.github.io/nodeira/)**.

## Browser Notes

**Brave Browser:** Brave's Shields feature includes canvas fingerprinting protection that interferes with the Graph View's click detection. If nodes in the graph are not clickable, disable Shields for your Nodeira instance (click the Brave lion icon in the address bar → toggle Shields off). This is safe to do for a self-hosted app on your own server.

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

---
id: contributing
sidebar_position: 1
---

# Contributing

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- [Docker](https://www.docker.com) (for PostgreSQL) or a local PostgreSQL 14+ instance
- [Node.js](https://nodejs.org) ≥ 20 (for some tooling)

## Setup

```bash
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
bun install
```

Start a local PostgreSQL instance:

```bash
docker run -d --name nodeira-postgres \
  -e POSTGRES_DB=nodeira -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:17-alpine
```

Configure the server and push the schema:

```bash
cp apps/server/.env.example apps/server/.env
cd apps/server && bunx prisma db push && cd ../..
```

Start all dev servers:

```bash
bun run dev
```

| Service    | URL                   |
| ---------- | --------------------- |
| Web app    | http://localhost:5173 |
| API server | http://localhost:3001 |
| Docs       | http://localhost:3002 |

## Common commands

```bash
bun run build        # production build for all packages
bun run typecheck    # type-check all packages
bun run test         # run all tests
bun run lint         # lint all packages
bun run format       # format with Prettier

# Run a single app
bunx turbo run dev --filter=@nodeira/web
bunx turbo run dev --filter=@nodeira/server
bunx turbo run dev --filter=@nodeira/docs
```

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commits are linted by commitlint on every PR.

| Prefix                                            | Release effect     |
| ------------------------------------------------- | ------------------ |
| `feat:`                                           | Minor version bump |
| `fix:`                                            | Patch version bump |
| `BREAKING CHANGE`                                 | Major version bump |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:` | No release         |

Releases are automated: merging to `main` triggers semantic-release, which updates the version, generates a CHANGELOG, and publishes a GitHub release + Docker image.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes and add tests where appropriate.
3. Run `bun run typecheck && bun run lint` and fix any errors.
4. Open a PR — the PR template will guide you through the description.
5. CI runs ESLint and commitlint automatically.

## Project structure

```
nodeira/
├── apps/
│   ├── web/      # React 19 + Vite frontend
│   ├── server/   # NestJS 10 + Prisma backend
│   └── docs/     # Docusaurus documentation
└── packages/
    ├── shared-types/   # Shared TypeScript interfaces
    └── eslint-config/  # Shared ESLint rules
```

See [Architecture Overview](../architecture/overview) for a deeper breakdown.

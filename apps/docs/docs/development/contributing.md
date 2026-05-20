---
id: contributing
sidebar_position: 1
---

# Contributing

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 22
- [pnpm](https://pnpm.io) ≥ 9
- [Docker](https://www.docker.com) (for PostgreSQL) or a local PostgreSQL 14+ instance

## Setup

```bash
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
pnpm install
```

Start a local PostgreSQL instance:

```bash
docker run -d --name nodeira-postgres \
  -e POSTGRES_DB=nodeira -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:17-alpine
```

Configure the server and push the schema:

```bash
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm exec prisma db push && cd ../..
```

Start all dev servers:

```bash
pnpm run dev
```

| Service    | URL                   |
| ---------- | --------------------- |
| Web app    | http://localhost:5173 |
| API server | http://localhost:3001 |
| Docs       | http://localhost:3002 |

## Common commands

```bash
pnpm run build        # production build for all packages
pnpm run typecheck    # type-check all packages
pnpm run test         # run all tests
pnpm run lint         # lint all packages
pnpm run format       # format with Prettier

# Run a single app
pnpm exec turbo run dev --filter=@nodeira/web
pnpm exec turbo run dev --filter=@nodeira/api
pnpm exec turbo run dev --filter=@nodeira/docs
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
3. Run `pnpm run typecheck && pnpm run lint` and fix any errors.
4. Open a PR — the PR template will guide you through the description.
5. CI runs ESLint and commitlint automatically.

## Project structure

```
nodeira/
├── apps/
│   ├── web/      # React 19 + Vite frontend
│   ├── api/      # NestJS 10 + Prisma backend
│   └── docs/     # Docusaurus documentation
└── packages/
    ├── shared-types/   # Shared TypeScript interfaces
    └── eslint-config/  # Shared ESLint rules
```

See [Architecture Overview](../architecture/overview) for a deeper breakdown.

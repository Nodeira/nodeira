---
id: getting-started
sidebar_position: 2
---

# Getting Started

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- [Docker](https://www.docker.com) (for PostgreSQL) or a local PostgreSQL 14+ instance

## 1. Clone and install

```bash
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
bun install
```

## 2. Start PostgreSQL

```bash
docker run -d --name nodeira-postgres \
  -e POSTGRES_DB=nodeira \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:17-alpine
```

## 3. Configure the server

```bash
cp apps/server/.env.example apps/server/.env
```

The default `.env` points to `postgresql://postgres:postgres@localhost:5432/nodeira`. Edit if your credentials differ.

## 4. Push the database schema

```bash
cd apps/server && bunx prisma db push
cd ../..
```

This applies the Prisma schema to the database without generating a migration file (suitable for development).

## 5. Start the dev servers

```bash
bun run dev
```

Turborepo starts both servers in parallel:

| Service          | URL                   |
| ---------------- | --------------------- |
| Web app          | http://localhost:5173 |
| API server       | http://localhost:3001 |
| Docs (this site) | http://localhost:3002 |

## First steps in the UI

1. Open http://localhost:5173.
2. Create a **vault** — a top-level workspace for your notes.
3. Optionally add **folders** to organise notes inside the vault.
4. Create a **note** and start writing. Your edits are saved automatically.

## Next steps

- Explore the [Features](./features/vaults) section to learn what Nodeira can do.
- Want to deploy to a server? See [Deployment](./development/deployment).
- Want to contribute code? See [Contributing](./development/contributing).

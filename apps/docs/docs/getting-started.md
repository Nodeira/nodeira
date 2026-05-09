---
id: getting-started
sidebar_position: 2
---

# Getting Started

## Option A — Self-host with Docker Compose

The fastest path if you just want to run Nodeira.

**Prerequisites:** [Docker](https://www.docker.com) with the Compose plugin.

```bash
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
cp docker-compose.example.yml docker-compose.yml
```

Open `docker-compose.yml` and replace both `CHANGE_ME` values:

- `POSTGRES_PASSWORD` / `DATABASE_URL` — a strong database password (same value in both places)
- `JWT_SECRET` — a random secret: `openssl rand -hex 32`

Then start the stack:

```bash
docker compose up -d
docker compose exec nodeira bunx prisma migrate deploy
```

Open **http://localhost:3001**. You will be redirected to the setup page to create your admin account.

---

## Option B — Local development

**Prerequisites:**

- [pnpm](https://pnpm.io) ≥ 9
- [Docker](https://www.docker.com) (for PostgreSQL) or a local PostgreSQL 14+ instance

### 1. Clone and install

```bash
git clone https://github.com/Nodeira/nodeira.git
cd nodeira
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Configure the server

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and set `JWT_SECRET` to a random value:

```bash
openssl rand -hex 32
```

The default `DATABASE_URL` points to `postgresql://postgres:postgres@localhost:5432/nodeira` which matches the dev Compose file. Edit it if your credentials differ.

### 4. Push the database schema

```bash
cd apps/api && pnpm exec prisma db push
cd ../..
```

This applies the Prisma schema directly (suitable for development — no migration file generated).

### 5. Start the dev servers

```bash
pnpm run dev
```

Turborepo starts all servers in parallel:

| Service          | URL                   |
| ---------------- | --------------------- |
| Web app          | http://localhost:5173 |
| API server       | http://localhost:3001 |
| Docs (this site) | http://localhost:3002 |

---

## First-time setup

On first visit the app redirects to **/setup**. Fill in your email, a password (min 8 characters), and an optional display name, then click **Create account**. This creates the admin account and locks the setup page — it cannot be re-run once an account exists.

You are logged in automatically and taken to the main app.

## First steps in the UI

1. Create a **vault** — a top-level workspace for your notes.
2. Optionally add **folders** to organise notes inside the vault.
3. Create a **note** and start writing. Edits are saved automatically via Yjs sync.

## Next steps

- Explore the [Features](./features/vaults) section to learn what Nodeira can do.
- Want to deploy to a server? See [Deployment](./development/deployment).
- Want to contribute code? See [Contributing](./development/contributing).

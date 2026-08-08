---
id: deployment
sidebar_position: 2
---

# Deployment

## Docker (recommended)

The server is published as a multi-platform Docker image to GitHub Container Registry on every release.

### docker-compose.yml

```yaml
# Matches docker-compose.example.yml in the repo — same service names, so commands from
# either place work against the other.
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: nodeira
      POSTGRES_PASSWORD: changeme
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

  nodeira:
    image: ghcr.io/nodeira/nodeira:latest
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:changeme@postgres:5432/nodeira
      # Required: at least 32 characters. The server refuses to start without it.
      JWT_SECRET: changeme # generate: openssl rand -hex 32
      PORT: 3001
      # Optional. Omit for a same-origin install; the API serves the web app itself.
      # CORS_ORIGIN: https://your-domain.com
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - uploads:/app/apps/api/uploads

volumes:
  db_data:
  uploads:
```

Run the stack:

```bash
docker compose up -d
```

The server applies committed migrations automatically on startup (`prisma migrate deploy`), so there is
no manual step. Note that the runtime image does not contain pnpm — it is installed only in the build
stage — so `docker compose exec ... pnpm exec prisma migrate deploy` will fail with `pnpm: not found`.
Watch `docker compose logs -f nodeira` instead.

## Environment variables

### Server (`apps/api/.env`)

| Variable       | Required | Default | Description                                                                                         |
| -------------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | —       | PostgreSQL connection string                                                                        |
| `JWT_SECRET`   | Yes      | —       | Secret used to sign JWTs — generate with `openssl rand -hex 32`                                     |
| `PORT`         | No       | `3001`  | HTTP/WS port                                                                                        |
| `CORS_ORIGIN`  | No       | open    | Comma-separated allowed origins. Leave unset for a same-origin install (the API serves the web app) |

### Web (`apps/web/.env`)

| Variable           | Required | Default               | Description                                                             |
| ------------------ | -------- | --------------------- | ----------------------------------------------------------------------- |
| `VITE_SYNC_WS_URL` | No       | `ws://localhost:5173` | WebSocket base URL for Yjs sync (only override if not using Vite proxy) |

## Reverse proxy

In production, run a reverse proxy (Nginx, Caddy, Traefik) in front of the server. The frontend is a static build served separately (e.g. from a CDN or the same proxy).

WebSocket upgrades must be forwarded. Example Nginx snippet:

```nginx
location /sync/ {
    proxy_pass http://server:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

location /api/ {
    proxy_pass http://server:3001;
}

location /uploads/ {
    proxy_pass http://server:3001;
}
```

## Database migrations

Nodeira uses Prisma with migration files as the source of truth. When you change `schema.prisma`,
generate a migration in development:

```bash
cd apps/api && pnpm exec prisma migrate dev --name <description>
```

Commit the generated file under `apps/api/prisma/migrations/`. In production the committed migrations
are applied with:

```bash
pnpm exec prisma migrate deploy
```

The server also runs `migrate deploy` automatically on startup, so pulling a new image and restarting
applies any pending migrations.

:::caution
Never run `prisma db push` against a database with real data — it can drop columns without a migration
history. Always go through `prisma migrate dev`.
:::

## Upgrading

Pull the new image tag and restart. The server applies any pending migrations automatically on startup (`prisma migrate deploy`), so no manual migration step is needed.

```bash
docker compose pull
docker compose up -d
```

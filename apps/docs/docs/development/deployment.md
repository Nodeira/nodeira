---
id: deployment
sidebar_position: 2
---

# Deployment

## Docker (recommended)

The server is published as a multi-platform Docker image to GitHub Container Registry on every release.

### docker-compose.yml

```yaml
services:
  db:
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

  server:
    image: ghcr.io/nodeira/nodeira:latest
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:changeme@db:5432/nodeira
      JWT_SECRET: changeme # generate: openssl rand -hex 32
      PORT: 3001
      CORS_ORIGIN: https://your-domain.com
    depends_on:
      db:
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
docker compose exec server pnpm exec prisma db push
```

## Environment variables

### Server (`apps/api/.env`)

| Variable       | Required | Default | Description                                                           |
| -------------- | -------- | ------- | --------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | —       | PostgreSQL connection string                                          |
| `JWT_SECRET`   | Yes      | —       | Secret used to sign JWTs — generate with `openssl rand -hex 32`       |
| `PORT`         | No       | `3001`  | HTTP/WS port                                                          |
| `CORS_ORIGIN`  | Yes      | —       | Allowed CORS origin for the frontend (e.g. `https://app.example.com`) |

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

Nodeira uses Prisma. In development `pnpm exec prisma db push` applies the schema directly. In production, generate and apply migration files:

```bash
pnpm exec prisma migrate deploy
```

:::caution
Never run `prisma db push` against a production database — it can drop columns without a migration history.
:::

## Upgrading

Pull the new image tag and restart. Prisma will apply any pending migrations on startup if you run `prisma migrate deploy` before bringing the server up.

```bash
docker compose pull
docker compose up -d
```

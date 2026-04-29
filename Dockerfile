# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy all workspace manifests first for layer caching.
# pnpm requires every workspace package.json to be present before `pnpm install`
# or it considers the lockfile dirty — even for packages excluded from the build.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY apps/docs/package.json ./apps/docs/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile

# Copy source (apps/docs excluded via .dockerignore — manifest above is enough)
COPY apps/server ./apps/server
COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types
COPY packages/eslint-config ./packages/eslint-config

RUN cd apps/server && pnpm exec prisma generate
RUN pnpm exec turbo run build --filter=@nodeira/server... --filter=@nodeira/web...

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Production node_modules (includes generated Prisma client)
COPY --from=builder /app/node_modules ./node_modules

# Workspace package that node_modules/@nodeira/shared-types symlinks to
COPY --from=builder /app/packages/shared-types ./packages/shared-types

# Compiled NestJS server
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Prisma schema and migrations (needed for `prisma migrate deploy`)
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Web app static files — NestJS serves these via ServeStaticModule from ./public
COPY --from=builder /app/apps/web/dist ./apps/server/public

WORKDIR /app/apps/server
EXPOSE 3001

CMD ["node", "dist/main.js"]

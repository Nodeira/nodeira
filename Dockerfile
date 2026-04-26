# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy workspace manifests before source for better layer caching
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install all workspace dependencies (dev included — nest build + prisma generate need them)
RUN bun install --frozen-lockfile

# Copy source
COPY apps/server ./apps/server
COPY packages/shared-types ./packages/shared-types

# Generate Prisma client into node_modules/@prisma/client
RUN cd apps/server && bunx prisma generate

# Build server; turbo also builds @nodeira/shared-types as a declared dependency
RUN bunx turbo run build --filter=@nodeira/server...

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

WORKDIR /app/apps/server
EXPOSE 3001

CMD ["node", "dist/main.js"]
